-- Per-stage timing for a gallery's pipeline run (download / CLIP / faces / wall),
-- so the UI can show how long each part took.
ALTER TABLE galleries
  ADD COLUMN IF NOT EXISTS pipeline_timing jsonb;
