
-- ============================================================
-- Lead Reactivation System — Authoritative Migration
-- ============================================================

-- 1) Drop empty tables that are missing body_html column
DROP TABLE IF EXISTS public.lead_campaign_steps CASCADE;
DROP TABLE IF EXISTS public.lead_campaigns CASCADE;

-- 2) Recreate lead_campaigns with full schema
CREATE TABLE IF NOT EXISTS public.lead_campaigns (
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
DROP POLICY IF EXISTS "Admins manage lead_campaigns" ON public.lead_campaigns;
CREATE POLICY "Admins manage lead_campaigns" ON public.lead_campaigns FOR ALL USING (is_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins select lead_campaigns" ON public.lead_campaigns;
CREATE POLICY "Admins select lead_campaigns" ON public.lead_campaigns FOR SELECT TO authenticated USING (is_admin(auth.uid()));

-- 3) Recreate lead_campaign_steps WITH body_html
CREATE TABLE IF NOT EXISTS public.lead_campaign_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.lead_campaigns(id) ON DELETE CASCADE,
  step_order integer NOT NULL DEFAULT 1,
  delay_hours integer NOT NULL DEFAULT 0,
  sender_profile text NOT NULL DEFAULT 'sapir',
  is_reply boolean NOT NULL DEFAULT false,
  subject text NOT NULL DEFAULT '',
  body_html text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_campaign_steps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage lead_campaign_steps" ON public.lead_campaign_steps;
CREATE POLICY "Admins manage lead_campaign_steps" ON public.lead_campaign_steps FOR ALL USING (is_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins select lead_campaign_steps" ON public.lead_campaign_steps;
CREATE POLICY "Admins select lead_campaign_steps" ON public.lead_campaign_steps FOR SELECT TO authenticated USING (is_admin(auth.uid()));

-- 4) lead_contacts
CREATE TABLE IF NOT EXISTS public.lead_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_raw text NOT NULL,
  email_normalized text NOT NULL,
  first_name text,
  last_name text,
  source text NOT NULL DEFAULT 'import',
  status text NOT NULL DEFAULT 'active',
  suppression_reason text,
  unsubscribed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_contacts_email_normalized ON public.lead_contacts(email_normalized);
CREATE INDEX IF NOT EXISTS idx_lead_contacts_status ON public.lead_contacts(status);

ALTER TABLE public.lead_contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage lead_contacts" ON public.lead_contacts;
CREATE POLICY "Admins manage lead_contacts" ON public.lead_contacts FOR ALL USING (is_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins select lead_contacts" ON public.lead_contacts;
CREATE POLICY "Admins select lead_contacts" ON public.lead_contacts FOR SELECT TO authenticated USING (is_admin(auth.uid()));

-- 5) lead_import_jobs
CREATE TABLE IF NOT EXISTS public.lead_import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL,
  file_name text,
  file_type text,
  source text NOT NULL DEFAULT 'manual_upload',
  selected_campaign_id uuid REFERENCES public.lead_campaigns(id),
  mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_rows integer NOT NULL DEFAULT 0,
  processed_rows integer NOT NULL DEFAULT 0,
  imported_count integer NOT NULL DEFAULT 0,
  duplicates_count integer NOT NULL DEFAULT 0,
  invalid_count integer NOT NULL DEFAULT 0,
  registered_count integer NOT NULL DEFAULT 0,
  suppressed_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_import_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage lead_import_jobs" ON public.lead_import_jobs;
CREATE POLICY "Admins manage lead_import_jobs" ON public.lead_import_jobs FOR ALL USING (is_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins select lead_import_jobs" ON public.lead_import_jobs;
CREATE POLICY "Admins select lead_import_jobs" ON public.lead_import_jobs FOR SELECT TO authenticated USING (is_admin(auth.uid()));

-- 6) lead_import_job_rows
CREATE TABLE IF NOT EXISTS public.lead_import_job_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_job_id uuid NOT NULL REFERENCES public.lead_import_jobs(id) ON DELETE CASCADE,
  row_number integer NOT NULL DEFAULT 0,
  email_raw text,
  email_normalized text,
  first_name text,
  last_name text,
  lead_id uuid,
  result text NOT NULL DEFAULT 'pending',
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_import_job_rows_job ON public.lead_import_job_rows(import_job_id);
CREATE INDEX IF NOT EXISTS idx_lead_import_job_rows_email ON public.lead_import_job_rows(email_normalized);

ALTER TABLE public.lead_import_job_rows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage lead_import_job_rows" ON public.lead_import_job_rows;
CREATE POLICY "Admins manage lead_import_job_rows" ON public.lead_import_job_rows FOR ALL USING (is_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins select lead_import_job_rows" ON public.lead_import_job_rows;
CREATE POLICY "Admins select lead_import_job_rows" ON public.lead_import_job_rows FOR SELECT TO authenticated USING (is_admin(auth.uid()));

-- 7) lead_enrollments
CREATE TABLE IF NOT EXISTS public.lead_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.lead_contacts(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.lead_campaigns(id),
  status text NOT NULL DEFAULT 'active',
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  last_sent_step integer,
  cancelled_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_enrollments_lead ON public.lead_enrollments(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_enrollments_status ON public.lead_enrollments(status);

ALTER TABLE public.lead_enrollments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage lead_enrollments" ON public.lead_enrollments;
CREATE POLICY "Admins manage lead_enrollments" ON public.lead_enrollments FOR ALL USING (is_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins select lead_enrollments" ON public.lead_enrollments;
CREATE POLICY "Admins select lead_enrollments" ON public.lead_enrollments FOR SELECT TO authenticated USING (is_admin(auth.uid()));

-- 8) lead_scheduled_emails
CREATE TABLE IF NOT EXISTS public.lead_scheduled_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.lead_enrollments(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.lead_contacts(id),
  campaign_id uuid NOT NULL REFERENCES public.lead_campaigns(id),
  campaign_step_id uuid NOT NULL REFERENCES public.lead_campaign_steps(id),
  step_order integer NOT NULL DEFAULT 1,
  subject_snapshot text NOT NULL DEFAULT '',
  body_snapshot text NOT NULL DEFAULT '',
  sender_profile text NOT NULL DEFAULT 'sapir',
  is_reply boolean NOT NULL DEFAULT false,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending',
  sent_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0,
  resend_message_id text,
  last_error text,
  open_token uuid NOT NULL DEFAULT gen_random_uuid(),
  opened_count integer NOT NULL DEFAULT 0,
  opened_first_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_scheduled_status_at ON public.lead_scheduled_emails(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_lead_scheduled_lead ON public.lead_scheduled_emails(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_scheduled_enrollment ON public.lead_scheduled_emails(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_lead_scheduled_open_token ON public.lead_scheduled_emails(open_token);

ALTER TABLE public.lead_scheduled_emails ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage lead_scheduled_emails" ON public.lead_scheduled_emails;
CREATE POLICY "Admins manage lead_scheduled_emails" ON public.lead_scheduled_emails FOR ALL USING (is_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins select lead_scheduled_emails" ON public.lead_scheduled_emails;
CREATE POLICY "Admins select lead_scheduled_emails" ON public.lead_scheduled_emails FOR SELECT TO authenticated USING (is_admin(auth.uid()));

-- 9) lead_email_opens
CREATE TABLE IF NOT EXISTS public.lead_email_opens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_email_id uuid NOT NULL REFERENCES public.lead_scheduled_emails(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.lead_contacts(id),
  opened_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text,
  device_type text
);

CREATE INDEX IF NOT EXISTS idx_lead_email_opens_scheduled ON public.lead_email_opens(scheduled_email_id);

ALTER TABLE public.lead_email_opens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage lead_email_opens" ON public.lead_email_opens;
CREATE POLICY "Admins manage lead_email_opens" ON public.lead_email_opens FOR ALL USING (is_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins select lead_email_opens" ON public.lead_email_opens;
CREATE POLICY "Admins select lead_email_opens" ON public.lead_email_opens FOR SELECT TO authenticated USING (is_admin(auth.uid()));

-- 10) Function: normalize_email
-- Drop first because earlier migration defined this with a different parameter name (p_email);
-- CREATE OR REPLACE cannot rename parameters.
DROP FUNCTION IF EXISTS public.normalize_email(text);
CREATE OR REPLACE FUNCTION public.normalize_email(raw text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT lower(trim(raw));
$$;

-- 11) Function: lookup_registered_emails
DROP FUNCTION IF EXISTS public.lookup_registered_emails(text[]);
CREATE OR REPLACE FUNCTION public.lookup_registered_emails(p_emails text[])
RETURNS TABLE(email_normalized text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(trim(u.email)) AS email_normalized
  FROM auth.users u
  WHERE lower(trim(u.email)) = ANY(p_emails);
$$;

-- 12) Function: claim_pending_lead_emails (duplicate-safe atomic claim)
-- Fix open_token type: an earlier migration created lead_scheduled_emails.open_token as text;
-- the function below expects uuid. Coerce the column type before defining the function.
-- Existing data in the column is hex (not UUID-shaped), so drop+re-add — the table is empty
-- on a fresh push.
ALTER TABLE public.lead_scheduled_emails DROP COLUMN IF EXISTS open_token;
ALTER TABLE public.lead_scheduled_emails ADD COLUMN open_token uuid NOT NULL DEFAULT gen_random_uuid();
DROP FUNCTION IF EXISTS public.claim_pending_lead_emails(integer);
CREATE OR REPLACE FUNCTION public.claim_pending_lead_emails(p_limit integer DEFAULT 20)
RETURNS TABLE(
  id uuid,
  enrollment_id uuid,
  lead_id uuid,
  campaign_id uuid,
  step_order integer,
  subject_snapshot text,
  body_snapshot text,
  sender_profile text,
  is_reply boolean,
  open_token uuid,
  attempt_count integer
)
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  WITH batch AS (
    SELECT lse.id
    FROM public.lead_scheduled_emails lse
    WHERE lse.status = 'pending'
      AND lse.scheduled_at <= now()
    ORDER BY lse.scheduled_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.lead_scheduled_emails lse
  SET status = 'processing', updated_at = now()
  FROM batch
  WHERE lse.id = batch.id
  RETURNING
    lse.id,
    lse.enrollment_id,
    lse.lead_id,
    lse.campaign_id,
    lse.step_order,
    lse.subject_snapshot,
    lse.body_snapshot,
    lse.sender_profile,
    lse.is_reply,
    lse.open_token,
    lse.attempt_count;
$$;

-- 13) Function: cancel pending lead emails when user signs up
DROP FUNCTION IF EXISTS public.cancel_lead_on_signup();
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
    SET status = 'converted', suppression_reason = 'signed_up', updated_at = v_now
    WHERE id = v_lead_id;

    UPDATE public.lead_enrollments
    SET status = 'cancelled', cancelled_at = v_now, updated_at = v_now
    WHERE lead_id = v_lead_id AND status = 'active';

    UPDATE public.lead_scheduled_emails
    SET status = 'cancelled', last_error = 'Lead converted (signed up)', updated_at = v_now
    WHERE lead_id = v_lead_id AND status IN ('pending', 'processing');
  END IF;

  RETURN NEW;
END;
$$;
