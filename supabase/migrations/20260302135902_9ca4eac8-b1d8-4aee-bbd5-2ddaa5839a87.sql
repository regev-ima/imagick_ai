
-- Create a security definer function that checks gallery has client_link AND is NOT password-protected
CREATE OR REPLACE FUNCTION public.gallery_is_public(p_gallery_id uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.galleries
    WHERE id = p_gallery_id
      AND client_link IS NOT NULL
      AND (client_password IS NULL OR client_password = '')
  );
$$;

-- Update gallery_images: replace broad policy with one that excludes password-protected galleries
DROP POLICY IF EXISTS "Public can view gallery images via client link" ON public.gallery_images;

DROP POLICY IF EXISTS "Public can view non-protected gallery images" ON public.gallery_images;
CREATE POLICY "Public can view non-protected gallery images"
ON public.gallery_images FOR SELECT
USING (gallery_is_public(gallery_id));

-- Update image_edits: same fix
DROP POLICY IF EXISTS "Public can view image edits via client link" ON public.image_edits;

DROP POLICY IF EXISTS "Public can view image edits for non-protected galleries" ON public.image_edits;
CREATE POLICY "Public can view image edits for non-protected galleries"
ON public.image_edits FOR SELECT
USING (gallery_is_public(gallery_id));
