ALTER TABLE public.gallery_images
  ADD COLUMN IF NOT EXISTS processing_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_processing_error text,
  ADD COLUMN IF NOT EXISTS last_processing_attempt_at timestamptz;