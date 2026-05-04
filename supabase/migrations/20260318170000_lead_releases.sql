-- Lead release batches: track each release with stats
CREATE TABLE IF NOT EXISTS public.lead_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.lead_campaigns(id),
  created_by uuid NOT NULL,
  label text,
  lead_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_releases_campaign ON public.lead_releases(campaign_id);
CREATE INDEX IF NOT EXISTS idx_lead_releases_created ON public.lead_releases(created_at DESC);

ALTER TABLE public.lead_releases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage lead_releases" ON public.lead_releases FOR ALL USING (is_admin(auth.uid()));

-- Link enrollments and scheduled emails to their release batch
ALTER TABLE public.lead_enrollments ADD COLUMN IF NOT EXISTS release_id uuid REFERENCES public.lead_releases(id);
CREATE INDEX IF NOT EXISTS idx_lead_enrollments_release ON public.lead_enrollments(release_id);

ALTER TABLE public.lead_scheduled_emails ADD COLUMN IF NOT EXISTS release_id uuid REFERENCES public.lead_releases(id);
CREATE INDEX IF NOT EXISTS idx_lead_scheduled_release ON public.lead_scheduled_emails(release_id);
