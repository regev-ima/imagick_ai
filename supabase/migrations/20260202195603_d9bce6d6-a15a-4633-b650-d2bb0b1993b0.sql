-- Drop the overly permissive policy
DROP POLICY "Anyone can create client interactions" ON public.client_interactions;

-- Create a more restrictive policy that only allows inserts for galleries with client links
CREATE POLICY "Public can create interactions for shared galleries"
  ON public.client_interactions FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.galleries g 
    WHERE g.id = gallery_id AND g.client_link IS NOT NULL
  ));