
-- Create gallery_sessions table for password-protected gallery access
CREATE TABLE IF NOT EXISTS public.gallery_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gallery_id uuid NOT NULL REFERENCES public.galleries(id) ON DELETE CASCADE,
  session_token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

-- Enable RLS
ALTER TABLE public.gallery_sessions ENABLE ROW LEVEL SECURITY;

-- No public access to sessions table - only service role can manage
DROP POLICY IF EXISTS "No public access to gallery sessions" ON public.gallery_sessions;
CREATE POLICY "No public access to gallery sessions"
ON public.gallery_sessions FOR ALL
USING (false);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_gallery_sessions_token ON public.gallery_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_gallery_sessions_expires ON public.gallery_sessions(expires_at);

-- Add RLS policy: allow viewing password-protected gallery images if valid session exists
-- We need a security definer function for this
CREATE OR REPLACE FUNCTION public.gallery_has_valid_session(p_gallery_id uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.gallery_sessions
    WHERE gallery_id = p_gallery_id
      AND expires_at > now()
  );
$$;

-- Add policy for password-protected galleries with valid sessions
DROP POLICY IF EXISTS "Public can view password-protected gallery images with session" ON public.gallery_images;
CREATE POLICY "Public can view password-protected gallery images with session"
ON public.gallery_images FOR SELECT
USING (
  gallery_has_client_link(gallery_id)
  AND gallery_has_valid_session(gallery_id)
);

-- Same for image_edits
DROP POLICY IF EXISTS "Public can view password-protected image edits with session" ON public.image_edits;
CREATE POLICY "Public can view password-protected image edits with session"
ON public.image_edits FOR SELECT
USING (
  gallery_has_client_link(gallery_id)
  AND gallery_has_valid_session(gallery_id)
);
