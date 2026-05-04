
-- Create platform_settings table for admin-managed settings like logos
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid
);

-- Enable RLS
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read settings
CREATE POLICY "Authenticated users can view platform settings"
ON public.platform_settings FOR SELECT
TO authenticated
USING (true);

-- Only admins can manage settings
CREATE POLICY "Admins can manage platform settings"
ON public.platform_settings FOR ALL
USING (is_admin(auth.uid()));

-- Insert default logo keys
INSERT INTO public.platform_settings (key, value) VALUES
  ('logo_dark_full', null),
  ('logo_dark_icon', null),
  ('logo_light_full', null),
  ('logo_light_icon', null);
