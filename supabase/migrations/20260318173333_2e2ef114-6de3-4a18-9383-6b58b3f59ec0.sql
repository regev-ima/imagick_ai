
-- Create lead_releases table
CREATE TABLE IF NOT EXISTS public.lead_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.lead_campaigns(id),
  created_by uuid NOT NULL,
  label text,
  lead_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_releases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage lead_releases" ON public.lead_releases
  FOR ALL TO public USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins select lead_releases" ON public.lead_releases
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- Add release_id to lead_enrollments
ALTER TABLE public.lead_enrollments
  ADD COLUMN release_id uuid REFERENCES public.lead_releases(id);

-- Add release_id to lead_scheduled_emails
ALTER TABLE public.lead_scheduled_emails
  ADD COLUMN release_id uuid REFERENCES public.lead_releases(id);
