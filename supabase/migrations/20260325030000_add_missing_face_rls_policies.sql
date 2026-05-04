-- Add missing INSERT and DELETE RLS policies for face_clusters and face_detections
-- Without these, client-side face detection cannot insert results
-- and Clear & Re-run cannot delete existing data

DO $$
BEGIN
  -- INSERT policies
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own face_detections'
  ) THEN
    DROP POLICY IF EXISTS "Users can insert own face_detections" ON face_detections;
CREATE POLICY "Users can insert own face_detections"
      ON face_detections FOR INSERT TO authenticated
      WITH CHECK (gallery_id IN (SELECT id FROM galleries WHERE user_id = auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own face_clusters'
  ) THEN
    DROP POLICY IF EXISTS "Users can insert own face_clusters" ON face_clusters;
CREATE POLICY "Users can insert own face_clusters"
      ON face_clusters FOR INSERT TO authenticated
      WITH CHECK (gallery_id IN (SELECT id FROM galleries WHERE user_id = auth.uid()));
  END IF;

  -- DELETE policies
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own face_detections'
  ) THEN
    DROP POLICY IF EXISTS "Users can delete own face_detections" ON face_detections;
CREATE POLICY "Users can delete own face_detections"
      ON face_detections FOR DELETE TO authenticated
      USING (gallery_id IN (SELECT id FROM galleries WHERE user_id = auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own face_clusters'
  ) THEN
    DROP POLICY IF EXISTS "Users can delete own face_clusters" ON face_clusters;
CREATE POLICY "Users can delete own face_clusters"
      ON face_clusters FOR DELETE TO authenticated
      USING (gallery_id IN (SELECT id FROM galleries WHERE user_id = auth.uid()));
  END IF;
END $$;
