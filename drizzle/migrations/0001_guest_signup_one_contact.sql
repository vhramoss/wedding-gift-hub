ALTER TABLE public.wedding_guest_signups ADD COLUMN IF NOT EXISTS phone text, ADD COLUMN IF NOT EXISTS email text;

CREATE OR REPLACE FUNCTION public.register_guest_contact_by_invite(p_token text, p_name text, p_kind text, p_value text)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_wedding uuid; v_slug text; v_val text; v_guest uuid;
  v_cpf text := ''; v_phone text; v_email text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Faça login.'; END IF;
  IF coalesce(trim(p_name),'') = '' THEN RAISE EXCEPTION 'Informe seu nome completo.'; END IF;
  SELECT i.wedding_id INTO v_wedding FROM public.wedding_invites i
   WHERE i.token = p_token AND i.used_by = auth.uid();
  IF v_wedding IS NULL THEN RAISE EXCEPTION 'Convite sem casamento vinculado.'; END IF;

  IF p_kind = 'cpf' THEN
    v_cpf := regexp_replace(coalesce(p_value,''), '\D', '', 'g');
    IF length(v_cpf) <> 11 THEN RAISE EXCEPTION 'CPF inválido.'; END IF;
    SELECT id INTO v_guest FROM public.wedding_guests WHERE wedding_id = v_wedding AND cpf = v_cpf LIMIT 1;
  ELSIF p_kind = 'phone' THEN
    v_phone := regexp_replace(coalesce(p_value,''), '\D', '', 'g');
    IF length(v_phone) < 10 OR length(v_phone) > 13 THEN RAISE EXCEPTION 'Telefone inválido. Use DDD + número.'; END IF;
    SELECT id INTO v_guest FROM public.wedding_guests WHERE wedding_id = v_wedding
      AND right(regexp_replace(coalesce(phone,''), '\D', '', 'g'), 10) = right(v_phone, 10) AND user_id IS NULL LIMIT 1;
  ELSIF p_kind = 'email' THEN
    v_email := lower(trim(coalesce(p_value,'')));
    IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'E-mail inválido.'; END IF;
    SELECT id INTO v_guest FROM public.wedding_guests WHERE wedding_id = v_wedding
      AND lower(trim(coalesce(email,''))) = v_email AND user_id IS NULL LIMIT 1;
  ELSE
    RAISE EXCEPTION 'Escolha CPF, telefone ou e-mail.';
  END IF;

  UPDATE public.profiles SET full_name = trim(p_name),
    cpf = CASE WHEN v_cpf <> '' THEN v_cpf ELSE cpf END,
    phone = coalesce(v_phone, phone)
   WHERE id = auth.uid();
  IF v_guest IS NOT NULL THEN
    UPDATE public.wedding_guests SET user_id = auth.uid() WHERE id = v_guest;
  END IF;
  INSERT INTO public.wedding_guest_signups (wedding_id, user_id, full_name, cpf, phone, email, guest_id)
  VALUES (v_wedding, auth.uid(), trim(p_name), v_cpf, v_phone, v_email, v_guest)
  ON CONFLICT (wedding_id, user_id) DO UPDATE
    SET full_name = excluded.full_name, cpf = excluded.cpf, phone = excluded.phone,
        email = excluded.email, guest_id = coalesce(excluded.guest_id, wedding_guest_signups.guest_id);
  SELECT slug INTO v_slug FROM public.weddings WHERE id = v_wedding;
  RETURN v_slug;
END; $$;
REVOKE EXECUTE ON FUNCTION public.register_guest_contact_by_invite(text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_guest_contact_by_invite(text,text,text,text) TO authenticated;