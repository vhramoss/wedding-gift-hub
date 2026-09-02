DROP FUNCTION IF EXISTS public.claim_first_admin();

DROP POLICY IF EXISTS "first user can claim admin" ON public.user_roles;
CREATE POLICY "first user can claim admin"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND role = 'admin'::public.app_role
);

CREATE OR REPLACE FUNCTION public.enforce_single_admin_claim()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role <> 'admin'::public.app_role THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(741925031);

  IF EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE role = 'admin'::public.app_role
      AND user_id <> NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Já existe um administrador cadastrado.';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_single_admin_claim() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_single_admin_claim_trigger ON public.user_roles;
CREATE TRIGGER enforce_single_admin_claim_trigger
BEFORE INSERT ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_single_admin_claim();