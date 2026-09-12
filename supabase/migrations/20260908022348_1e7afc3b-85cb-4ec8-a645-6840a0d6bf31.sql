DROP POLICY IF EXISTS "auth weddings readable" ON public.weddings;

CREATE POLICY "auth weddings readable"
ON public.weddings
FOR SELECT
TO authenticated
USING (
  (published AND approval_status = 'approved')
  OR owner_id = auth.uid()
  OR public.is_wedding_coowner(id, auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);