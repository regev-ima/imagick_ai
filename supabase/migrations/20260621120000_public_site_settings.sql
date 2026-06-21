-- ════════════════════════════════════════════════════════════════════
-- Public, admin-managed site settings (marketing / tracking tag IDs).
--
-- Tracking IDs (Google Tag Manager, GA4, Microsoft Clarity, Meta Pixel,
-- Google Ads, etc.) are inherently public — they ship in the page source —
-- so this table is PUBLIC-READABLE but ADMIN-WRITABLE. The anonymous
-- marketing site reads it to inject the configured tags. Real secrets
-- (API keys, tokens) stay in platform_settings (authenticated-only).
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.public_site_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.public_site_settings ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous visitors) can read — required so the public
-- marketing site can load the configured tags before sign-in.
DROP POLICY IF EXISTS "Anyone can read public site settings" ON public.public_site_settings;
CREATE POLICY "Anyone can read public site settings"
  ON public.public_site_settings FOR SELECT
  USING (true);

-- Only admins can change them.
DROP POLICY IF EXISTS "Admins can manage public site settings" ON public.public_site_settings;
CREATE POLICY "Admins can manage public site settings"
  ON public.public_site_settings FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Seed an empty, disabled marketing-tags row so the admin UI has a target.
INSERT INTO public.public_site_settings (key, value)
VALUES ('marketing_tags', '{"enabled": false}'::jsonb)
ON CONFLICT (key) DO NOTHING;
