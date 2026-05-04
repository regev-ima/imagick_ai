-- Add missing columns to lead_contacts
ALTER TABLE public.lead_contacts
  ADD COLUMN IF NOT EXISTS timezone text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS country_code text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS converted_at timestamptz DEFAULT NULL;

-- Add missing variant column to lead_scheduled_emails
ALTER TABLE public.lead_scheduled_emails
  ADD COLUMN IF NOT EXISTS variant text NOT NULL DEFAULT 'A';

-- Add missing columns to lead_campaign_steps for A/B testing
ALTER TABLE public.lead_campaign_steps
  ADD COLUMN IF NOT EXISTS ab_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS variant_b_subject text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS variant_b_body_html text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ab_split_percent integer NOT NULL DEFAULT 50;