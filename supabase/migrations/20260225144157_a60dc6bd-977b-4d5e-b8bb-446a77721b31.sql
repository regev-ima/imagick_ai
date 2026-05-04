
CREATE OR REPLACE FUNCTION public.get_images_missing_edits(
  p_gallery_id uuid,
  p_style_ids uuid[],
  p_limit integer DEFAULT 300
)
RETURNS TABLE(id uuid, original_url text, filename text, processing_attempts integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT gi.id, gi.original_url, gi.filename, gi.processing_attempts
  FROM gallery_images gi
  WHERE gi.gallery_id = p_gallery_id
    AND gi.status = 'ready'
    AND NOT EXISTS (
      SELECT 1 FROM image_edits ie
      WHERE ie.image_id = gi.id
        AND ie.style_id = ANY(p_style_ids)
    )
  ORDER BY gi.processing_attempts ASC, gi.id ASC
  LIMIT p_limit;
$$;

CREATE OR REPLACE FUNCTION public.count_images_missing_edits(
  p_gallery_id uuid,
  p_style_ids uuid[]
)
RETURNS bigint
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COUNT(*)
  FROM gallery_images gi
  WHERE gi.gallery_id = p_gallery_id
    AND gi.status = 'ready'
    AND NOT EXISTS (
      SELECT 1 FROM image_edits ie
      WHERE ie.image_id = gi.id
        AND ie.style_id = ANY(p_style_ids)
    );
$$;
