-- Phase A of the AI pipeline: store CLIP embeddings + aesthetic scores per image,
-- and ArcFace (512-d) face vectors on the existing face_detections table, then
-- cluster both by similarity. Reuses face_detections/face_clusters so the
-- existing face-search UI immediately benefits from the more accurate ArcFace
-- vectors.

CREATE EXTENSION IF NOT EXISTS vector;

-- ── Per-image features: CLIP embedding (clustering + tagging) + aesthetic score ──
CREATE TABLE IF NOT EXISTS image_features (
  image_id uuid PRIMARY KEY REFERENCES gallery_images(id) ON DELETE CASCADE,
  gallery_id uuid NOT NULL REFERENCES galleries(id) ON DELETE CASCADE,
  clip_vector vector(768),
  aesthetic real,             -- LAION aesthetic score, ~0–10
  visual_cluster int,         -- similarity group (filled by cluster_gallery_images)
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_image_features_gallery ON image_features(gallery_id);
CREATE INDEX IF NOT EXISTS idx_image_features_cluster ON image_features(gallery_id, visual_cluster);
CREATE INDEX IF NOT EXISTS idx_image_features_clip
  ON image_features USING ivfflat (clip_vector vector_cosine_ops) WITH (lists = 50);

ALTER TABLE image_features ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own image_features" ON image_features;
CREATE POLICY "Users view own image_features" ON image_features FOR SELECT
  USING (gallery_id IN (SELECT id FROM galleries WHERE user_id = auth.uid()));

-- ── ArcFace vectors on the existing face_detections (512-d, production-grade) ──
ALTER TABLE face_detections ADD COLUMN IF NOT EXISTS arcface_vector vector(512);
ALTER TABLE face_detections ADD COLUMN IF NOT EXISTS det_score real;
CREATE INDEX IF NOT EXISTS idx_face_detections_arcface
  ON face_detections USING ivfflat (arcface_vector vector_cosine_ops) WITH (lists = 20);

-- ── Gallery-level pipeline status ──
ALTER TABLE galleries
  ADD COLUMN IF NOT EXISTS pipeline_status text NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS pipeline_error text;

-- ── Cluster images by CLIP cosine similarity (greedy, best-aesthetic seeds first) ──
DROP FUNCTION IF EXISTS cluster_gallery_images(uuid, float);
CREATE OR REPLACE FUNCTION cluster_gallery_images(
  p_gallery_id uuid,
  p_threshold float DEFAULT 0.85
)
RETURNS int AS $$
DECLARE
  v_row RECORD;
  v_rep RECORD;
  v_sim float;
  v_best int;
  v_best_sim float;
  v_next int := 0;
BEGIN
  UPDATE image_features SET visual_cluster = NULL WHERE gallery_id = p_gallery_id;

  FOR v_row IN
    SELECT image_id, clip_vector
    FROM image_features
    WHERE gallery_id = p_gallery_id AND clip_vector IS NOT NULL
    ORDER BY aesthetic DESC NULLS LAST
  LOOP
    v_best := NULL;
    v_best_sim := p_threshold;

    -- Best-aesthetic member of each existing cluster acts as its exemplar.
    FOR v_rep IN
      SELECT DISTINCT ON (visual_cluster) visual_cluster, clip_vector
      FROM image_features
      WHERE gallery_id = p_gallery_id AND visual_cluster IS NOT NULL
      ORDER BY visual_cluster, aesthetic DESC NULLS LAST
    LOOP
      v_sim := 1 - (v_row.clip_vector <=> v_rep.clip_vector);
      IF v_sim >= v_best_sim THEN
        v_best_sim := v_sim;
        v_best := v_rep.visual_cluster;
      END IF;
    END LOOP;

    IF v_best IS NULL THEN
      UPDATE image_features SET visual_cluster = v_next WHERE image_id = v_row.image_id;
      v_next := v_next + 1;
    ELSE
      UPDATE image_features SET visual_cluster = v_best WHERE image_id = v_row.image_id;
    END IF;
  END LOOP;

  RETURN v_next;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── Cluster faces by ArcFace cosine similarity (exemplar = highest det_score) ──
DROP FUNCTION IF EXISTS cluster_gallery_faces_arcface(uuid, float);
CREATE OR REPLACE FUNCTION cluster_gallery_faces_arcface(
  p_gallery_id uuid,
  p_threshold float DEFAULT 0.5
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
    WHERE gallery_id = p_gallery_id AND arcface_vector IS NOT NULL
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

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
