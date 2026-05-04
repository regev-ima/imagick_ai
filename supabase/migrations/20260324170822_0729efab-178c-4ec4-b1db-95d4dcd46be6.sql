CREATE OR REPLACE FUNCTION cluster_gallery_faces(
  p_gallery_id uuid,
  p_similarity_threshold float DEFAULT 0.6
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_detection RECORD;
  v_cluster_id uuid;
  v_best_cluster_id uuid;
  v_best_similarity float;
  v_rep RECORD;
  v_similarity float;
  v_cluster_count int := 0;
BEGIN
  DELETE FROM face_clusters WHERE gallery_id = p_gallery_id;
  UPDATE face_detections SET cluster_id = NULL WHERE gallery_id = p_gallery_id;

  FOR v_detection IN
    SELECT id, image_id, bounding_box, face_vector
    FROM face_detections
    WHERE gallery_id = p_gallery_id
      AND face_vector IS NOT NULL
    ORDER BY (bounding_box->>'width')::float * (bounding_box->>'height')::float DESC
  LOOP
    v_best_cluster_id := NULL;
    v_best_similarity := 0;

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
      v_similarity := 1 - (v_detection.face_vector <=> v_rep.rep_vector);
      IF v_similarity > v_best_similarity THEN
        v_best_similarity := v_similarity;
        v_best_cluster_id := v_rep.cluster_id;
      END IF;
    END LOOP;

    IF v_best_cluster_id IS NOT NULL AND v_best_similarity >= p_similarity_threshold THEN
      UPDATE face_detections SET cluster_id = v_best_cluster_id WHERE id = v_detection.id;
      UPDATE face_clusters SET face_count = face_count + 1 WHERE id = v_best_cluster_id;
    ELSE
      INSERT INTO face_clusters (gallery_id, representative_image_id, representative_bbox, face_count)
      VALUES (p_gallery_id, v_detection.image_id, v_detection.bounding_box, 1)
      RETURNING id INTO v_cluster_id;

      UPDATE face_detections SET cluster_id = v_cluster_id WHERE id = v_detection.id;
      v_cluster_count := v_cluster_count + 1;
    END IF;
  END LOOP;

  UPDATE galleries SET
    face_search_status = 'completed',
    face_search_completed_at = now()
  WHERE id = p_gallery_id;

  RETURN v_cluster_count;
END;
$$;