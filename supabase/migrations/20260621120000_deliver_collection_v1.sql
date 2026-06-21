-- DELIVER v1 — the client-collection selection (the "which photos enter the
-- client link" gate). See docs/design/deliver-concept.md.
--
-- This slice is deliberately ADDITIVE and BACKWARD-COMPATIBLE:
--   * every new column is nullable, so existing rows are untouched;
--   * get_client_gallery_images honours the selection via COALESCE(...,true),
--     so a gallery whose owner has never curated still shows everything,
--     exactly as it does today;
--   * the publish gate (published_at) is provisioned and back-filled here but
--     NOT yet enforced in the RPCs — enforcing it before a "Publish" control
--     exists would make every newly created gallery dark and break the live
--     share flow. The gate is switched on in the slice that ships the publish
--     UI (see the rollout note in the spec).

-- 1. The selection + presentation columns on gallery_images ----------------
ALTER TABLE public.gallery_images
  ADD COLUMN IF NOT EXISTS in_collection   boolean,   -- true = delivered to client; NULL ⇒ legacy "everything"
  ADD COLUMN IF NOT EXISTS collection_sort integer,   -- client-facing order, distinct from editor sort_order
  ADD COLUMN IF NOT EXISTS section_id      uuid;      -- → collection_sections (v2)

COMMENT ON COLUMN public.gallery_images.in_collection IS
  'DELIVER: whether this image is in the published client collection. NULL is read as TRUE for backward compatibility.';

-- Partial index: the client RPC only ever scans the delivered set.
CREATE INDEX IF NOT EXISTS idx_gallery_images_in_collection
  ON public.gallery_images (gallery_id)
  WHERE in_collection IS DISTINCT FROM false;

-- 2. The publish gate + presentation settings on galleries -----------------
ALTER TABLE public.galleries
  ADD COLUMN IF NOT EXISTS published_at      timestamptz,  -- NULL = draft / dark (gate enforced in a later slice)
  ADD COLUMN IF NOT EXISTS last_published_at timestamptz,  -- for "you have unpublished changes"
  ADD COLUMN IF NOT EXISTS grouping_mode     text          -- flat | section | category | person  (v2)
    CHECK (grouping_mode IN ('flat','section','category','person'));

-- Back-fill: everything that exists today is already shared, so mark it
-- published. When the gate is switched on, nothing that is live goes dark.
UPDATE public.galleries
   SET published_at = COALESCE(published_at, created_at)
 WHERE client_link IS NOT NULL;

-- 3. Spotlight / hide a person in client face self-search ------------------
ALTER TABLE public.face_clusters
  ADD COLUMN IF NOT EXISTS is_spotlit boolean,  -- pin to the front of "find your photos"
  ADD COLUMN IF NOT EXISTS is_hidden  boolean;  -- drop from client self-search (frames stay in the collection)

-- 4. Honour the selection in the client image RPC -------------------------
--    Same signature and return columns as 20260307180338; the only changes are
--    the COALESCE(in_collection,true) predicate and the collection_sort order.
CREATE OR REPLACE FUNCTION public.get_client_gallery_images(
  p_gallery_id uuid,
  p_session_token text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  original_url text,
  thumbnail_url text,
  is_liked boolean,
  filename text,
  ai_rating smallint,
  culling_label text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT gi.id, gi.original_url, gi.thumbnail_url, gi.is_liked,
         gi.filename, gi.ai_rating, gi.culling_label
  FROM gallery_images gi
  JOIN galleries g ON g.id = gi.gallery_id
  WHERE gi.gallery_id = p_gallery_id
    AND gi.status != 'deleted'
    AND COALESCE(gi.in_collection, true) = true   -- DELIVER: only the curated selection
    AND g.client_link IS NOT NULL
    AND (
      (g.client_password IS NULL OR g.client_password = '')
      OR
      EXISTS (
        SELECT 1 FROM gallery_sessions gs
        WHERE gs.gallery_id = p_gallery_id
          AND gs.expires_at > now()
          AND (p_session_token IS NULL OR gs.session_token = p_session_token)
      )
    )
  ORDER BY COALESCE(gi.collection_sort, gi.sort_order) ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_client_gallery_images(uuid, text) TO anon, authenticated;
