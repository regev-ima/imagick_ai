-- Add sharing-related columns to galleries table
ALTER TABLE public.galleries 
ADD COLUMN IF NOT EXISTS template text DEFAULT 'elegant',
ADD COLUMN IF NOT EXISTS client_dark_mode boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS download_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS watermark_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS expiry_date timestamp with time zone DEFAULT NULL;

-- Create table for invited clients
CREATE TABLE IF NOT EXISTS public.gallery_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gallery_id uuid REFERENCES public.galleries(id) ON DELETE CASCADE NOT NULL,
  email text NOT NULL,
  client_name text,
  sent_at timestamp with time zone,
  viewed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE(gallery_id, email)
);

-- Enable RLS
ALTER TABLE public.gallery_invites ENABLE ROW LEVEL SECURITY;

-- RLS policies for gallery_invites
DROP POLICY IF EXISTS "Users can manage their gallery invites" ON public.gallery_invites;
CREATE POLICY "Users can manage their gallery invites"
ON public.gallery_invites
FOR ALL
USING (EXISTS (
  SELECT 1 FROM galleries g
  WHERE g.id = gallery_invites.gallery_id 
  AND g.user_id = auth.uid()
));

DROP POLICY IF EXISTS "Users can view their gallery invites" ON public.gallery_invites;
CREATE POLICY "Users can view their gallery invites"
ON public.gallery_invites
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM galleries g
  WHERE g.id = gallery_invites.gallery_id 
  AND g.user_id = auth.uid()
));