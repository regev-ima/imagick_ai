
-- 1. Replace CHECK constraint to include 'pending' and 'deleted'
ALTER TABLE public.gallery_images DROP CONSTRAINT IF EXISTS gallery_images_status_check;
DO $$ BEGIN
  ALTER TABLE public.gallery_images ADD CONSTRAINT gallery_images_status_check
  CHECK (status = ANY (ARRAY['uploading','processing','ready','error','culled','pending','deleted']));
EXCEPTION WHEN duplicate_object OR duplicate_table OR unique_violation THEN NULL; END $$;

-- 2. Add deleted_at column
ALTER TABLE public.gallery_images ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 3. Index for trash queries
CREATE INDEX IF NOT EXISTS idx_gallery_images_deleted_at
  ON public.gallery_images (deleted_at)
  WHERE deleted_at IS NOT NULL;
