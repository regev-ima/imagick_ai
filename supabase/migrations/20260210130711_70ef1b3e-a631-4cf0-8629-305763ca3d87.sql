
ALTER TABLE public.gallery_images
  ADD COLUMN IF NOT EXISTS taken_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS file_size_bytes bigint,
  ADD COLUMN IF NOT EXISTS camera_make text,
  ADD COLUMN IF NOT EXISTS camera_model text,
  ADD COLUMN IF NOT EXISTS lens_model text,
  ADD COLUMN IF NOT EXISTS focal_length text,
  ADD COLUMN IF NOT EXISTS aperture text,
  ADD COLUMN IF NOT EXISTS shutter_speed text,
  ADD COLUMN IF NOT EXISTS iso integer;
