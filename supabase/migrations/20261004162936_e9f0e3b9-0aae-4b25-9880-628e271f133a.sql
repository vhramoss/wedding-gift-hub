ALTER TABLE public.wedding_invites ADD COLUMN IF NOT EXISTS guest_id uuid REFERENCES public.wedding_guests(id) ON DELETE CASCADE;

CREATE TABLE public.wedding_guest_passwords (
  wedding_id uuid PRIMARY KEY REFERENCES public.weddings(id) ON DELETE CASCADE,
  password text NOT NULL CHECK (length(password) >= 6),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wedding_guest_passwords TO authenticated;
GRANT ALL ON public.wedding_guest_passwords TO service_role;
ALTER TABLE public.wedding_guest_passwords ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage guest password" ON public.wedding_guest_passwords
  FOR ALL TO authenticated USING (public.owns_wedding(wedding_id)) WITH CHECK (public.owns_wedding(wedding_id));

-- Informação pública do convite: senha só enquanto o convite estiver livre
CREATE OR REPLACE FUNCTION public.invite_public_info(_token text)
RETURNS TABLE(valid boolean, role app_role, slug text, bride_name text, groom_name text, guest_name text, guest_password text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE i public.wedding_invites%ROWTYPE;
BEGIN
  SELECT * INTO i FROM public.wedding_invites WHERE token = _token;
  IF i.id IS NULL THEN RETURN QUERY SELECT false, NULL::app_role, NULL, NULL, NULL, NULL, NULL; RETURN; END IF;
  RETURN QUERY
  SELECT (i.used_by IS NULL AND (i.expires_at IS NULL OR i.expires_at > now())),
         i.role, w.slug, w.bride_name, w.groom_name, g.name,
         CASE WHEN i.used_by IS NULL AND i.role = 'guest' AND (i.expires_at IS NULL OR i.expires_at > now())
              THEN p.password END
  FROM (SELECT 1) x
  LEFT JOIN public.weddings w ON w.id = i.wedding_id
  LEFT JOIN public.wedding_guests g ON g.id = i.guest_id
  LEFT JOIN public.wedding_guest_passwords p ON p.wedding_id = i.wedding_id;
END $$;
GRANT EXECUTE ON FUNCTION public.invite_public_info(text) TO anon, authenticated;

-- Uso único + vínculo automático ao convidado da lista
CREATE OR REPLACE FUNCTION public.redeem_invite(_token text)
 RETURNS app_role LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _invite public.wedding_invites%ROWTYPE;
  _current_owner uuid;
  _g public.wedding_guests%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Faça login para usar o convite.'; END IF;
  SELECT * INTO _invite FROM public.wedding_invites WHERE token = _token FOR UPDATE;
  IF _invite.id IS NULL THEN RAISE EXCEPTION 'Convite inválido.'; END IF;
  IF _invite.used_by IS NOT NULL AND _invite.used_by <> auth.uid() THEN
    RAISE EXCEPTION 'Este convite já foi usado para criar um perfil. Peça um novo aos noivos.';
  END IF;
  IF _invite.used_by IS NULL AND _invite.expires_at IS NOT NULL AND _invite.expires_at < now() THEN
    RAISE EXCEPTION 'Convite expirado.';
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), _invite.role)
  ON CONFLICT (user_id, role) DO NOTHING;

  IF _invite.role = 'owner' AND _invite.wedding_id IS NOT NULL THEN
    SELECT owner_id INTO _current_owner FROM public.weddings WHERE id = _invite.wedding_id;
    IF _current_owner IS NULL OR _current_owner = _invite.created_by OR public.has_role(_current_owner, 'admin') THEN
      UPDATE public.weddings SET owner_id = auth.uid() WHERE id = _invite.wedding_id;
    ELSIF _current_owner <> auth.uid() THEN
      INSERT INTO public.wedding_owners (wedding_id, user_id) VALUES (_invite.wedding_id, auth.uid())
      ON CONFLICT (wedding_id, user_id) DO NOTHING;
    END IF;
  END IF;

  IF _invite.guest_id IS NOT NULL THEN
    SELECT * INTO _g FROM public.wedding_guests WHERE id = _invite.guest_id FOR UPDATE;
    IF _g.user_id IS NOT NULL AND _g.user_id <> auth.uid() THEN
      RAISE EXCEPTION 'Este convidado já está ligado a outro perfil.';
    END IF;
    UPDATE public.wedding_guests SET user_id = auth.uid() WHERE id = _g.id;
    UPDATE public.profiles SET full_name = _g.name WHERE id = auth.uid() AND coalesce(full_name,'') = '';
    INSERT INTO public.wedding_guest_signups (wedding_id, user_id, full_name, cpf, guest_id)
    VALUES (_g.wedding_id, auth.uid(), _g.name, coalesce(_g.cpf,''), _g.id)
    ON CONFLICT (wedding_id, user_id) DO UPDATE SET guest_id = excluded.guest_id, full_name = excluded.full_name;
  END IF;

  UPDATE public.wedding_invites SET used_by = auth.uid(), used_at = COALESCE(used_at, now()) WHERE id = _invite.id;
  RETURN _invite.role;
