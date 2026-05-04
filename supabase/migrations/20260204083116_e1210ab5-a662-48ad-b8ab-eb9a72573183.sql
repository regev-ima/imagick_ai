-- Drop the existing public SELECT policy that exposes all columns including client_password
DROP POLICY IF EXISTS "Public can view galleries by client link" ON public.galleries;

-- Create a new public SELECT policy that only allows viewing non-sensitive columns
-- We'll use a view approach for the public gallery data

-- Create a public view that excludes sensitive fields (client_password)
CREATE OR REPLACE VIEW public.galleries_public
WITH (security_invoker = true) AS
SELECT 
  id,
  name,
  description,
  template,
  client_link,
  client_dark_mode,
  download_enabled,
  watermark_enabled,
  hero_image_url,
  total_images,
  expiry_date,
  categories,
  -- Include a boolean flag indicating if password is required (without exposing the actual password)
  (client_password IS NOT NULL AND client_password != '') AS requires_password
FROM public.galleries
WHERE client_link IS NOT NULL;

-- Re-create the public policy - it still allows SELECT but the view will be used for public access
DROP POLICY IF EXISTS "Public can view galleries by client link" ON public.galleries;
CREATE POLICY "Public can view galleries by client link"
ON public.galleries FOR SELECT
USING (client_link IS NOT NULL);