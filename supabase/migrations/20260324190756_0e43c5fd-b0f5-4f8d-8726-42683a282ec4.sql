-- 1. Fix vector index: switch from cosine_ops to l2_ops
DROP INDEX IF EXISTS idx_face_detections_vector;
CREATE INDEX IF NOT EXISTS idx_face_detections_vector
  ON face_detections
  USING ivfflat (face_vector vector_l2_ops)
  WITH (lists = 20);

-- 2. Add missing UPDATE RLS policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own face_detections'
  ) THEN
    DROP POLICY IF EXISTS "Users can update own face_detections" ON face_detections;
CREATE POLICY "Users can update own face_detections"
      ON face_detections FOR UPDATE TO authenticated
      USING (gallery_id IN (SELECT id FROM galleries WHERE user_id = auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own face_clusters'
  ) THEN
    DROP POLICY IF EXISTS "Users can update own face_clusters" ON face_clusters;
CREATE POLICY "Users can update own face_clusters"
      ON face_clusters FOR UPDATE TO authenticated
      USING (gallery_id IN (SELECT id FROM galleries WHERE user_id = auth.uid()));
  END IF;
END $$;

-- 3. Recreate clustering function with SECURITY DEFINER and threshold 0.8
CREATE OR REPLACE FUNCTION cluster_gallery_faces(
  p_gallery_id uuid,
  p_distance_threshold float DEFAULT 0.8
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_detection RECORD;
  v_cluster_id uuid;
  v_best_cluster_id uuid;
  v_best_distance float;
  v_rep RECORD;
  v_distance float;
  v_cluster_count int := 0;
  v_total_detections int := 0;
  v_assigned_count int := 0;
BEGIN
  DELETE FROM face_clusters WHERE gallery_id = p_gallery_id;
  UPDATE face_detections SET cluster_id = NULL WHERE gallery_id = p_gallery_id;

  SELECT COUNT(*) INTO v_total_detections
  FROM face_detections
  WHERE gallery_id = p_gallery_id AND face_vector IS NOT NULL;

  RAISE LOG 'cluster_gallery_faces: gallery=%, detections_with_vectors=%', p_gallery_id, v_total_detections;

  FOR v_detection IN
    SELECT id, image_id, bounding_box, face_vector
    FROM face_detections
    WHERE gallery_id = p_gallery_id
      AND face_vector IS NOT NULL
    ORDER BY (bounding_box->>'width')::float * (bounding_box->>'height')::float DESC
  LOOP
    v_best_cluster_id := NULL;
    v_best_distance := 999;

    FOR v_rep IN
      SELECT fc.id AS cluster_id, fd.face_vector AS rep_vector
      FROM face_clusters fc
      JOIN face_detections fd ON fd.id = (
        SELECT id FROM face_detections
        WHERE cluster_id = fc.id AND face_vector IS NOT NULL
        ORDER BY (bounding_box->>'width')::float * (bounding_box->>'height')::float DESC
        LIMIT 1
      )
      WHERE fc.gallery_id = p_gallery_id
    LOOP
      v_distance := v_detection.face_vector <-> v_rep.rep_vector;

      IF v_distance < v_best_distance THEN
        v_best_distance := v_distance;
        v_best_cluster_id := v_rep.cluster_id;
      END IF;
    END LOOP;

    IF v_best_cluster_id IS NOT NULL AND v_best_distance < p_distance_threshold THEN
      UPDATE face_detections SET cluster_id = v_best_cluster_id WHERE id = v_detection.id;
      v_assigned_count := v_assigned_count + 1;
    ELSE
      INSERT INTO face_clusters (gallery_id, representative_image_id, representative_bbox, face_count)
      VALUES (p_gallery_id, v_detection.image_id, v_detection.bounding_box, 1)
      RETURNING id INTO v_cluster_id;

      UPDATE face_detections SET cluster_id = v_cluster_id WHERE id = v_detection.id;
      v_cluster_count := v_cluster_count + 1;
    END IF;
  END LOOP;

  RAISE LOG 'cluster_gallery_faces: clusters=%, assigned=%, threshold=%', v_cluster_count, v_assigned_count, p_distance_threshold;

  UPDATE face_clusters fc SET face_count = sub.cnt
  FROM (
    SELECT fd.cluster_id, COUNT(DISTINCT fd.image_id) AS cnt
    FROM face_detections fd
    WHERE fd.gallery_id = p_gallery_id AND fd.cluster_id IS NOT NULL
    GROUP BY fd.cluster_id
  ) sub
  WHERE fc.id = sub.cluster_id AND fc.gallery_id = p_gallery_id;

  UPDATE galleries SET
    face_search_status = 'completed',
    face_search_completed_at = now()
  WHERE id = p_gallery_id;

  RETURN v_cluster_count;
END;
$$;

-- 4. Debug function for inspecting L2 distances
CREATE OR REPLACE FUNCTION get_face_distances(p_gallery_id uuid)
RETURNS TABLE(face_a uuid, face_b uuid, image_a uuid, image_b uuid, distance float)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    a.id AS face_a,
    b.id AS face_b,
    a.image_id AS image_a,
    b.image_id AS image_b,
    (a.face_vector <-> b.face_vector)::float AS distance
  FROM face_detections a
  CROSS JOIN face_detections b
  WHERE a.gallery_id = p_gallery_id
    AND b.gallery_id = p_gallery_id
    AND a.face_vector IS NOT NULL
    AND b.face_vector IS NOT NULL
    AND a.id < b.id
  ORDER BY (a.face_vector <-> b.face_vector)
  LIMIT 100;
$$;