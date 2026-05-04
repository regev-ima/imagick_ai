CREATE OR REPLACE FUNCTION cluster_gallery_faces(
  p_gallery_id uuid,
  p_distance_threshold float DEFAULT 0.6
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

  RAISE LOG 'cluster_gallery_faces: gallery=%, detections=%, threshold=%', p_gallery_id, v_total_detections, p_distance_threshold;

  FOR v_detection IN
    SELECT id, image_id, bounding_box, face_vector
    FROM face_detections
    WHERE gallery_id = p_gallery_id AND face_vector IS NOT NULL
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

  RAISE LOG 'cluster_gallery_faces: new_clusters=%, assigned_to_existing=%', v_cluster_count, v_assigned_count;

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