
-- Drop the broken RLS policy on gallery_images that uses gallery_has_valid_session
DROP POLICY IF EXISTS "Public can view password-protected gallery images with session" ON public.gallery_images;

-- Drop the broken RLS policy on image_edits that uses gallery_has_valid_session
DROP POLICY IF EXISTS "Public can view password-protected image edits with session" ON public.image_edits;

-- Drop the broken function
DROP FUNCTION IF EXISTS public.gallery_has_valid_session(uuid);
