-- Allow users to read their own invoices from storage
CREATE POLICY "Users can read own invoices"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'invoices' AND (storage.foldername(name))[1] = 'invoices' AND (storage.foldername(name))[2] = auth.uid()::text);