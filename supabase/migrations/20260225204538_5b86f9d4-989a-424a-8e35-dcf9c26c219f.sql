
-- Deny anonymous users from updating gallery_images
DROP POLICY IF EXISTS "Anonymous cannot update gallery images" ON public.gallery_images;
CREATE POLICY "Anonymous cannot update gallery images"
ON public.gallery_images
FOR UPDATE
TO anon
USING (false);
