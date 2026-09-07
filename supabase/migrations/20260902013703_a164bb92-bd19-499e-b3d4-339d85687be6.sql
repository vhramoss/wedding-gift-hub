DROP FUNCTION IF EXISTS public.claim_first_admin();

CREATE UNIQUE INDEX IF NOT EXISTS user_roles_single_admin_idx
ON public.user_roles ((role))
WHERE role = 'admin'::public.app_role;

DROP POLICY IF EXISTS "first user can claim admin" ON public.user_roles;
CREATE POLICY "first user can claim admin"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND role = 'admin'::public.app_role
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_roles existing_admin
    WHERE existing_admin.role = 'admin'::public.app_role
  )
);