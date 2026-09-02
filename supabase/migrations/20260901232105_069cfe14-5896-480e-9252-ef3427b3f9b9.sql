CREATE POLICY "wedding media read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'wedding-media');
CREATE POLICY "wedding media insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'wedding-media' AND owner = auth.uid());
CREATE POLICY "wedding media update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'wedding-media' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'wedding-media' AND owner = auth.uid());
CREATE POLICY "wedding media delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'wedding-media' AND owner = auth.uid());