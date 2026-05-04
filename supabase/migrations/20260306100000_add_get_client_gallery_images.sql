-- SECURITY DEFINER RPC to fetch gallery images for client view
-- Bypasses RLS. Access control: gallery must have a client_link (shared).
-- Password protection is enforced at the frontend level (password screen).
CREATE OR REPLACE FUNCTION public.get_client_gallery_images(
  p_gallery_id uuid,
  p_session_token text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  original_url text,
  thumbnail_url text,
  is_liked boolean,
  filename text,
  ai_rating smallint,
  culling_label text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT gi.id, gi.original_url, gi.thumbnail_url, gi.is_liked,
         gi.filename, gi.ai_rating, gi.culling_label
  FROM gallery_images gi
  JOIN galleries g ON g.id = gi.gallery_id
  WHERE gi.gallery_id = p_gallery_id
    AND gi.status != 'deleted'
    AND g.client_link IS NOT NULL
  ORDER BY gi.sort_order ASC;
$$;
