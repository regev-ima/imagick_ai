-- Create a security definer function to resolve short links to client links
-- This bypasses RLS to allow public access to short link resolution
DROP FUNCTION IF EXISTS public.resolve_short_link(TEXT);
CREATE OR REPLACE FUNCTION public.resolve_short_link(p_short_id TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT g.client_link
  FROM galleries g
  WHERE (g.client_link ILIKE '%' || '-' || p_short_id)
     OR (g.id::text ILIKE p_short_id || '%')
  LIMIT 1;
$$;

-- Grant execute permission to anon and authenticated users
GRANT EXECUTE ON FUNCTION public.resolve_short_link(TEXT) TO anon, authenticated;