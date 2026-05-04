
-- Create image_edits table for multiple style edits per image
CREATE TABLE IF NOT EXISTS public.image_edits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  image_id uuid NOT NULL REFERENCES public.gallery_images(id) ON DELETE CASCADE,
  gallery_id uuid NOT NULL,
  user_id uuid NOT NULL,
  style_id uuid REFERENCES public.styles(id) ON DELETE SET NULL,
  style_name text,
  edited_url text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index for fast lookups by image
CREATE INDEX idx_image_edits_image_id ON public.image_edits(image_id);
CREATE INDEX idx_image_edits_gallery_id ON public.image_edits(gallery_id);

-- Enable RLS
ALTER TABLE public.image_edits ENABLE ROW LEVEL SECURITY;

-- SELECT: owner can view their own edits
DROP POLICY IF EXISTS "Users can view their own image edits" ON public.image_edits;
CREATE POLICY "Users can view their own image edits"
ON public.image_edits
FOR SELECT
USING (auth.uid() = user_id);

-- SELECT: public can view via client link (same pattern as gallery_images)
DROP POLICY IF EXISTS "Public can view image edits via client link" ON public.image_edits;
CREATE POLICY "Public can view image edits via client link"
ON public.image_edits
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM galleries g
  WHERE g.id = image_edits.gallery_id
  AND g.client_link IS NOT NULL
));

-- SELECT: admins can view all
DROP POLICY IF EXISTS "Admins can view all image edits" ON public.image_edits;
CREATE POLICY "Admins can view all image edits"
ON public.image_edits
FOR SELECT
USING (is_admin(auth.uid()));

-- No INSERT/UPDATE/DELETE policies for regular users - service role only (webhook writes)
