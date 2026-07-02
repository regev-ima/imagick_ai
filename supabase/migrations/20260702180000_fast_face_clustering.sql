-- Face clustering silently produced ZERO clusters on real galleries.
--
-- Root cause: the greedy loop re-queried every cluster's seed vector from
-- face_detections for EVERY detection (a LATERAL per cluster, per detection —
-- ~585k subquery evaluations for a 211-photo wedding) plus one UPDATE per
-- detection. That ran ~9s, which is past the ~8s statement timeout PostgREST
-- enforces on API calls — so the edge function's rpc() was cancelled, the
-- whole transaction rolled back to 0 clusters, and the gallery was marked
-- "ready" with no people. (A direct SQL invocation, which has a longer
-- timeout, produced 447 clusters from the very same data.)
--
-- Same algorithm, same results, but fast enough to fit comfortably:
--   • The comparison representative of a cluster is always its SEED (we insert
--     in det_score-descending order, and the old code picked the max-det_score
--     member — i.e. the seed). So cache seed vectors in a plpgsql array and
--     compare in memory instead of re-querying per detection.
--   • Batch the per-detection cluster assignments into ONE UPDATE via unnest,
--     and recompute face_count in ONE grouped UPDATE.
CREATE OR REPLACE FUNCTION cluster_gallery_faces_arcface(
  p_gallery_id uuid,
  p_threshold float DEFAULT 0.42
)
RETURNS int AS $$
DECLARE
  v_det RECORD;
  v_sim float;
  v_best int;
  v_best_sim float;
  v_cluster_id uuid;
  v_rep_ids  uuid[]   := '{}';  -- cluster id per seed, index-aligned with v_rep_vecs
  v_rep_vecs vector[] := '{}';  -- seed vector per cluster
  v_n int := 0;
  v_det_ids  uuid[] := '{}';    -- pending assignments (batched at the end)
  v_det_cids uuid[] := '{}';
  i int;
BEGIN
  DELETE FROM face_clusters WHERE gallery_id = p_gallery_id;
  UPDATE face_detections SET cluster_id = NULL
   WHERE gallery_id = p_gallery_id AND cluster_id IS NOT NULL;

  FOR v_det IN
    SELECT id, image_id, bounding_box, arcface_vector
    FROM face_detections
    WHERE gallery_id = p_gallery_id
      AND arcface_vector IS NOT NULL
      AND coalesce(det_score, 1) >= 0.5   -- drop weak/noise detections
    ORDER BY det_score DESC NULLS LAST
  LOOP
    v_best := NULL;
    v_best_sim := p_threshold;
    FOR i IN 1..v_n LOOP
      v_sim := 1 - (v_det.arcface_vector <=> v_rep_vecs[i]);
      IF v_sim >= v_best_sim THEN
        v_best_sim := v_sim;
        v_best := i;
      END IF;
    END LOOP;

    IF v_best IS NOT NULL THEN
      v_det_ids  := v_det_ids  || v_det.id;
      v_det_cids := v_det_cids || v_rep_ids[v_best];
    ELSE
      INSERT INTO face_clusters (gallery_id, representative_image_id, representative_bbox, face_count)
      VALUES (p_gallery_id, v_det.image_id, v_det.bounding_box, 0)
      RETURNING id INTO v_cluster_id;
      v_n := v_n + 1;
      v_rep_ids  := v_rep_ids  || v_cluster_id;
      v_rep_vecs := v_rep_vecs || v_det.arcface_vector;
      v_det_ids  := v_det_ids  || v_det.id;
      v_det_cids := v_det_cids || v_cluster_id;
    END IF;
  END LOOP;

  UPDATE face_detections d
     SET cluster_id = a.cid
    FROM unnest(v_det_ids, v_det_cids) AS a(did, cid)
   WHERE d.id = a.did;

  UPDATE face_clusters fc
     SET face_count = m.c
    FROM (SELECT cluster_id, count(*) AS c
            FROM face_detections
           WHERE gallery_id = p_gallery_id AND cluster_id IS NOT NULL
           GROUP BY cluster_id) m
   WHERE fc.id = m.cluster_id;

  -- Upgrade each seed to the best-quality face of that identity.
  PERFORM pick_cluster_representatives(p_gallery_id);

  RETURN v_n;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
