-- Extra per-photo signals produced by the VLM culling pass (near-zero extra cost).
-- Used for filtering (eyes/keeper/hero) and the image details panel.
ALTER TABLE gallery_images
  ADD COLUMN IF NOT EXISTS eyes_status text,             -- 'open' | 'closed' | 'mixed' | 'none'
  ADD COLUMN IF NOT EXISTS expression text,              -- one-word mood
  ADD COLUMN IF NOT EXISTS looking_at_camera boolean,
  ADD COLUMN IF NOT EXISTS is_keeper boolean,            -- pro would keep it in the final selection
  ADD COLUMN IF NOT EXISTS ai_hero_candidate boolean,   -- VLM cover/hero suggestion (distinct from the manual is_hero)
  ADD COLUMN IF NOT EXISTS has_blur_issue boolean,       -- UNINTENDED blur / soft focus
  ADD COLUMN IF NOT EXISTS has_exposure_issue boolean,   -- over / under exposed
  ADD COLUMN IF NOT EXISTS people_count integer;
