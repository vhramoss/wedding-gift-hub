-- Perfis criados pelo convite (lista separada da lista fechada)
CREATE TABLE public.wedding_guest_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id uuid NOT NULL REFERENCES public.weddings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  full_name text NOT NULL,
  cpf text NOT NULL,
  guest_id uuid REFERENCES public.wedding_guests(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (wedding_id, user_id)
);
GRANT SELECT ON public.wedding_guest_signups TO authenticated;
GRANT ALL ON public.wedding_guest_signups TO service_role;
ALTER TABLE public.wedding_guest_signups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners read signups" ON public.wedding_guest_signups FOR SELECT TO authenticated
  USING (public.owns_wedding(wedding_id) OR public.has_role(auth.uid(),'admin') OR user_id = auth.uid());

-- Move cadastros antigos feitos pelo QR para a nova lista
INSERT INTO public.wedding_guest_signups (wedding_id, user_id, full_name, cpf)
SELECT wedding_id, user_id, name, cpf FROM public.wedding_guests
 WHERE group_label = 'Convite QR' AND user_id IS NOT NULL AND cpf IS NOT NULL
ON CONFLICT DO NOTHING;
DELETE FROM public.wedding_guests WHERE group_label = 'Convite QR' AND responded_at IS NULL;

-- CPF da lista fechada sempre só com números
CREATE OR REPLACE FUNCTION public.normalize_guest_cpf()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$ BEGIN
  NEW.cpf := nullif(regexp_replace(coalesce(NEW.cpf,''), '\D', '', 'g'), '');
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS wedding_guests_norm_cpf ON public.wedding_guests;
CREATE TRIGGER wedding_guests_norm_cpf BEFORE INSERT OR UPDATE OF cpf ON public.wedding_guests
  FOR EACH ROW EXECUTE FUNCTION public.normalize_guest_cpf();

CREATE OR REPLACE FUNCTION public.register_invited_guest(p_wedding_id uuid, p_name text, p_cpf text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_cpf text := regexp_replace(coalesce(p_cpf,''), '\D', '', 'g'); v_guest uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Faça login.'; END IF;
  IF length(v_cpf) <> 11 THEN RAISE EXCEPTION 'CPF inválido.'; END IF;
  IF coalesce(trim(p_name),'') = '' THEN RAISE EXCEPTION 'Informe seu nome completo.'; END IF;
  UPDATE public.profiles SET full_name = trim(p_name), cpf = v_cpf WHERE id = auth.uid();
  SELECT id INTO v_guest FROM public.wedding_guests WHERE wedding_id = p_wedding_id AND cpf = v_cpf;
  IF v_guest IS NOT NULL THEN
    UPDATE public.wedding_guests SET user_id = auth.uid() WHERE id = v_guest;
  END IF;
  INSERT INTO public.wedding_guest_signups (wedding_id, user_id, full_name, cpf, guest_id)
  VALUES (p_wedding_id, auth.uid(), trim(p_name), v_cpf, v_guest)
  ON CONFLICT (wedding_id, user_id) DO UPDATE
    SET full_name = excluded.full_name, cpf = excluded.cpf, guest_id = excluded.guest_id;
  RETURN v_guest;
END; $$;

-- Cerimonialista por convite
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS planner_user_id uuid;

CREATE TABLE public.planner_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  wedding_id uuid NOT NULL REFERENCES public.weddings(id) ON DELETE CASCADE,
  created_by uuid,
  used_by uuid,
  used_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 days',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.planner_invites TO authenticated;
GRANT ALL ON public.planner_invites TO service_role;
ALTER TABLE public.planner_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners read planner invites" ON public.planner_invites FOR SELECT TO authenticated
  USING (public.owns_wedding(wedding_id) OR public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.create_planner_invite(_wedding_id uuid)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _token text;
BEGIN
  IF NOT (public.owns_wedding(_wedding_id) OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  _token := encode(gen_random_bytes(16), 'hex');
  INSERT INTO public.planner_invites (token, wedding_id, created_by) VALUES (_token, _wedding_id, auth.uid());
  RETURN _token;
END; $$;

CREATE OR REPLACE FUNCTION public.planner_invite_info(_token text)
 RETURNS TABLE(bride_name text, groom_name text, wedding_date date, valid boolean)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT w.bride_name, w.groom_name, w.wedding_date,
         (i.expires_at >= now() AND (i.used_by IS NULL OR i.used_by = auth.uid()))
  FROM public.planner_invites i JOIN public.weddings w ON w.id = i.wedding_id
  WHERE i.token = _token AND auth.uid() IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.accept_planner_invite(_token text, _name text, _contact text, _pix text)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE i record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Faça login.'; END IF;
  IF coalesce(trim(_name),'') = '' OR coalesce(trim(_pix),'') = '' THEN
    RAISE EXCEPTION 'Informe seu nome e sua chave Pix.';
  END IF;
  SELECT * INTO i FROM public.planner_invites WHERE token = _token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Convite inválido.'; END IF;
  IF i.expires_at < now() THEN RAISE EXCEPTION 'Convite expirado.'; END IF;
  IF i.used_by IS NOT NULL AND i.used_by <> auth.uid() THEN RAISE EXCEPTION 'Convite já utilizado.'; END IF;
  PERFORM set_config('app.planner_accept', '1', true);
  UPDATE public.weddings SET planner_user_id = auth.uid(), planner_name = trim(_name),
    planner_contact = nullif(trim(coalesce(_contact,'')), ''), planner_pix = trim(_pix)
   WHERE id = i.wedding_id;
  UPDATE public.planner_invites SET used_by = auth.uid(), used_at = coalesce(used_at, now()) WHERE id = i.id;
  RETURN (SELECT bride_name || ' e ' || groom_name FROM public.weddings WHERE id = i.wedding_id);
END; $$;

CREATE OR REPLACE FUNCTION public.protect_wedding_admin_fields()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') OR auth.uid() IS NULL THEN RETURN NEW; END IF;
  NEW.approval_status := OLD.approval_status; NEW.approval_note := OLD.approval_note;
  NEW.approved_at := OLD.approved_at; NEW.approved_by := OLD.approved_by;
  NEW.plan := OLD.plan; NEW.plan_fee_cents := OLD.plan_fee_cents; NEW.plan_billing := OLD.plan_billing;
  NEW.plan_paid := OLD.plan_paid; NEW.plan_started_on := OLD.plan_started_on; NEW.plan_notes := OLD.plan_notes;
  NEW.commission_percent := OLD.commission_percent; NEW.commission_paid_by := OLD.commission_paid_by;
  NEW.planner_percent := OLD.planner_percent;
  IF coalesce(current_setting('app.planner_accept', true), '') <> '1' THEN
    NEW.planner_name := OLD.planner_name; NEW.planner_contact := OLD.planner_contact;
    NEW.planner_pix := OLD.planner_pix; NEW.planner_user_id := OLD.planner_user_id;
  END IF;
  IF OLD.fees_accepted_at IS NOT NULL THEN NEW.fees_accepted_at := OLD.fees_accepted_at; END IF;
  IF OLD.approval_status <> 'approved' THEN NEW.published := false; END IF;
  RETURN NEW;
END; $$;

REVOKE EXECUTE ON FUNCTION public.create_planner_invite(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.planner_invite_info(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.accept_planner_invite(text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_planner_invite(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.planner_invite_info(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_planner_invite(text,text,text,text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.normalize_guest_cpf() FROM PUBLIC, anon, authenticated;