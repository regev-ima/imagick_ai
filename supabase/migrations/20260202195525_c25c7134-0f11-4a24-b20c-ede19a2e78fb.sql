-- Create galleries table
CREATE TABLE IF NOT EXISTS public.galleries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'uploading' CHECK (status IN ('uploading', 'processing', 'culling', 'ready', 'error')),
  ai_culling_enabled BOOLEAN NOT NULL DEFAULT false,
  categories TEXT[] DEFAULT '{}',
  total_images INTEGER NOT NULL DEFAULT 0,
  processed_images INTEGER NOT NULL DEFAULT 0,
  hero_image_url TEXT,
  client_password TEXT,
  client_link TEXT UNIQUE,
  similarity_threshold NUMERIC DEFAULT 0.7
);

-- Create gallery_images table
CREATE TABLE IF NOT EXISTS public.gallery_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  gallery_id UUID NOT NULL REFERENCES public.galleries(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  original_url TEXT NOT NULL,
  edited_url TEXT,
  thumbnail_url TEXT,
  filename TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'uploading' CHECK (status IN ('uploading', 'processing', 'ready', 'error', 'culled')),
  ai_rating INTEGER CHECK (ai_rating >= 0 AND ai_rating <= 5),
  ai_tags TEXT[] DEFAULT '{}',
  category TEXT,
  is_liked BOOLEAN NOT NULL DEFAULT false,
  is_hero BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  width INTEGER,
  height INTEGER
);

-- Create styles table
CREATE TABLE IF NOT EXISTS public.styles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('importing', 'training', 'ready', 'error')),
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
  is_preset BOOLEAN NOT NULL DEFAULT false,
  thumbnail_url TEXT,
  category TEXT CHECK (category IN ('portrait', 'landscape', 'wedding', 'product', 'street', 'artistic', 'vintage', 'moody', 'bright', 'custom'))
);

-- Create gallery_styles junction table
CREATE TABLE IF NOT EXISTS public.gallery_styles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gallery_id UUID NOT NULL REFERENCES public.galleries(id) ON DELETE CASCADE,
  style_id UUID NOT NULL REFERENCES public.styles(id) ON DELETE CASCADE,
  UNIQUE(gallery_id, style_id)
);

-- Create client_interactions table for tracking client likes/feedback
CREATE TABLE IF NOT EXISTS public.client_interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  gallery_id UUID NOT NULL REFERENCES public.galleries(id) ON DELETE CASCADE,
  image_id UUID REFERENCES public.gallery_images(id) ON DELETE CASCADE,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN ('view', 'like', 'unlike', 'feedback', 'download', 'login')),
  client_name TEXT,
  feedback_text TEXT,
  ip_address TEXT
);

-- Enable RLS on all tables
ALTER TABLE public.galleries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.styles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery_styles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_interactions ENABLE ROW LEVEL SECURITY;

-- Galleries policies
DROP POLICY IF EXISTS "Users can view their own galleries" ON public.galleries;
CREATE POLICY "Users can view their own galleries"
  ON public.galleries FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own galleries" ON public.galleries;
CREATE POLICY "Users can create their own galleries"
  ON public.galleries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own galleries" ON public.galleries;
CREATE POLICY "Users can update their own galleries"
  ON public.galleries FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own galleries" ON public.galleries;
CREATE POLICY "Users can delete their own galleries"
  ON public.galleries FOR DELETE
  USING (auth.uid() = user_id);

-- Public can view galleries by client_link (for client gallery view)
DROP POLICY IF EXISTS "Public can view galleries by client link" ON public.galleries;
CREATE POLICY "Public can view galleries by client link"
  ON public.galleries FOR SELECT
  USING (client_link IS NOT NULL);

-- Gallery images policies
DROP POLICY IF EXISTS "Users can view their own gallery images" ON public.gallery_images;
CREATE POLICY "Users can view their own gallery images"
  ON public.gallery_images FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create gallery images" ON public.gallery_images;
CREATE POLICY "Users can create gallery images"
  ON public.gallery_images FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own gallery images" ON public.gallery_images;
CREATE POLICY "Users can update their own gallery images"
  ON public.gallery_images FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own gallery images" ON public.gallery_images;
CREATE POLICY "Users can delete their own gallery images"
  ON public.gallery_images FOR DELETE
  USING (auth.uid() = user_id);

-- Public can view images for galleries they have access to
DROP POLICY IF EXISTS "Public can view gallery images via client link" ON public.gallery_images;
CREATE POLICY "Public can view gallery images via client link"
  ON public.gallery_images FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.galleries g 
    WHERE g.id = gallery_id AND g.client_link IS NOT NULL
  ));

