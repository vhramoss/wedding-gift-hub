CREATE OR REPLACE FUNCTION public.redeem_invite(_token text)
 RETURNS app_role
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  IF _invite.role = 'owner' AND _invite.wedding_id IS NOT NULL THEN
    UPDATE public.weddings w
       SET owner_id = auth.uid()
     WHERE w.id = _invite.wedding_id
       AND (
         w.owner_id IS NULL
         OR w.owner_id = _invite.created_by
         OR public.has_role(w.owner_id, 'admin')
       );
  END IF;

  UPDATE public.wedding_invites
     SET used_by = auth.uid(), used_at = COALESCE(used_at, now())
   WHERE id = _invite.id;

  RETURN _invite.role;
END;
$function$;