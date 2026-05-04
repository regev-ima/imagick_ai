-- ============================================================
-- Lead Reactivation System (Admin-only)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.normalize_email(p_email TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_email IS NULL THEN NULL
    ELSE lower(trim(p_email))
  END;
$$;

CREATE OR REPLACE FUNCTION public.lookup_registered_emails(p_emails TEXT[])
RETURNS TABLE(email_normalized TEXT, user_id UUID)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(u.email) AS email_normalized, u.id AS user_id
  FROM auth.users u
  WHERE lower(u.email) = ANY(p_emails);
$$;

-- ============================================================
-- Campaign Definitions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lead_campaigns (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name               TEXT        NOT NULL UNIQUE,
  description        TEXT,
  is_default         BOOLEAN     NOT NULL DEFAULT FALSE,
  is_active          BOOLEAN     NOT NULL DEFAULT TRUE,
  language_default   TEXT        NOT NULL DEFAULT 'en',
  timezone           TEXT        NOT NULL DEFAULT 'Asia/Jerusalem',
  send_window_start  SMALLINT    NOT NULL DEFAULT 9,
  send_window_end    SMALLINT    NOT NULL DEFAULT 20,
  created_by         UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_lead_campaign_window CHECK (
    send_window_start >= 0 AND send_window_start <= 23
    AND send_window_end >= 1 AND send_window_end <= 24
    AND send_window_start < send_window_end
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_lead_campaign_default_true
  ON public.lead_campaigns ((is_default))
  WHERE is_default;

CREATE TABLE IF NOT EXISTS public.lead_campaign_steps (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     UUID        NOT NULL REFERENCES public.lead_campaigns(id) ON DELETE CASCADE,
  step_order      INT         NOT NULL,
  delay_hours     INT         NOT NULL DEFAULT 0 CHECK (delay_hours >= 0),
  subject         TEXT        NOT NULL,
  body_html       TEXT        NOT NULL DEFAULT '',
  sender_profile  TEXT        NOT NULL DEFAULT 'contact' CHECK (sender_profile IN ('sapir', 'contact')),
  is_reply        BOOLEAN     NOT NULL DEFAULT FALSE,
  email_type      TEXT        NOT NULL DEFAULT 'lead_campaign',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (campaign_id, step_order)
);

CREATE INDEX IF NOT EXISTS idx_lead_campaign_steps_campaign
  ON public.lead_campaign_steps (campaign_id, step_order);

-- ============================================================
-- Lead Contacts + Import
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lead_contacts (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email_raw         TEXT        NOT NULL,
  email_normalized  TEXT        NOT NULL UNIQUE,
  first_name        TEXT,
  last_name         TEXT,
  source            TEXT,
  status            TEXT        NOT NULL DEFAULT 'active' CHECK (
    status IN ('active', 'converted', 'unsubscribed', 'suppressed', 'already_registered')
  ),
  suppression_reason TEXT,
  converted_user_id UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  converted_at      TIMESTAMPTZ,
  unsubscribed_at   TIMESTAMPTZ,
  metadata          JSONB       NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_contacts_status ON public.lead_contacts (status);
CREATE INDEX IF NOT EXISTS idx_lead_contacts_source ON public.lead_contacts (source);

CREATE TABLE IF NOT EXISTS public.lead_import_jobs (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by         UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  file_name          TEXT,
  file_type          TEXT,
  source             TEXT,
  selected_campaign_id UUID      REFERENCES public.lead_campaigns(id) ON DELETE SET NULL,
  status             TEXT        NOT NULL DEFAULT 'queued' CHECK (
    status IN ('queued', 'processing', 'completed', 'failed')
  ),
  mapping            JSONB       NOT NULL DEFAULT '{}',
  total_rows         INT         NOT NULL DEFAULT 0,
  processed_rows     INT         NOT NULL DEFAULT 0,
  imported_count     INT         NOT NULL DEFAULT 0,
  duplicates_count   INT         NOT NULL DEFAULT 0,
  invalid_count      INT         NOT NULL DEFAULT 0,
  registered_count   INT         NOT NULL DEFAULT 0,
  suppressed_count   INT         NOT NULL DEFAULT 0,
  error_message      TEXT,
  started_at         TIMESTAMPTZ,
  completed_at       TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_import_jobs_status ON public.lead_import_jobs (status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.lead_import_job_rows (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  import_job_id    UUID        NOT NULL REFERENCES public.lead_import_jobs(id) ON DELETE CASCADE,
  row_number       INT         NOT NULL,
  email_raw        TEXT,
  email_normalized TEXT,
  first_name       TEXT,
  last_name        TEXT,
  lead_id          UUID        REFERENCES public.lead_contacts(id) ON DELETE SET NULL,
  result           TEXT        NOT NULL CHECK (
    result IN ('new_lead', 'existing_lead', 'duplicate_in_file', 'already_registered', 'invalid_email', 'suppressed')
  ),
  reason           TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (import_job_id, row_number)
);

CREATE INDEX IF NOT EXISTS idx_lead_import_rows_job_result
  ON public.lead_import_job_rows (import_job_id, result);

CREATE INDEX IF NOT EXISTS idx_lead_import_rows_email
  ON public.lead_import_job_rows (email_normalized);

-- ============================================================
-- Enrollment + Pre-scheduled Emails
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lead_enrollments (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id           UUID        NOT NULL REFERENCES public.lead_contacts(id) ON DELETE CASCADE,
  campaign_id       UUID        NOT NULL REFERENCES public.lead_campaigns(id) ON DELETE CASCADE,
  status            TEXT        NOT NULL DEFAULT 'active' CHECK (
    status IN ('active', 'completed', 'cancelled', 'converted')
  ),
  last_sent_step    INT         NOT NULL DEFAULT 0,
  enrolled_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  converted_user_id UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  converted_at      TIMESTAMPTZ,
  cancelled_at      TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (lead_id, campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_lead_enrollments_status
  ON public.lead_enrollments (status, enrolled_at DESC);

CREATE TABLE IF NOT EXISTS public.lead_scheduled_emails (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id     UUID        NOT NULL REFERENCES public.lead_enrollments(id) ON DELETE CASCADE,
  lead_id           UUID        NOT NULL REFERENCES public.lead_contacts(id) ON DELETE CASCADE,
  campaign_id       UUID        NOT NULL REFERENCES public.lead_campaigns(id) ON DELETE CASCADE,
  campaign_step_id  UUID        NOT NULL REFERENCES public.lead_campaign_steps(id) ON DELETE CASCADE,
  step_order        INT         NOT NULL,
  open_token        TEXT        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  subject_snapshot  TEXT        NOT NULL,
  body_snapshot     TEXT        NOT NULL,
  sender_profile    TEXT        NOT NULL CHECK (sender_profile IN ('sapir', 'contact')),
  is_reply          BOOLEAN     NOT NULL DEFAULT FALSE,
  scheduled_at      TIMESTAMPTZ NOT NULL,
  status            TEXT        NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'processing', 'sent', 'failed', 'cancelled', 'skipped')
  ),
  attempt_count     INT         NOT NULL DEFAULT 0,
  resend_message_id TEXT,
  last_error        TEXT,
  sent_at           TIMESTAMPTZ,
  opened_first_at   TIMESTAMPTZ,
  opened_count      INT         NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_scheduled_pending
  ON public.lead_scheduled_emails (status, scheduled_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_lead_scheduled_lead
  ON public.lead_scheduled_emails (lead_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.claim_pending_lead_emails(p_limit INT DEFAULT 20)
RETURNS SETOF public.lead_scheduled_emails
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH to_claim AS (
    SELECT s.id
    FROM public.lead_scheduled_emails s
    WHERE s.status = 'pending'
      AND s.scheduled_at <= NOW()
    ORDER BY s.scheduled_at ASC, s.created_at ASC
    LIMIT GREATEST(COALESCE(p_limit, 20), 1)
    FOR UPDATE SKIP LOCKED
  ),
  claimed AS (
    UPDATE public.lead_scheduled_emails s
    SET status = 'processing',
        updated_at = NOW()
    FROM to_claim
    WHERE s.id = to_claim.id
    RETURNING s.*
  )
  SELECT * FROM claimed;
END;
$$;

CREATE TABLE IF NOT EXISTS public.lead_email_opens (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_email_id UUID       NOT NULL REFERENCES public.lead_scheduled_emails(id) ON DELETE CASCADE,
  lead_id           UUID        NOT NULL REFERENCES public.lead_contacts(id) ON DELETE CASCADE,
  opened_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address        TEXT,
  user_agent        TEXT,
  device_type       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_email_opens_scheduled
  ON public.lead_email_opens (scheduled_email_id, opened_at DESC);

-- ============================================================
-- Lead Conversion Trigger (auth.users -> lead converted)
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_lead_conversion_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_email TEXT;
BEGIN
  normalized_email := public.normalize_email(NEW.email);
  IF normalized_email IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.lead_contacts
  SET
    status = 'converted',
    converted_user_id = NEW.id,
    converted_at = NOW(),
    updated_at = NOW()
  WHERE email_normalized = normalized_email
    AND status IN ('active', 'already_registered');

  UPDATE public.lead_enrollments e
  SET
    status = 'converted',
    converted_user_id = NEW.id,
    converted_at = NOW(),
    updated_at = NOW()
  FROM public.lead_contacts l
  WHERE e.lead_id = l.id
    AND l.email_normalized = normalized_email
    AND e.status = 'active';

  UPDATE public.lead_scheduled_emails s
  SET
    status = 'cancelled',
    updated_at = NOW()
  FROM public.lead_contacts l
  WHERE s.lead_id = l.id
    AND l.email_normalized = normalized_email
    AND s.status = 'pending';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_lead_conversion ON auth.users;
CREATE TRIGGER on_auth_user_created_lead_conversion
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_lead_conversion_on_signup();

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.lead_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_campaign_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_import_job_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_scheduled_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_email_opens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins full access lead_campaigns" ON public.lead_campaigns;
CREATE POLICY "Admins full access lead_campaigns"
  ON public.lead_campaigns FOR ALL
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins full access lead_campaign_steps" ON public.lead_campaign_steps;
CREATE POLICY "Admins full access lead_campaign_steps"
  ON public.lead_campaign_steps FOR ALL
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins full access lead_contacts" ON public.lead_contacts;
CREATE POLICY "Admins full access lead_contacts"
  ON public.lead_contacts FOR ALL
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins full access lead_import_jobs" ON public.lead_import_jobs;
CREATE POLICY "Admins full access lead_import_jobs"
  ON public.lead_import_jobs FOR ALL
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins full access lead_import_job_rows" ON public.lead_import_job_rows;
CREATE POLICY "Admins full access lead_import_job_rows"
  ON public.lead_import_job_rows FOR ALL
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins full access lead_enrollments" ON public.lead_enrollments;
CREATE POLICY "Admins full access lead_enrollments"
  ON public.lead_enrollments FOR ALL
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins full access lead_scheduled_emails" ON public.lead_scheduled_emails;
CREATE POLICY "Admins full access lead_scheduled_emails"
  ON public.lead_scheduled_emails FOR ALL
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins full access lead_email_opens" ON public.lead_email_opens;
CREATE POLICY "Admins full access lead_email_opens"
  ON public.lead_email_opens FOR ALL
  USING (public.is_admin(auth.uid()));

-- ============================================================
-- Seed default campaign + 10 steps
-- ============================================================
INSERT INTO public.lead_campaigns (
  name,
  description,
  is_default,
  is_active,
  language_default,
  timezone,
  send_window_start,
  send_window_end
)
VALUES (
  'Lead Reactivation - Default 10-Step',
  'Admin-defined return campaign for imported leads (10 steps, conservative sender profile mix)',
  TRUE,
  TRUE,
  'en',
  'Asia/Jerusalem',
  9,
  20
)
ON CONFLICT (name) DO UPDATE
SET
  is_default = EXCLUDED.is_default,
  is_active = EXCLUDED.is_active,
  timezone = EXCLUDED.timezone,
  send_window_start = EXCLUDED.send_window_start,
  send_window_end = EXCLUDED.send_window_end,
  updated_at = NOW();

WITH campaign AS (
  SELECT id FROM public.lead_campaigns WHERE name = 'Lead Reactivation - Default 10-Step'
)
INSERT INTO public.lead_campaign_steps (
  campaign_id,
  step_order,
  delay_hours,
  subject,
  body_html,
  sender_profile,
  is_reply,
  email_type
)
SELECT
  campaign.id,
  s.step_order,
  s.delay_hours,
  s.subject,
  s.body_html,
  s.sender_profile,
  s.is_reply,
  'lead_campaign'
FROM campaign
CROSS JOIN (
  VALUES
    (1, 0,   'Quick note about your Imagick.ai account',
     '<p>Hey {{first_name}},</p><p>I noticed you created an account at Imagick.ai. If you want, I can help you get your first gallery ready in minutes.</p><p>No commitment at all — just reply and I''ll help.</p><p>- Sapir Cohen</p>',
     'sapir', false),
    (2, 24,  'Your studio workflow can be faster (without commitment)',
     '<p>Hi {{first_name}},</p><p>Your account is still waiting at studio.imagick.ai.</p><p>Try it with zero commitment and see how fast your delivery pipeline can be.</p><p><a href="{{studio_url}}/auth">Open your account</a></p>',
     'contact', false),
    (3, 48,  'Can I help you finish your first gallery?',
     '<p>Hey {{first_name}},</p><p>RE: getting your first gallery live — if you want, I can personally walk you through it.</p><p>Again, no commitment.</p><p>- Sapir Cohen</p>',
     'sapir', true),
    (4, 48,  'A simple way to cut editing time this week',
     '<p>Hi {{first_name}},</p><p>Most studios start seeing value on day one. Your account is still active and waiting.</p><p><a href="{{studio_url}}/auth">Resume in one click</a></p>',
     'contact', false),
    (5, 48,  'Still interested in faster delivery?',
     '<p>Hi {{first_name}},</p><p>Just checking in — if fast turnaround matters, Imagick.ai can help without locking you in.</p><p>You can leave anytime.</p>',
     'contact', false),
    (6, 72,  'Happy to help personally',
     '<p>Hey {{first_name}},</p><p>If you send me one gallery goal, I''ll suggest the fastest setup for you.</p><p>- Sapir Cohen</p>',
     'sapir', false),
    (7, 96,  'Your access is still open',
     '<p>Hi {{first_name}},</p><p>Your account is ready whenever you are. No commitment, just test the workflow.</p><p><a href="{{studio_url}}/auth">Open Studio</a></p>',
     'contact', false),
    (8, 96,  'Last reminder before we pause updates',
     '<p>Hi {{first_name}},</p><p>We''ll pause these updates soon. If you still want to test Imagick.ai, now is a good time.</p>',
     'contact', false),
    (9, 144, 'Should I keep your account active?',
     '<p>Hey {{first_name}},</p><p>RE: your Imagick.ai account — do you want me to keep sending best-practice tips, or pause here?</p><p>- Sapir Cohen</p>',
     'sapir', true),
    (10, 144,'Final check-in from Imagick.ai',
     '<p>Hi {{first_name}},</p><p>This is the last message in this series.</p><p>If you want back in, your account is ready at any time.</p><p><a href="{{studio_url}}/auth">Go to Studio</a></p>',
     'contact', false)
) AS s(step_order, delay_hours, subject, body_html, sender_profile, is_reply)
ON CONFLICT (campaign_id, step_order) DO UPDATE
SET
  delay_hours = EXCLUDED.delay_hours,
  subject = EXCLUDED.subject,
  body_html = EXCLUDED.body_html,
  sender_profile = EXCLUDED.sender_profile,
  is_reply = EXCLUDED.is_reply,
  updated_at = NOW();

-- ============================================================
-- Schedule queue processor (every minute, conservative batch 20)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'process-lead-email-queue-every-minute'
  ) THEN
    PERFORM cron.schedule(
      'process-lead-email-queue-every-minute',
      '* * * * *',
      $job$
        SELECT net.http_post(
          url := 'https://nzfnqgmphepxgrjkkgkq.supabase.co/functions/v1/process-lead-email-queue',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
          ),
          body := '{"trigger":"cron","batchSize":20}'::jsonb
        ) AS request_id;
      $job$
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not auto-schedule process-lead-email-queue cron job: %', SQLERRM;
END $$;
