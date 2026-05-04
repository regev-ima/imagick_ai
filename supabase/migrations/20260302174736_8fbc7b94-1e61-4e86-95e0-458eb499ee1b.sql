-- Fix storage policy path: files are stored as {user_id}/INV-xxx.html (no nested invoices/ folder)
DROP POLICY IF EXISTS "Users can read own invoices" ON storage.objects;
CREATE POLICY "Users can read own invoices"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'invoices' AND (storage.foldername(name))[1] = auth.uid()::text);