-- Step 1: Add selected_style_ids column to galleries table
ALTER TABLE public.galleries
  ADD COLUMN IF NOT EXISTS selected_style_ids uuid[] DEFAULT '{}';

-- Step 2: Migrate existing data from gallery_styles to the new column
UPDATE public.galleries g
SET selected_style_ids = (
  SELECT COALESCE(array_agg(gs.style_id), '{}')
  FROM public.gallery_styles gs
  WHERE gs.gallery_id = g.id
);

-- Step 3: Drop the gallery_styles table
DROP TABLE IF EXISTS public.gallery_styles;