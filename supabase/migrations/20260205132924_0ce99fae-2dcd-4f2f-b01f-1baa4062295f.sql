-- Add culling columns to gallery_images table
ALTER TABLE public.gallery_images
ADD COLUMN IF NOT EXISTS culling_score numeric,
ADD COLUMN IF NOT EXISTS similarity_group_1 integer,
ADD COLUMN IF NOT EXISTS similarity_group_2 integer,
ADD COLUMN IF NOT EXISTS similarity_group_3 integer,
ADD COLUMN IF NOT EXISTS culling_label text;

-- Add culling_status column to galleries table
ALTER TABLE public.galleries
ADD COLUMN IF NOT EXISTS culling_status text DEFAULT 'idle';

-- Add comment to explain the columns
COMMENT ON COLUMN public.gallery_images.culling_score IS 'AI culling score between 0 and 1';
COMMENT ON COLUMN public.gallery_images.similarity_group_1 IS 'Loose similarity grouping (threshold ~0.7)';
COMMENT ON COLUMN public.gallery_images.similarity_group_2 IS 'Medium similarity grouping (threshold ~0.8)';
COMMENT ON COLUMN public.gallery_images.similarity_group_3 IS 'Strict similarity grouping (threshold ~0.9)';
COMMENT ON COLUMN public.gallery_images.culling_label IS 'Label from AI culling API (e.g., portrait, other)';
COMMENT ON COLUMN public.galleries.culling_status IS 'Status of AI culling: idle, processing, ready';