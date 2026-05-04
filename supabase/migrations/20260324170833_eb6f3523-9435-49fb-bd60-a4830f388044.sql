-- Allow authenticated users to insert face_detections for their own galleries
CREATE POLICY "Users can insert face_detections for own galleries"
  ON face_detections FOR INSERT TO authenticated
  WITH CHECK (gallery_id IN (SELECT id FROM galleries WHERE user_id = auth.uid()));

-- Allow authenticated users to delete face_detections for their own galleries
CREATE POLICY "Users can delete face_detections for own galleries"
  ON face_detections FOR DELETE TO authenticated
  USING (gallery_id IN (SELECT id FROM galleries WHERE user_id = auth.uid()));

-- Allow authenticated users to insert face_clusters for their own galleries
CREATE POLICY "Users can insert face_clusters for own galleries"
  ON face_clusters FOR INSERT TO authenticated
  WITH CHECK (gallery_id IN (SELECT id FROM galleries WHERE user_id = auth.uid()));

-- Allow authenticated users to delete face_clusters for their own galleries
CREATE POLICY "Users can delete face_clusters for own galleries"
  ON face_clusters FOR DELETE TO authenticated
  USING (gallery_id IN (SELECT id FROM galleries WHERE user_id = auth.uid()));