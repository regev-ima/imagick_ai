-- Add AI culling metrics columns to gallery_images table
ALTER TABLE public.gallery_images
ADD COLUMN IF NOT EXISTS background_sharpness numeric,
ADD COLUMN IF NOT EXISTS subject_sharpness numeric,
ADD COLUMN IF NOT EXISTS thirds_rule numeric,
ADD COLUMN IF NOT EXISTS intended_facial_expression numeric;

-- Add comment for documentation
COMMENT ON COLUMN public.gallery_images.background_sharpness IS 'AI-detected background sharpness score (0-1)';
COMMENT ON COLUMN public.gallery_images.subject_sharpness IS 'AI-detected subject sharpness score (0-1)';
COMMENT ON COLUMN public.gallery_images.thirds_rule IS 'AI-detected rule of thirds composition score (0-1)';
COMMENT ON COLUMN public.gallery_images.intended_facial_expression IS 'AI-detected facial expression score (-1, 0, 0.5, etc.)';