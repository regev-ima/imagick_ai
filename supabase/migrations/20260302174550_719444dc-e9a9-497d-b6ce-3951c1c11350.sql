-- Allow users to read their own invoices from storage
DROP POLICY IF EXISTS "Users can read own invoices" ON storage.objects;
CREATE POLICY "Users can read own invoices"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'invoices' AND (storage.foldername(name))[1] = 'invoices' AND (storage.foldername(name))[2] = auth.uid()::text);