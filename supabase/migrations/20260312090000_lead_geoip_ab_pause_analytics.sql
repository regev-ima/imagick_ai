-- ============================================================
-- Lead System: GeoIP, A/B, Pause, Analytics helpers
-- ============================================================

-- 1) Extend lead_contacts for GeoIP + conversion tracking
ALTER TABLE public.lead_contacts
  ADD COLUMN IF NOT EXISTS ip_address text,
  ADD COLUMN IF NOT EXISTS country_code text,
  ADD COLUMN IF NOT EXISTS country_name text,
  ADD COLUMN IF NOT EXISTS timezone text,
  ADD COLUMN IF NOT EXISTS geoip_provider text,
  ADD COLUMN IF NOT EXISTS geoip_looked_up_at timestamptz,
  ADD COLUMN IF NOT EXISTS converted_at timestamptz;

-- 2) Extend lead_campaign_steps for A/B
ALTER TABLE public.lead_campaign_steps
  ADD COLUMN IF NOT EXISTS ab_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS variant_b_subject text,
  ADD COLUMN IF NOT EXISTS variant_b_body_html text,
  ADD COLUMN IF NOT EXISTS ab_split_percent integer NOT NULL DEFAULT 50;

-- 3) Track variant on scheduled emails
ALTER TABLE public.lead_scheduled_emails
  ADD COLUMN IF NOT EXISTS variant text NOT NULL DEFAULT 'A';

-- 4) GeoIP cache
CREATE TABLE IF NOT EXISTS public.lead_geoip_cache (
  ip_address text PRIMARY KEY,
  country_code text,
  country_name text,
  timezone text,
  provider text,
  looked_up_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_geoip_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage lead_geoip_cache" ON public.lead_geoip_cache;
CREATE POLICY "Admins manage lead_geoip_cache"
  ON public.lead_geoip_cache FOR ALL
  USING (is_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins select lead_geoip_cache" ON public.lead_geoip_cache;
CREATE POLICY "Admins select lead_geoip_cache"
  ON public.lead_geoip_cache FOR SELECT TO authenticated
  USING (is_admin(auth.uid()));

-- 5) Platform settings: pause + country send hours
INSERT INTO public.platform_settings (key, value)
VALUES ('lead_emails_paused', 'false')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.platform_settings (key, value)
VALUES ('lead_country_send_hours', '{}')
ON CONFLICT (key) DO NOTHING;

-- 6) Ensure a single active/default campaign
DO $$
DECLARE
  v_default_id uuid;
BEGIN
  SELECT id INTO v_default_id
  FROM public.lead_campaigns
  ORDER BY is_default DESC, created_at ASC
  LIMIT 1;

  IF v_default_id IS NOT NULL THEN
    UPDATE public.lead_campaigns
    SET is_default = (id = v_default_id),
        is_active = (id = v_default_id),
        updated_at = now();
  END IF;
END;
$$;

-- 7) Update lead conversion trigger to stamp converted_at
CREATE OR REPLACE FUNCTION public.cancel_lead_on_signup()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_lead_id uuid;
  v_now timestamptz := now();
BEGIN
  v_email := lower(trim(NEW.email));

  SELECT id INTO v_lead_id
  FROM public.lead_contacts
  WHERE email_normalized = v_email
    AND status = 'active'
  LIMIT 1;

  IF v_lead_id IS NOT NULL THEN
    UPDATE public.lead_contacts
    SET status = 'converted',
        suppression_reason = 'signed_up',
        converted_at = v_now,
        updated_at = v_now
    WHERE id = v_lead_id;

    UPDATE public.lead_enrollments
    SET status = 'cancelled',
        cancelled_at = v_now,
        updated_at = v_now
    WHERE lead_id = v_lead_id AND status = 'active';

    UPDATE public.lead_scheduled_emails
    SET status = 'cancelled',
        last_error = 'Lead converted (signed up)',
        updated_at = v_now
    WHERE lead_id = v_lead_id AND status IN ('pending', 'processing');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_lead_conversion ON auth.users;
CREATE TRIGGER on_auth_user_created_lead_conversion
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.cancel_lead_on_signup();