-- Styles policies
DROP POLICY IF EXISTS "Users can view their own styles" ON public.styles;
CREATE POLICY "Users can view their own styles"
  ON public.styles FOR SELECT
  USING (auth.uid() = user_id OR is_preset = true OR visibility = 'public');

DROP POLICY IF EXISTS "Users can create their own styles" ON public.styles;
CREATE POLICY "Users can create their own styles"
  ON public.styles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own styles" ON public.styles;
CREATE POLICY "Users can update their own styles"
  ON public.styles FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own styles" ON public.styles;
CREATE POLICY "Users can delete their own styles"
  ON public.styles FOR DELETE
  USING (auth.uid() = user_id);

-- Gallery styles policies
DROP POLICY IF EXISTS "Users can view their gallery styles" ON public.gallery_styles;
CREATE POLICY "Users can view their gallery styles"
  ON public.gallery_styles FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.galleries g WHERE g.id = gallery_id AND g.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can manage their gallery styles" ON public.gallery_styles;
CREATE POLICY "Users can manage their gallery styles"
  ON public.gallery_styles FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.galleries g WHERE g.id = gallery_id AND g.user_id = auth.uid()
  ));

-- Client interactions - public can insert
DROP POLICY IF EXISTS "Anyone can create client interactions" ON public.client_interactions;
CREATE POLICY "Anyone can create client interactions"
  ON public.client_interactions FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view interactions for their galleries" ON public.client_interactions;
CREATE POLICY "Users can view interactions for their galleries"
  ON public.client_interactions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.galleries g WHERE g.id = gallery_id AND g.user_id = auth.uid()
  ));

-- Create function to update timestamps
DROP FUNCTION IF EXISTS public.update_updated_at_column();
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for timestamp updates
DROP TRIGGER IF EXISTS update_galleries_updated_at ON public.galleries;
CREATE TRIGGER update_galleries_updated_at
  BEFORE UPDATE ON public.galleries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_gallery_images_updated_at ON public.gallery_images;
CREATE TRIGGER update_gallery_images_updated_at
  BEFORE UPDATE ON public.gallery_images
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_styles_updated_at ON public.styles;
CREATE TRIGGER update_styles_updated_at
  BEFORE UPDATE ON public.styles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for gallery images
INSERT INTO storage.buckets (id, name, public)
VALUES ('gallery-images', 'gallery-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for gallery images
DROP POLICY IF EXISTS "Users can upload their own gallery images" ON storage.objects;
CREATE POLICY "Users can upload their own gallery images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'gallery-images' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can update their own gallery images" ON storage.objects;
CREATE POLICY "Users can update their own gallery images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'gallery-images' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can delete their own gallery images" ON storage.objects;
CREATE POLICY "Users can delete their own gallery images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'gallery-images' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Gallery images are publicly viewable" ON storage.objects;
CREATE POLICY "Gallery images are publicly viewable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'gallery-images');

-- Generate unique client link function
DROP FUNCTION IF EXISTS public.generate_client_link();
CREATE OR REPLACE FUNCTION public.generate_client_link()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.client_link IS NULL THEN
    NEW.client_link = LOWER(REPLACE(NEW.name, ' ', '-')) || '-' || SUBSTRING(NEW.id::text, 1, 8);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS generate_gallery_client_link ON public.galleries;
CREATE TRIGGER generate_gallery_client_link
  BEFORE INSERT ON public.galleries
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_client_link();

-- Insert preset styles
INSERT INTO public.styles (user_id, name, description, is_preset, visibility, category, status)
VALUES 
  ('00000000-0000-0000-0000-000000000000', 'Classic Film', 'Timeless film-inspired look with warm tones', true, 'public', 'vintage', 'ready'),
  ('00000000-0000-0000-0000-000000000000', 'Moody Dark', 'Deep shadows and rich contrast', true, 'public', 'moody', 'ready'),
  ('00000000-0000-0000-0000-000000000000', 'Bright & Airy', 'Light and fresh with lifted shadows', true, 'public', 'bright', 'ready'),
  ('00000000-0000-0000-0000-000000000000', 'Vintage Fade', 'Nostalgic faded film aesthetic', true, 'public', 'vintage', 'ready'),
  ('00000000-0000-0000-0000-000000000000', 'Wedding Pro', 'Elegant and romantic tones', true, 'public', 'wedding', 'ready'),
  ('00000000-0000-0000-0000-000000000000', 'Portrait Master', 'Skin-tone optimized with soft bokeh', true, 'public', 'portrait', 'ready');