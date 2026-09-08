CREATE TABLE public.wedding_owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id uuid NOT NULL REFERENCES public.weddings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (wedding_id, user_id)
);

GRANT SELECT ON public.wedding_owners TO authenticated;
GRANT ALL ON public.wedding_owners TO service_role;

ALTER TABLE public.wedding_owners ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_wedding_coowner(_wedding_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.wedding_owners wo
    WHERE wo.wedding_id = _wedding_id AND wo.user_id = _user_id
  );
$$;

CREATE POLICY "coowners read own rows" ON public.wedding_owners
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.weddings w WHERE w.id = wedding_id AND w.owner_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

CREATE OR REPLACE FUNCTION public.owns_wedding(_wedding_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.weddings w
    WHERE w.id = _wedding_id AND w.owner_id = auth.uid()
  ) OR public.is_wedding_coowner(_wedding_id, auth.uid());
$$;

DROP POLICY IF EXISTS "auth weddings readable" ON public.weddings;
CREATE POLICY "auth weddings readable" ON public.weddings
FOR SELECT
USING (
  (published AND approval_status = 'approved')
  OR owner_id = auth.uid()
  OR public.is_wedding_coowner(id, auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "owners read own wedding" ON public.weddings;
CREATE POLICY "owners read own wedding" ON public.weddings
FOR SELECT TO authenticated
USING (owner_id = auth.uid() OR public.is_wedding_coowner(id, auth.uid()));

DROP POLICY IF EXISTS "owners update own wedding" ON public.weddings;
CREATE POLICY "owners update own wedding" ON public.weddings
FOR UPDATE TO authenticated
USING ((owner_id = auth.uid() OR public.is_wedding_coowner(id, auth.uid()))
       AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin')))
WITH CHECK ((owner_id = auth.uid() OR public.is_wedding_coowner(id, auth.uid()))
       AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin')));

CREATE OR REPLACE FUNCTION public.redeem_invite(_token text)
RETURNS app_role LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _invite public.wedding_invites%ROWTYPE;
  _current_owner uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Faça login para usar o convite.';
  END IF;

  SELECT * INTO _invite FROM public.wedding_invites WHERE token = _token;

  IF _invite.id IS NULL THEN
    RAISE EXCEPTION 'Convite inválido.';
  END IF;
  IF _invite.expires_at IS NOT NULL AND _invite.expires_at < now() THEN
    RAISE EXCEPTION 'Convite expirado.';
  END IF;
  IF _invite.used_by IS NOT NULL AND _invite.used_by <> auth.uid() THEN
    RAISE EXCEPTION 'Convite já utilizado.';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), _invite.role)
  ON CONFLICT (user_id, role) DO NOTHING;

  IF _invite.role = 'owner' AND _invite.wedding_id IS NOT NULL THEN
    SELECT owner_id INTO _current_owner FROM public.weddings WHERE id = _invite.wedding_id;

    IF _current_owner IS NULL
       OR _current_owner = _invite.created_by
       OR public.has_role(_current_owner, 'admin') THEN
      UPDATE public.weddings SET owner_id = auth.uid() WHERE id = _invite.wedding_id;
    ELSIF _current_owner <> auth.uid() THEN
      INSERT INTO public.wedding_owners (wedding_id, user_id)
      VALUES (_invite.wedding_id, auth.uid())
      ON CONFLICT (wedding_id, user_id) DO NOTHING;
    END IF;
  END IF;

  UPDATE public.wedding_invites
     SET used_by = auth.uid(), used_at = COALESCE(used_at, now())
   WHERE id = _invite.id;

  RETURN _invite.role;
END;
$$;

CREATE OR REPLACE FUNCTION public.wedding_coowners(_wedding_id uuid)
RETURNS TABLE(user_id uuid, full_name text, email text, is_primary boolean, added_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT w.owner_id, coalesce(p.full_name, ''), u.email::text, true, w.created_at
  FROM public.weddings w
  LEFT JOIN public.profiles p ON p.id = w.owner_id
  LEFT JOIN auth.users u ON u.id = w.owner_id
  WHERE w.id = _wedding_id
    AND w.owner_id IS NOT NULL
    AND (public.owns_wedding(_wedding_id) OR public.has_role(auth.uid(), 'admin'))
  UNION ALL
  SELECT wo.user_id, coalesce(p.full_name, ''), u.email::text, false, wo.created_at
  FROM public.wedding_owners wo
  LEFT JOIN public.profiles p ON p.id = wo.user_id
  LEFT JOIN auth.users u ON u.id = wo.user_id
  WHERE wo.wedding_id = _wedding_id
    AND (public.owns_wedding(_wedding_id) OR public.has_role(auth.uid(), 'admin'));
$$;

CREATE OR REPLACE FUNCTION public.remove_wedding_coowner(_wedding_id uuid, _user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (EXISTS (SELECT 1 FROM public.weddings w WHERE w.id = _wedding_id AND w.owner_id = auth.uid())
          OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Apenas o titular do casamento pode remover acessos.';
  END IF;
  DELETE FROM public.wedding_owners WHERE wedding_id = _wedding_id AND user_id = _user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_coowner_invite(_wedding_id uuid, _email text DEFAULT NULL, _note text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _token text;
BEGIN
  IF NOT (public.owns_wedding(_wedding_id) OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  _token := encode(gen_random_bytes(16), 'hex');
  INSERT INTO public.wedding_invites (token, role, email, note, wedding_id, created_by, expires_at)
  VALUES (_token, 'owner', nullif(trim(coalesce(_email,'')), ''),
          nullif(trim(coalesce(_note,'')), ''), _wedding_id, auth.uid(), now() + interval '30 days');
  RETURN _token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.wedding_coowners(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_wedding_coowner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_coowner_invite(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_wedding_coowner(uuid, uuid) TO authenticated, anon;