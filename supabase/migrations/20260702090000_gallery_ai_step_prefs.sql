-- Per-gallery defaults for the AI culling steps the photographer picks at creation
-- (mirrors the AICullingModal toggles). Grouping on by default; faces opt-in.
ALTER TABLE galleries
  ADD COLUMN IF NOT EXISTS ai_grouping_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ai_faces_enabled boolean NOT NULL DEFAULT false;
