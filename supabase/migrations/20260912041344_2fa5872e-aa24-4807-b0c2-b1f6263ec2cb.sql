DROP POLICY IF EXISTS "auth read announcements" ON public.wedding_announcements;
CREATE POLICY "auth read accessible announcements"
ON public.wedding_announcements
FOR SELECT
TO authenticated
USING (
  public.owns_wedding(wedding_id)
  OR EXISTS (
    SELECT 1
    FROM public.weddings w
    WHERE w.id = wedding_announcements.wedding_id
      AND w.published
      AND w.approval_status = 'approved'
  )
);