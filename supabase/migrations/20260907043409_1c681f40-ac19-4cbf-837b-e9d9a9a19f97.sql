CREATE OR REPLACE FUNCTION public.wedding_payment_public_key(_wedding_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT a.public_key FROM public.wedding_payment_accounts a WHERE a.wedding_id = _wedding_id;
$$;