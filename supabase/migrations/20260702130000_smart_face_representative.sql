-- Smarter face clustering + representative selection.
--
-- Two problems this addresses:
--   1. The representative face for each person was whichever detection happened
--      to seed the cluster (highest det_score only) — often a small, soft, or
--      eyes-closed face. We now pick the CLEANEST/CLEAREST face per person using
--      a weighted quality score over signals we already store (no extra AI).
--   2. The greedy cosine threshold of 0.5 over-split identities (a single person
--      photographed at varied angles/lighting spawned many clusters — e.g. 555
--      "people" in one wedding). We lower it slightly and drop weak/noise
--      detections before they can seed junk singleton clusters.

-- ── Pick the best representative face per cluster ─────────────────────────────
-- Idempotent UPDATE: safe to run after clustering AND again after the VLM culling
-- columns land (sharpness/eyes/exposure), which upgrades the pick for free.
--
-- Score per detection d (joined to its image g):
--   size    — bigger face = a crisp, non-pixelated thumbnail (biggest lever)
--   det     — detector confidence
--   sharp   — subject_sharpness (in focus)
--   eyes    — eyes open
--   frontal — looking at camera
--   cull    — overall keeper quality
-- Image-level VLM signals describe the whole frame, so we TRUST them fully only
-- for solo shots (people_count <= 1) and damp them in group shots; the
-- face-level signals (size, det_score) stay reliable everywhere. Hard blur/
-- exposure issues multiply the score down; hero/keeper add small tiebreaks.
CREATE OR REPLACE FUNCTION pick_cluster_representatives(p_gallery_id uuid)
RETURNS int AS $$
  WITH ranked AS (
    SELECT DISTINCT ON (d.cluster_id)
           d.cluster_id, d.image_id, d.bounding_box
    FROM face_detections d
    JOIN gallery_images g ON g.id = d.image_id
    WHERE d.gallery_id = p_gallery_id
      AND d.cluster_id IS NOT NULL
      AND d.bounding_box IS NOT NULL
    ORDER BY d.cluster_id,
      (
          0.25 * least(1.0, sqrt(
                 greatest(0, (d.bounding_box->>'width')::float) *
                 greatest(0, (d.bounding_box->>'height')::float)) / 300.0)
        + 0.15 * greatest(0, least(1, (coalesce(d.det_score, 0.5) - 0.4) / 0.6))
        + (CASE WHEN coalesce(g.people_count, 1) <= 1 THEN 1.0 ELSE 0.4 END) * (
              0.20 * coalesce(g.subject_sharpness, 0.5)
            + 0.15 * (CASE g.eyes_status WHEN 'open' THEN 1.0 WHEN 'mixed' THEN 0.6
                                         WHEN 'none' THEN 0.3 WHEN 'closed' THEN 0.0 ELSE 0.5 END)
            + 0.10 * (CASE WHEN g.looking_at_camera THEN 1.0
                           WHEN g.looking_at_camera IS FALSE THEN 0.3 ELSE 0.6 END)
            + 0.10 * coalesce(g.culling_score, 0.5))
      )
      * (CASE WHEN g.has_blur_issue THEN 0.5 ELSE 1 END)
      * (CASE WHEN g.has_exposure_issue THEN 0.85 ELSE 1 END)
      + (CASE WHEN g.ai_hero_candidate THEN 0.05 ELSE 0 END)
      + (CASE WHEN g.is_keeper THEN 0.03 ELSE 0 END)
      DESC NULLS LAST
  )
  UPDATE face_clusters fc
     SET representative_image_id = r.image_id,
         representative_bbox     = r.bounding_box
    FROM ranked r
   WHERE fc.id = r.cluster_id;
  SELECT count(*)::int FROM face_clusters WHERE gallery_id = p_gallery_id;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- ── Cluster faces by ArcFace cosine similarity (tighter + noise-gated) ────────
-- Changes vs the previous version:
--   • p_threshold default 0.5 → 0.42 (0.5 over-split real identities).
--   • Skip weak detections (det_score < 0.5) so partial/false faces don't seed
--     junk singleton clusters.
-- NOTE: the threshold is deliberately tunable — if distinct people start merging,
-- raise it back toward 0.5; if one person still splits, lower it toward 0.38.
DROP FUNCTION IF EXISTS cluster_gallery_faces_arcface(uuid, float);
CREATE OR REPLACE FUNCTION cluster_gallery_faces_arcface(
  p_gallery_id uuid,
  p_threshold float DEFAULT 0.42
)
RETURNS int AS $$
DECLARE
  v_det RECORD;
  v_rep RECORD;
  v_sim float;
  v_best_cluster uuid;
  v_best_sim float;
  v_cluster_id uuid;
  v_count int := 0;
BEGIN
  DELETE FROM face_clusters WHERE gallery_id = p_gallery_id;
  UPDATE face_detections SET cluster_id = NULL WHERE gallery_id = p_gallery_id;

  FOR v_det IN
    SELECT id, image_id, bounding_box, arcface_vector
    FROM face_detections
    WHERE gallery_id = p_gallery_id
      AND arcface_vector IS NOT NULL
      AND coalesce(det_score, 1) >= 0.5   -- drop weak/noise detections
    ORDER BY det_score DESC NULLS LAST
  LOOP
    v_best_cluster := NULL;
    v_best_sim := p_threshold;

    FOR v_rep IN
      SELECT fc.id AS cluster_id, fd.arcface_vector AS rep_vector
      FROM face_clusters fc
      JOIN LATERAL (
        SELECT arcface_vector FROM face_detections
        WHERE cluster_id = fc.id AND arcface_vector IS NOT NULL
        ORDER BY det_score DESC NULLS LAST
        LIMIT 1
      ) fd ON true
      WHERE fc.gallery_id = p_gallery_id
    LOOP
      v_sim := 1 - (v_det.arcface_vector <=> v_rep.rep_vector);
      IF v_sim >= v_best_sim THEN
        v_best_sim := v_sim;
        v_best_cluster := v_rep.cluster_id;
      END IF;
    END LOOP;

    IF v_best_cluster IS NOT NULL THEN
      UPDATE face_detections SET cluster_id = v_best_cluster WHERE id = v_det.id;
      UPDATE face_clusters SET face_count = face_count + 1 WHERE id = v_best_cluster;
    ELSE
      INSERT INTO face_clusters (gallery_id, representative_image_id, representative_bbox, face_count)
      VALUES (p_gallery_id, v_det.image_id, v_det.bounding_box, 1)
      RETURNING id INTO v_cluster_id;
      UPDATE face_detections SET cluster_id = v_cluster_id WHERE id = v_det.id;
      v_count := v_count + 1;
    END IF;
  END LOOP;

  -- Upgrade each seed to the best-quality face of that identity.
  PERFORM pick_cluster_representatives(p_gallery_id);

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
