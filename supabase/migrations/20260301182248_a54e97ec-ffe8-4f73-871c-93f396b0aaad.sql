-- Drop the broad public RLS policy on galleries that exposes client_password hashes
-- The app uses get_public_gallery() RPC and galleries_public view for public access
DROP POLICY IF EXISTS "Public can view galleries by client link" ON public.galleries;