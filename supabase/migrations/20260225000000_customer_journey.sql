-- ============================================================
-- Customer Journey: Lifecycle Profiles + Email Sequences
-- ============================================================

-- Table: user_lifecycle_profiles
-- Tracks each user's lifecycle stage and conversion score
CREATE TABLE IF NOT EXISTS public.user_lifecycle_profiles (
  user_id              UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  lifecycle_stage      TEXT        NOT NULL DEFAULT 'new',
  -- Possible stages: new | onboarding | exploring | engaged | converting | paying | at_risk | churned
  conversion_score     INT         NOT NULL DEFAULT 0 CHECK (conversion_score BETWEEN 0 AND 100),
  days_since_signup    INT         NOT NULL DEFAULT 0,
  gallery_count        INT         NOT NULL DEFAULT 0,
  images_processed     INT         NOT NULL DEFAULT 0,
  login_count          INT         NOT NULL DEFAULT 0,
  last_active_at       TIMESTAMPTZ,
  is_paid              BOOLEAN     NOT NULL DEFAULT FALSE,
  stage_changed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  previous_stage       TEXT,
  last_computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lifecycle_stage ON public.user_lifecycle_profiles (lifecycle_stage);
CREATE INDEX IF NOT EXISTS idx_lifecycle_score ON public.user_lifecycle_profiles (conversion_score DESC);
CREATE INDEX IF NOT EXISTS idx_lifecycle_last_active ON public.user_lifecycle_profiles (last_active_at);

-- RLS
ALTER TABLE public.user_lifecycle_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own lifecycle profile" ON public.user_lifecycle_profiles;
CREATE POLICY "Users read own lifecycle profile"
  ON public.user_lifecycle_profiles FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins full access lifecycle profiles" ON public.user_lifecycle_profiles;
CREATE POLICY "Admins full access lifecycle profiles"
  ON public.user_lifecycle_profiles FOR ALL
  USING (public.is_admin(auth.uid()));

-- Trigger: auto-create lifecycle profile for every new user
CREATE OR REPLACE FUNCTION public.create_default_lifecycle_profile()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_lifecycle_profiles (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_lifecycle ON auth.users;
CREATE TRIGGER on_auth_user_created_lifecycle
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_default_lifecycle_profile();

-- RPC: atomic login_count increment (used by track-session edge function)
CREATE OR REPLACE FUNCTION public.increment_lifecycle_login(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_lifecycle_profiles (user_id, login_count, last_active_at, updated_at)
  VALUES (p_user_id, 1, NOW(), NOW())
  ON CONFLICT (user_id) DO UPDATE
    SET login_count    = public.user_lifecycle_profiles.login_count + 1,
        last_active_at = NOW(),
        updated_at     = NOW();
END;
$$;

-- ============================================================
-- Table: email_sequences
-- Admin-defined sequences that trigger based on lifecycle events
-- ============================================================
CREATE TABLE IF NOT EXISTS public.email_sequences (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  description   TEXT,
  trigger_type  TEXT        NOT NULL,  -- 'stage_enter' | 'days_since_signup'
  trigger_value TEXT        NOT NULL,  -- stage name (e.g. 'new') or number of days (e.g. '7')
  is_active     BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.email_sequences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins full access email_sequences" ON public.email_sequences;
CREATE POLICY "Admins full access email_sequences"
  ON public.email_sequences FOR ALL
  USING (public.is_admin(auth.uid()));

-- ============================================================
-- Table: email_sequence_steps
-- Individual emails in a sequence with timing and content
-- ============================================================
CREATE TABLE IF NOT EXISTS public.email_sequence_steps (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID        NOT NULL REFERENCES public.email_sequences(id) ON DELETE CASCADE,
  step_order  INT         NOT NULL DEFAULT 1,
  delay_hours INT         NOT NULL DEFAULT 0,  -- hours after trigger (0 = immediate)
  subject     TEXT        NOT NULL,
  body_html   TEXT        NOT NULL DEFAULT '',  -- Full HTML body (admin-editable)
  email_type  TEXT        NOT NULL DEFAULT 'journey_email',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (sequence_id, step_order)
);

CREATE INDEX IF NOT EXISTS idx_sequence_steps_seq ON public.email_sequence_steps (sequence_id, step_order);

ALTER TABLE public.email_sequence_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins full access sequence steps" ON public.email_sequence_steps;
CREATE POLICY "Admins full access sequence steps"
  ON public.email_sequence_steps FOR ALL
  USING (public.is_admin(auth.uid()));

-- ============================================================
-- Table: user_sequence_enrollments
-- Tracks each user's enrollment and progress in sequences
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_sequence_enrollments (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sequence_id  UUID        NOT NULL REFERENCES public.email_sequences(id) ON DELETE CASCADE,
  status       TEXT        NOT NULL DEFAULT 'active',  -- active | completed | cancelled
  current_step INT         NOT NULL DEFAULT 1,
  enrolled_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  next_send_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  UNIQUE (user_id, sequence_id)
);

-- Partial index for fast cron processing of pending sends
CREATE INDEX IF NOT EXISTS idx_enrollments_pending
  ON public.user_sequence_enrollments (status, next_send_at)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_enrollments_user
  ON public.user_sequence_enrollments (user_id);

ALTER TABLE public.user_sequence_enrollments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins full access enrollments" ON public.user_sequence_enrollments;
CREATE POLICY "Admins full access enrollments"
  ON public.user_sequence_enrollments FOR ALL
  USING (public.is_admin(auth.uid()));

-- ============================================================
-- Add journey_emails opt-out to existing user_email_preferences
-- ============================================================
ALTER TABLE public.user_email_preferences
  ADD COLUMN IF NOT EXISTS journey_emails BOOLEAN NOT NULL DEFAULT TRUE;

-- ============================================================
-- Seed: 4 predefined sequences (inactive by default for safety)
-- Admin must add steps and activate them manually
-- ============================================================
INSERT INTO public.email_sequences (name, description, trigger_type, trigger_value, is_active)
VALUES
  ('Welcome Sequence',      'Onboarding emails for brand-new users (days 0, 1, 3, 7)',          'stage_enter', 'new',        false),
  ('Activation Sequence',   'Sent after user creates their first gallery (exploring stage)',     'stage_enter', 'exploring',  false),
  ('Re-engagement Sequence','For at-risk paid users who have gone inactive (7+ days)',           'stage_enter', 'at_risk',    false),
  ('Conversion Sequence',   'For high-scoring free users likely to upgrade (converting stage)', 'stage_enter', 'converting', false)
ON CONFLICT DO NOTHING;
