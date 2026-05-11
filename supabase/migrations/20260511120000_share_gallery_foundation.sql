-- ============================================================================
-- Share Gallery Rebuild — Phase 1 Foundation
-- ============================================================================
-- New columns + tables for: brand customization, expiry/kill-switch,
-- selection workflow, per-image share, dwell analytics, vendor links.
-- See docs/plans/share-gallery-rebuild.md for the full plan.
-- ============================================================================


-- 1. Extend galleries with brand, intro, selection, gating, kill-switch fields
ALTER TABLE public.galleries
  ADD COLUMN IF NOT EXISTS brand_logo_url TEXT,
  ADD COLUMN IF NOT EXISTS brand_primary_color TEXT,
  ADD COLUMN IF NOT EXISTS brand_accent_color TEXT,
  ADD COLUMN IF NOT EXISTS brand_font_pair TEXT DEFAULT 'playfair-inter',
  ADD COLUMN IF NOT EXISTS custom_domain TEXT,
  ADD COLUMN IF NOT EXISTS intro_mode TEXT NOT NULL DEFAULT 'cinema'
    CHECK (intro_mode IN ('none', 'cinema')),
  ADD COLUMN IF NOT EXISTS intro_music_url TEXT,
  ADD COLUMN IF NOT EXISTS selection_mode_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS selection_target_count INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS email_gate_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dual_gallery_mode TEXT NOT NULL DEFAULT 'off'
    CHECK (dual_gallery_mode IN ('off', 'religious_secular')),
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS share_secret TEXT;

-- Backfill share_secret for existing galleries
UPDATE public.galleries
SET share_secret = encode(gen_random_bytes(12), 'hex')
WHERE share_secret IS NULL;


-- 2. Extend gallery_images with heatmap denorms + AI flag + modest flag
ALTER TABLE public.gallery_images
  ADD COLUMN IF NOT EXISTS is_modest BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dwell_seconds_sum INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS client_favorite_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_ai_suggested BOOLEAN NOT NULL DEFAULT false;


-- 3. gallery_brand_assets — reusable brand presets per photographer
CREATE TABLE IF NOT EXISTS public.gallery_brand_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Default brand',
  logo_url TEXT,
  primary_color TEXT,
  accent_color TEXT,
  font_pair TEXT DEFAULT 'playfair-inter',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.gallery_brand_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own brand assets" ON public.gallery_brand_assets;
CREATE POLICY "Users manage own brand assets"
  ON public.gallery_brand_assets
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_brand_assets_user ON public.gallery_brand_assets(user_id);


-- 4. gallery_selections — persistent client selections (album picks)
CREATE TABLE IF NOT EXISTS public.gallery_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gallery_id UUID NOT NULL REFERENCES public.galleries(id) ON DELETE CASCADE,
  image_id UUID NOT NULL REFERENCES public.gallery_images(id) ON DELETE CASCADE,
  client_email TEXT,
  client_name TEXT,
  selected BOOLEAN NOT NULL DEFAULT true,
  note TEXT,
  session_token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (gallery_id, image_id, client_email)
);

ALTER TABLE public.gallery_selections ENABLE ROW LEVEL SECURITY;

-- Photographer can see all selections on their galleries
DROP POLICY IF EXISTS "Owners read selections" ON public.gallery_selections;
CREATE POLICY "Owners read selections"
  ON public.gallery_selections
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.galleries g
    WHERE g.id = gallery_selections.gallery_id
      AND g.user_id = auth.uid()
  ));

-- Public can insert / update their own selections (validated via RPC in practice)
DROP POLICY IF EXISTS "Public insert selections on shared galleries" ON public.gallery_selections;
CREATE POLICY "Public insert selections on shared galleries"
  ON public.gallery_selections
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.galleries g
    WHERE g.id = gallery_selections.gallery_id
      AND g.client_link IS NOT NULL
      AND g.revoked_at IS NULL
  ));

DROP POLICY IF EXISTS "Public update own selections" ON public.gallery_selections;
CREATE POLICY "Public update own selections"
  ON public.gallery_selections
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.galleries g
    WHERE g.id = gallery_selections.gallery_id
      AND g.client_link IS NOT NULL
      AND g.revoked_at IS NULL
  ));

