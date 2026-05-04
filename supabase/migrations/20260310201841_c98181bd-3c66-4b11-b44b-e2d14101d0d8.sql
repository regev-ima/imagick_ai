
CREATE TABLE public.lead_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  timezone text NOT NULL DEFAULT 'Asia/Jerusalem',
  send_window_start integer NOT NULL DEFAULT 9,
  send_window_end integer NOT NULL DEFAULT 20,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage lead campaigns" ON public.lead_campaigns
  FOR ALL USING (is_admin(auth.uid()));

CREATE POLICY "Admins can view lead campaigns" ON public.lead_campaigns
  FOR SELECT TO authenticated USING (is_admin(auth.uid()));

CREATE TABLE public.lead_campaign_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.lead_campaigns(id) ON DELETE CASCADE,
  step_order integer NOT NULL DEFAULT 1,
  delay_hours integer NOT NULL DEFAULT 0,
  sender_profile text NOT NULL DEFAULT 'sapir',
  is_reply boolean NOT NULL DEFAULT false,
  subject text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_campaign_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage lead campaign steps" ON public.lead_campaign_steps
  FOR ALL USING (is_admin(auth.uid()));

CREATE POLICY "Admins can view lead campaign steps" ON public.lead_campaign_steps
  FOR SELECT TO authenticated USING (is_admin(auth.uid()));
