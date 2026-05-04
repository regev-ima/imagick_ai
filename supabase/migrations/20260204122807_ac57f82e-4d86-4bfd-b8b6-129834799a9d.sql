-- Create a security definer function to safely get public gallery data
-- This bypasses RLS to allow public access to galleries with client_link
DROP FUNCTION IF EXISTS public.get_public_gallery(TEXT);
CREATE OR REPLACE FUNCTION public.get_public_gallery(p_client_link TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  template TEXT,
  client_link TEXT,
  client_dark_mode BOOLEAN,
  download_enabled BOOLEAN,
  watermark_enabled BOOLEAN,
  hero_image_url TEXT,
  total_images INTEGER,
  expiry_date TIMESTAMPTZ,
  categories TEXT[],
  requires_password BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    g.id,
    g.name,
    g.description,
    g.template,
    g.client_link,
    g.client_dark_mode,
    g.download_enabled,
    g.watermark_enabled,
    g.hero_image_url,
    g.total_images,
    g.expiry_date,
    g.categories,
    (g.client_password IS NOT NULL AND g.client_password <> '') AS requires_password
  FROM galleries g
  WHERE g.client_link = p_client_link
    AND g.client_link IS NOT NULL;
$$;

-- Grant execute permission to anon and authenticated users
GRANT EXECUTE ON FUNCTION public.get_public_gallery(TEXT) TO anon, authenticated;