CREATE INDEX IF NOT EXISTS idx_selections_gallery ON public.gallery_selections(gallery_id);
CREATE INDEX IF NOT EXISTS idx_selections_image ON public.gallery_selections(image_id);
CREATE INDEX IF NOT EXISTS idx_selections_client ON public.gallery_selections(gallery_id, client_email);


-- 5. gallery_share_events — track every share action for viral analytics
CREATE TABLE IF NOT EXISTS public.gallery_share_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gallery_id UUID NOT NULL REFERENCES public.galleries(id) ON DELETE CASCADE,
  image_id UUID REFERENCES public.gallery_images(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email', 'copy', 'instagram', 'facebook', 'twitter', 'other')),
  session_token TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.gallery_share_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners read share events" ON public.gallery_share_events;
CREATE POLICY "Owners read share events"
  ON public.gallery_share_events
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.galleries g
    WHERE g.id = gallery_share_events.gallery_id
      AND g.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Public insert share events on shared galleries" ON public.gallery_share_events;
CREATE POLICY "Public insert share events on shared galleries"
  ON public.gallery_share_events
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.galleries g
    WHERE g.id = gallery_share_events.gallery_id
      AND g.client_link IS NOT NULL
      AND g.revoked_at IS NULL
  ));

CREATE INDEX IF NOT EXISTS idx_share_events_gallery ON public.gallery_share_events(gallery_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_share_events_image ON public.gallery_share_events(image_id);


-- 6. gallery_audit_log — every meaningful event for forensics + Insights
CREATE TABLE IF NOT EXISTS public.gallery_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gallery_id UUID NOT NULL REFERENCES public.galleries(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  country_code TEXT,
  session_token TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.gallery_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners read audit log" ON public.gallery_audit_log;
CREATE POLICY "Owners read audit log"
  ON public.gallery_audit_log
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.galleries g
    WHERE g.id = gallery_audit_log.gallery_id
      AND g.user_id = auth.uid()
  ));

-- No public insert policy — writes happen via security-definer RPC / edge functions

