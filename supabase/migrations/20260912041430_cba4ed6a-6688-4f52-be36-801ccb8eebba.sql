DROP POLICY IF EXISTS "wedding media read" ON storage.objects;
CREATE POLICY "wedding media read accessible"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'wedding-media'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.owns_wedding((storage.foldername(name))[1]::uuid)
    OR EXISTS (
      SELECT 1
      FROM public.weddings w
      WHERE w.id = (storage.foldername(name))[1]::uuid
        AND w.published
        AND w.approval_status = 'approved'
    )
  )
);