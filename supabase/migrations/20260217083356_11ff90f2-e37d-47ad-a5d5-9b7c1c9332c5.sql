
-- Create a security definer function to check if a gallery has a client_link
-- This bypasses RLS on galleries so the check works for non-owner users
CREATE OR REPLACE FUNCTION public.gallery_has_client_link(p_gallery_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.galleries
    WHERE id = p_gallery_id AND client_link IS NOT NULL
  );
$$;

-- Drop old policies that use subqueries against galleries
DROP POLICY IF EXISTS "Public can view image edits via client link" ON public.image_edits;
DROP POLICY IF EXISTS "Public can view gallery images via client link" ON public.gallery_images;

-- Recreate with security definer function
CREATE POLICY "Public can view image edits via client link"
  ON public.image_edits
  FOR SELECT
  USING (public.gallery_has_client_link(gallery_id));

CREATE POLICY "Public can view gallery images via client link"
  ON public.gallery_images
  FOR SELECT
  USING (public.gallery_has_client_link(gallery_id));
