CREATE OR REPLACE FUNCTION public.register_guest_by_invite(p_token text, p_name text, p_cpf text)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_wedding uuid; v_slug text;
BEGIN
  SELECT i.wedding_id INTO v_wedding FROM public.wedding_invites i
   WHERE i.token = p_token AND i.used_by = auth.uid();
  IF v_wedding IS NULL THEN RAISE EXCEPTION 'Convite sem casamento vinculado.'; END IF;
  PERFORM public.register_invited_guest(v_wedding, p_name, p_cpf);
  SELECT slug INTO v_slug FROM public.weddings WHERE id = v_wedding;
  RETURN v_slug;
END; $$;
REVOKE EXECUTE ON FUNCTION public.register_guest_by_invite(text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_guest_by_invite(text,text,text) TO authenticated;