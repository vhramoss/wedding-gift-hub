CREATE TABLE public.wedding_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  role public.app_role NOT NULL DEFAULT 'guest',
  email text,
  note text,
  expires_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  used_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wedding_invites TO authenticated;
GRANT ALL ON public.wedding_invites TO service_role;

ALTER TABLE public.wedding_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super admin manages invites" ON public.wedding_invites
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER wedding_invites_updated_at
  BEFORE UPDATE ON public.wedding_invites
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Resgate do convite: concede o perfil ao usuário autenticado
CREATE OR REPLACE FUNCTION public.redeem_invite(_token text)
RETURNS public.app_role
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invite public.wedding_invites%ROWTYPE;
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

  UPDATE public.wedding_invites
     SET used_by = auth.uid(), used_at = COALESCE(used_at, now())
   WHERE id = _invite.id;

  RETURN _invite.role;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.redeem_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_invite(text) TO authenticated;

-- Somente noivos (owner) ou super admin podem criar/gerir um casamento
DROP POLICY IF EXISTS "owners manage own wedding" ON public.weddings;

CREATE POLICY "owners read own wedding" ON public.weddings
  FOR SELECT TO authenticated USING (owner_id = auth.uid());

CREATE POLICY "owners create wedding" ON public.weddings
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid()
    AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin')));

CREATE POLICY "owners update own wedding" ON public.weddings
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin')))
  WITH CHECK (owner_id = auth.uid() AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin')));

CREATE POLICY "owners delete own wedding" ON public.weddings
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid() AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin')));