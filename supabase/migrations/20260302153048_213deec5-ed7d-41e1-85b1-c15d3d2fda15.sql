DROP POLICY IF EXISTS "Service can upload invoices" ON storage.objects;
CREATE POLICY "Service can upload invoices"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'invoices' AND public.is_admin(auth.uid()));