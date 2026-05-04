-- Fix security issues: Remove public access to galleries table that exposes client_password and user_id
-- Force all public access through the galleries_public view which excludes sensitive fields

-- Drop the overly permissive policy that exposes sensitive data
DROP POLICY IF EXISTS "Public can view galleries by client link" ON public.galleries;

-- The galleries_public view already exists and correctly excludes:
-- - client_password (the plaintext password)
-- - user_id (photographer identity)
-- - Other sensitive fields

-- All public access should now go through galleries_public view
-- Owner access remains through "Users can view their own galleries" policy