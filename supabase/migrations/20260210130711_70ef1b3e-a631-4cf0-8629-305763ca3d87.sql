
ALTER TABLE public.gallery_images
  ADD COLUMN taken_at timestamp with time zone,
  ADD COLUMN file_size_bytes bigint,
  ADD COLUMN camera_make text,
  ADD COLUMN camera_model text,
  ADD COLUMN lens_model text,
  ADD COLUMN focal_length text,
  ADD COLUMN aperture text,
  ADD COLUMN shutter_speed text,
  ADD COLUMN iso integer;
