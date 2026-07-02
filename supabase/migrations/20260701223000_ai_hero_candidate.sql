-- The prior migration originally tried to add `is_hero`, which already exists as
-- the photographer's MANUAL hero flag. The VLM's cover/hero suggestion must live
-- in its own column so culling never overwrites a manual choice. Idempotent add
-- for projects where the earlier migration had already run.
ALTER TABLE gallery_images
  ADD COLUMN IF NOT EXISTS ai_hero_candidate boolean;
