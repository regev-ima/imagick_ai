-- Face Search Feature: tables for face detection and clustering

-- face_clusters: one row per person-group per gallery
CREATE TABLE face_clusters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gallery_id uuid NOT NULL REFERENCES galleries(id) ON DELETE CASCADE,
  representative_image_id uuid REFERENCES gallery_images(id) ON DELETE SET NULL,
  representative_bbox jsonb,
  face_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_face_clusters_gallery ON face_clusters(gallery_id);

-- face_detections: one row per detected face per image
CREATE TABLE face_detections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_id uuid NOT NULL REFERENCES gallery_images(id) ON DELETE CASCADE,
  gallery_id uuid NOT NULL REFERENCES galleries(id) ON DELETE CASCADE,
  cluster_id uuid REFERENCES face_clusters(id) ON DELETE SET NULL,
  bounding_box jsonb NOT NULL,
  azure_face_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_face_detections_gallery ON face_detections(gallery_id);
CREATE INDEX idx_face_detections_image ON face_detections(image_id);
CREATE INDEX idx_face_detections_cluster ON face_detections(cluster_id);

-- Gallery status columns for face search (mirrors culling_status pattern)
ALTER TABLE galleries
  ADD COLUMN IF NOT EXISTS face_search_status text NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS face_search_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS face_search_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS face_search_error text;

-- RLS policies
ALTER TABLE face_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE face_detections ENABLE ROW LEVEL SECURITY;

-- Owner can read their own clusters/detections
CREATE POLICY "Users can view own face_clusters"
  ON face_clusters FOR SELECT
  USING (gallery_id IN (SELECT id FROM galleries WHERE user_id = auth.uid()));

CREATE POLICY "Users can view own face_detections"
  ON face_detections FOR SELECT
  USING (gallery_id IN (SELECT id FROM galleries WHERE user_id = auth.uid()));

-- Public read for client gallery (guests browsing face clusters)
CREATE POLICY "Public can view face_clusters"
  ON face_clusters FOR SELECT USING (true);

CREATE POLICY "Public can view face_detections"
  ON face_detections FOR SELECT USING (true);