CREATE INDEX IF NOT EXISTS idx_audit_log_gallery ON public.gallery_audit_log(gallery_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_event ON public.gallery_audit_log(event_type);


-- 7. gallery_vendor_links — scoped sub-links for planners/venues/florists
CREATE TABLE IF NOT EXISTS public.gallery_vendor_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gallery_id UUID NOT NULL REFERENCES public.galleries(id) ON DELETE CASCADE,
  vendor_name TEXT NOT NULL,
  vendor_email TEXT,
  scope_filter JSONB NOT NULL DEFAULT '{}'::jsonb,
  share_token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

ALTER TABLE public.gallery_vendor_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage vendor links" ON public.gallery_vendor_links;
CREATE POLICY "Owners manage vendor links"
  ON public.gallery_vendor_links
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.galleries g
    WHERE g.id = gallery_vendor_links.gallery_id
      AND g.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.galleries g
    WHERE g.id = gallery_vendor_links.gallery_id
      AND g.user_id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS idx_vendor_links_gallery ON public.gallery_vendor_links(gallery_id);
CREATE INDEX IF NOT EXISTS idx_vendor_links_token ON public.gallery_vendor_links(share_token);


-- 8. Upgrade get_public_gallery RPC to return new brand + intro + selection
--    fields and enforce expiry + kill-switch.
DROP FUNCTION IF EXISTS public.get_public_gallery(TEXT);
CREATE OR REPLACE FUNCTION public.get_public_gallery(p_client_link TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  template TEXT,
  client_link TEXT,
  client_dark_mode BOOLEAN,
  download_enabled BOOLEAN,
  watermark_enabled BOOLEAN,
  hero_image_url TEXT,
  total_images INTEGER,
  expiry_date TIMESTAMPTZ,
  categories TEXT[],
  requires_password BOOLEAN,
  brand_logo_url TEXT,
  brand_primary_color TEXT,
  brand_accent_color TEXT,
  brand_font_pair TEXT,
  intro_mode TEXT,
  intro_music_url TEXT,
  selection_mode_enabled BOOLEAN,
  selection_target_count INTEGER,
  email_gate_enabled BOOLEAN,
  dual_gallery_mode TEXT,
  share_secret TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    g.id,
    g.name,
    g.description,
    g.template,
    g.client_link,
    g.client_dark_mode,
    g.download_enabled,
    g.watermark_enabled,
    g.hero_image_url,
    g.total_images,
    g.expiry_date,
    g.categories,
    (g.client_password IS NOT NULL AND g.client_password <> '') AS requires_password,
    g.brand_logo_url,
    g.brand_primary_color,
    g.brand_accent_color,
    g.brand_font_pair,
    g.intro_mode,
    g.intro_music_url,
    g.selection_mode_enabled,
    g.selection_target_count,
    g.email_gate_enabled,
    g.dual_gallery_mode,
    g.share_secret
  FROM galleries g
  WHERE g.client_link = p_client_link
    AND g.client_link IS NOT NULL
    AND g.revoked_at IS NULL
    AND (g.expiry_date IS NULL OR g.expiry_date > now());
$$;

GRANT EXECUTE ON FUNCTION public.get_public_gallery(TEXT) TO anon, authenticated;


-- 9. RPC for clients to submit/toggle a selection
CREATE OR REPLACE FUNCTION public.client_toggle_selection(
  p_gallery_id UUID,
  p_image_id UUID,
  p_client_email TEXT,
  p_client_name TEXT,
  p_selected BOOLEAN,
  p_note TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max INTEGER;
  v_current INTEGER;
  v_id UUID;
BEGIN
  -- Check gallery is shareable
  IF NOT EXISTS (
    SELECT 1 FROM galleries
    WHERE id = p_gallery_id
      AND client_link IS NOT NULL
      AND revoked_at IS NULL
      AND (expiry_date IS NULL OR expiry_date > now())
  ) THEN
    RAISE EXCEPTION 'Gallery is not available';
  END IF;

  -- Enforce selection cap when turning ON
  IF p_selected THEN
    SELECT selection_target_count INTO v_max
    FROM galleries WHERE id = p_gallery_id;

    SELECT COUNT(*) INTO v_current
    FROM gallery_selections
    WHERE gallery_id = p_gallery_id
      AND client_email = p_client_email
      AND selected = true;

    IF v_current >= v_max THEN
      -- Allow if image was already selected (idempotent)
      IF NOT EXISTS (
        SELECT 1 FROM gallery_selections
        WHERE gallery_id = p_gallery_id
          AND image_id = p_image_id
          AND client_email = p_client_email
          AND selected = true
      ) THEN
        RAISE EXCEPTION 'Selection cap reached (% of %)', v_current, v_max;
      END IF;
    END IF;
  END IF;

  INSERT INTO gallery_selections (gallery_id, image_id, client_email, client_name, selected, note)
  VALUES (p_gallery_id, p_image_id, p_client_email, p_client_name, p_selected, p_note)
  ON CONFLICT (gallery_id, image_id, client_email)
  DO UPDATE SET
    selected = EXCLUDED.selected,
    note = COALESCE(EXCLUDED.note, gallery_selections.note),
    client_name = COALESCE(EXCLUDED.client_name, gallery_selections.client_name),
    updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.client_toggle_selection(UUID, UUID, TEXT, TEXT, BOOLEAN, TEXT) TO anon, authenticated;


-- 10. RPC for fetching a single public image for the per-photo share page
CREATE OR REPLACE FUNCTION public.get_public_gallery_image(
  p_gallery_id UUID,
  p_image_id UUID
)
RETURNS TABLE (
  id UUID,
  filename TEXT,
  thumbnail_url TEXT,
  original_url TEXT,
  width INTEGER,
  height INTEGER,
  gallery_name TEXT,
  brand_logo_url TEXT,
  brand_primary_color TEXT,
  client_link TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    i.id,
    i.filename,
    i.thumbnail_url,
    i.original_url,
    i.width,
    i.height,
    g.name AS gallery_name,
    g.brand_logo_url,
    g.brand_primary_color,
    g.client_link
  FROM gallery_images i
  JOIN galleries g ON g.id = i.gallery_id
  WHERE i.id = p_image_id
    AND i.gallery_id = p_gallery_id
    AND i.status <> 'deleted'
    AND g.client_link IS NOT NULL
    AND g.revoked_at IS NULL
    AND (g.expiry_date IS NULL OR g.expiry_date > now());
$$;

GRANT EXECUTE ON FUNCTION public.get_public_gallery_image(UUID, UUID) TO anon, authenticated;


-- 11. RPC for the photographer's per-photo Insights heatmap
CREATE OR REPLACE FUNCTION public.get_gallery_heatmap(p_gallery_id UUID)
RETURNS TABLE (
  image_id UUID,
  thumbnail_url TEXT,
  filename TEXT,
  view_count INTEGER,
  dwell_seconds_sum INTEGER,
  client_favorite_count INTEGER,
  share_count BIGINT,
  selection_count BIGINT,
  engagement_score NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    i.id AS image_id,
    i.thumbnail_url,
    i.filename,
    i.view_count,
    i.dwell_seconds_sum,
    i.client_favorite_count,
    COALESCE(s.share_count, 0) AS share_count,
    COALESCE(sel.selection_count, 0) AS selection_count,
    (i.view_count
      + i.dwell_seconds_sum * 0.1
      + i.client_favorite_count * 5
      + COALESCE(s.share_count, 0) * 8
      + COALESCE(sel.selection_count, 0) * 10
    )::NUMERIC AS engagement_score
  FROM gallery_images i
  LEFT JOIN (
    SELECT image_id, COUNT(*) AS share_count
    FROM gallery_share_events
    WHERE image_id IS NOT NULL
    GROUP BY image_id
  ) s ON s.image_id = i.id
  LEFT JOIN (
    SELECT image_id, COUNT(*) AS selection_count
    FROM gallery_selections
    WHERE selected = true
    GROUP BY image_id
  ) sel ON sel.image_id = i.id
  WHERE i.gallery_id = p_gallery_id
    AND i.status <> 'deleted'
    AND EXISTS (
      SELECT 1 FROM galleries g
      WHERE g.id = p_gallery_id AND g.user_id = auth.uid()
    )
  ORDER BY engagement_score DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_gallery_heatmap(UUID) TO authenticated;


-- 12. RPC for the photographer's selection-review dashboard
CREATE OR REPLACE FUNCTION public.get_gallery_selections_summary(p_gallery_id UUID)
RETURNS TABLE (
  client_email TEXT,
  client_name TEXT,
  selected_count BIGINT,
  total_notes BIGINT,
  last_activity TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    gs.client_email,
    MAX(gs.client_name) AS client_name,
    COUNT(*) FILTER (WHERE gs.selected) AS selected_count,
    COUNT(*) FILTER (WHERE gs.note IS NOT NULL AND length(gs.note) > 0) AS total_notes,
    MAX(gs.updated_at) AS last_activity
  FROM gallery_selections gs
  WHERE gs.gallery_id = p_gallery_id
    AND EXISTS (
      SELECT 1 FROM galleries g
      WHERE g.id = p_gallery_id AND g.user_id = auth.uid()
    )
  GROUP BY gs.client_email
  ORDER BY last_activity DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.get_gallery_selections_summary(UUID) TO authenticated;


-- 13. Storage bucket for photographer brand logos
-- (Note: bucket creation handled via Supabase dashboard or separate seed;
-- this migration only ensures the bucket exists if Supabase storage extension supports it.)
-- If storage.buckets needs explicit insert:
INSERT INTO storage.buckets (id, name, public)
VALUES ('brand-assets', 'brand-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their own folder under brand-assets
DROP POLICY IF EXISTS "Users upload brand assets to own folder" ON storage.objects;
CREATE POLICY "Users upload brand assets to own folder"
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'brand-assets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Public read brand assets" ON storage.objects;
CREATE POLICY "Public read brand assets"
  ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'brand-assets');

DROP POLICY IF EXISTS "Users delete own brand assets" ON storage.objects;
CREATE POLICY "Users delete own brand assets"
  ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'brand-assets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );


-- 14. Trigger to keep gallery_images.client_favorite_count in sync
CREATE OR REPLACE FUNCTION public.sync_image_favorite_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.interaction_type = 'like') THEN
    UPDATE gallery_images
    SET client_favorite_count = client_favorite_count + 1
    WHERE id = NEW.image_id;
  ELSIF (TG_OP = 'INSERT' AND NEW.interaction_type = 'unlike') THEN
    UPDATE gallery_images
    SET client_favorite_count = GREATEST(client_favorite_count - 1, 0)
    WHERE id = NEW.image_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_image_favorite_count ON public.client_interactions;
CREATE TRIGGER trg_sync_image_favorite_count
  AFTER INSERT ON public.client_interactions
  FOR EACH ROW
  WHEN (NEW.image_id IS NOT NULL)
  EXECUTE FUNCTION public.sync_image_favorite_count();
