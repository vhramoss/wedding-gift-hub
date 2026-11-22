DO $migration$
DECLARE definition text;
BEGIN
  SELECT pg_get_functiondef('public.respond_wedding_guest(uuid,boolean,integer,boolean,boolean,text,text)'::regprocedure) INTO definition;
  definition := replace(definition, 'if g.user_id is not null and g.user_id is distinct from auth.uid() and not public.owns_wedding(g.wedding_id) then', 'if auth.uid() is null or (g.user_id is distinct from auth.uid() and not public.owns_wedding(g.wedding_id)) then');
  IF position('if auth.uid() is null or (' in definition) = 0 THEN RAISE EXCEPTION 'Unexpected RSVP function definition'; END IF;
  EXECUTE definition;
END $migration$;
REVOKE EXECUTE ON FUNCTION public.respond_wedding_guest(uuid,boolean,integer,boolean,boolean,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_wedding_guest(uuid,boolean,integer,boolean,boolean,text,text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.confirm_guest_companions(uuid,text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_guest_companions(uuid,text[]) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.my_wedding_guest(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_wedding_guest(uuid) TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.search_wedding_guests(p_wedding_id uuid, p_query text)
RETURNS TABLE(id uuid, name text, group_label text, max_companions integer, attending boolean, companions integer, attending_ceremony boolean, attending_party boolean, dietary_notes text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
 SELECT g.id,g.name,g.group_label,g.max_companions,g.attending,g.companions,g.attending_ceremony,g.attending_party,g.dietary_notes
 FROM public.wedding_guests g
 WHERE g.wedding_id=p_wedding_id AND auth.uid() IS NOT NULL AND public.owns_wedding(p_wedding_id)
 AND length(trim(coalesce(p_query,''))) BETWEEN 3 AND 120
 AND (g.name_norm LIKE '%' || public.norm_txt(trim(p_query)) || '%' OR g.cpf=regexp_replace(p_query,'\D','','g'))
 ORDER BY g.name LIMIT 10;
$$;
REVOKE EXECUTE ON FUNCTION public.search_wedding_guests(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_wedding_guests(uuid,text) TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.register_invited_guest(p_wedding_id uuid,p_name text,p_cpf text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$ BEGIN RAISE EXCEPTION 'Abra seu convite individual para vincular sua conta.'; END $$;
REVOKE EXECUTE ON FUNCTION public.register_invited_guest(uuid,text,text) FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION public.register_invited_guest(uuid,text,text) IS 'DEPRECATED: use individual invitation redemption; CPF cannot establish account ownership.';
CREATE OR REPLACE FUNCTION public.register_guest_contact_by_invite(p_token text,p_name text,p_kind text,p_value text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE invitation public.wedding_invites%ROWTYPE; guest public.wedding_guests%ROWTYPE; account_email text; wedding_slug text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Faça login.'; END IF;
 SELECT * INTO invitation FROM public.wedding_invites WHERE token=p_token AND used_by=auth.uid() AND role='guest' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Convite inválido.'; END IF;
 IF invitation.guest_id IS NULL THEN RAISE EXCEPTION 'Peça aos noivos seu convite individual.'; END IF;
 SELECT * INTO guest FROM public.wedding_guests WHERE id=invitation.guest_id AND wedding_id=invitation.wedding_id FOR UPDATE;
 IF NOT FOUND OR guest.user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Este convite não está ligado à sua conta.'; END IF;
 IF length(trim(coalesce(p_name,''))) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'Informe seu nome.'; END IF;
 account_email := lower(trim(coalesce(auth.jwt()->>'email','')));
 IF p_kind='email' AND lower(trim(coalesce(p_value,''))) IS DISTINCT FROM account_email THEN RAISE EXCEPTION 'Use o e-mail da sua conta.'; END IF;
 IF p_kind NOT IN ('email','phone','cpf') THEN RAISE EXCEPTION 'Dado inválido.'; END IF;
 SELECT slug INTO wedding_slug FROM public.weddings WHERE id=invitation.wedding_id;
 RETURN wedding_slug;
END $$;
REVOKE EXECUTE ON FUNCTION public.register_guest_contact_by_invite(text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_guest_contact_by_invite(text,text,text,text) TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.public_order_receipt(p_order_id uuid,p_slug text)
RETURNS TABLE(id uuid, status text, payment_method text, installments integer,total_cents integer,gift_name text,bride_name text,groom_name text,paid_at timestamptz,created_at timestamptz,cart_items integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
AS $$
 SELECT o.id,o.status,o.payment_method,o.installments,
 coalesce((SELECT sum(c.total_cents)::integer FROM public.orders c WHERE o.cart_id IS NOT NULL AND c.cart_id=o.cart_id),o.total_cents),
 g.name,w.bride_name,w.groom_name,o.paid_at,o.created_at,
 coalesce((SELECT count(*)::integer FROM public.orders c WHERE o.cart_id IS NOT NULL AND c.cart_id=o.cart_id),1)
 FROM public.orders o JOIN public.weddings w ON w.id=o.wedding_id LEFT JOIN public.gifts g ON g.id=o.gift_id
 WHERE o.id=p_order_id AND w.slug=p_slug;
$$;
REVOKE EXECUTE ON FUNCTION public.public_order_receipt(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_order_receipt(uuid,text) TO anon,authenticated,service_role;