
-- Add missing columns to lead_contacts
ALTER TABLE public.lead_contacts ADD COLUMN IF NOT EXISTS ip_address text;
ALTER TABLE public.lead_contacts ADD COLUMN IF NOT EXISTS country_name text;
ALTER TABLE public.lead_contacts ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.lead_contacts ADD COLUMN IF NOT EXISTS geoip_provider text;
ALTER TABLE public.lead_contacts ADD COLUMN IF NOT EXISTS geoip_looked_up_at timestamptz;

-- Create lead_geoip_cache table
CREATE TABLE IF NOT EXISTS public.lead_geoip_cache (
  ip_address text PRIMARY KEY,
  country_code text,
  country_name text,
  timezone text,
  provider text,
  looked_up_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lead_geoip_cache ENABLE ROW LEVEL SECURITY;

-- Admin-only policies
DROP POLICY IF EXISTS "Admins manage lead_geoip_cache" ON public.lead_geoip_cache;
CREATE POLICY "Admins manage lead_geoip_cache" ON public.lead_geoip_cache FOR ALL USING (is_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins select lead_geoip_cache" ON public.lead_geoip_cache;
CREATE POLICY "Admins select lead_geoip_cache" ON public.lead_geoip_cache FOR SELECT TO authenticated USING (is_admin(auth.uid()));