END;
$function$;

-- Convidado vinculado ao usuário logado
CREATE OR REPLACE FUNCTION public.my_wedding_guest(_wedding_id uuid)
RETURNS TABLE(id uuid, name text, group_label text, max_companions integer, attending boolean, companions integer,
  attending_ceremony boolean, attending_party boolean, dietary_notes text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT g.id, g.name, g.group_label, g.max_companions, g.attending, g.companions, g.attending_ceremony, g.attending_party, g.dietary_notes
  FROM public.wedding_guests g WHERE g.wedding_id = _wedding_id AND g.user_id = auth.uid() LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.my_wedding_guest(uuid) TO authenticated;

-- Só o próprio convidado vinculado pode responder por ele
CREATE OR REPLACE FUNCTION public.respond_wedding_guest(p_guest_id uuid, p_attending boolean, p_companions integer DEFAULT 0, p_ceremony boolean DEFAULT true, p_party boolean DEFAULT true, p_dietary text DEFAULT NULL::text, p_message text DEFAULT NULL::text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare g record; w record;
begin
  select * into g from public.wedding_guests where id = p_guest_id for update;
  if not found then raise exception 'Convidado não encontrado na lista.'; end if;
  if g.user_id is not null and g.user_id is distinct from auth.uid() and not public.owns_wedding(g.wedding_id) then
    raise exception 'Somente o próprio convidado pode confirmar esta presença.';
  end if;
  select * into w from public.weddings where id = g.wedding_id;
  if not (w.published and w.approval_status = 'approved') then raise exception 'Esta lista ainda não está liberada.'; end if;
  if not public.rsvp_open(g.wedding_id) then raise exception 'O prazo para confirmar presença já encerrou.'; end if;
  update public.wedding_guests set
    attending = p_attending,
    companions = case when p_attending then greatest(0, least(coalesce(p_companions,0), g.max_companions)) else 0 end,
    attending_ceremony = case when p_attending then coalesce(p_ceremony, true) else false end,
    attending_party = case when p_attending then coalesce(p_party, true) else false end,
    dietary_notes = case when p_attending then nullif(trim(coalesce(p_dietary,'')), '') else null end,
    message = nullif(trim(coalesce(p_message,'')), ''),
    responded_at = now()
  where id = p_guest_id;
  insert into public.wedding_notifications (wedding_id, kind, title, body)
  values (g.wedding_id, 'rsvp',
    case when p_attending then 'Nova confirmação de presença' else 'Convidado não poderá ir' end,
    g.name || case when p_attending
      then ' confirmou presença (' || greatest(0, least(coalesce(p_companions,0), g.max_companions)) || ' acompanhante(s))'
      else ' informou que não poderá comparecer' end);
end;
$function$;