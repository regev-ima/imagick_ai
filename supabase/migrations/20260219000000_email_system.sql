-- ============================================================
-- Email System: email_logs + user_email_preferences
-- ============================================================

-- ------------------------------------
-- 1. email_logs
-- ------------------------------------
CREATE TABLE IF NOT EXISTS public.email_logs (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient_email     TEXT        NOT NULL,
  email_type          TEXT        NOT NULL,
  subject             TEXT        NOT NULL,
  -- 'sent' | 'failed' | 'skipped' (user opted out)
  status              TEXT        NOT NULL DEFAULT 'sent',
  resend_message_id   TEXT,
  error_message       TEXT,
  metadata            JSONB       NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS email_logs_user_id_idx    ON public.email_logs (user_id);
CREATE INDEX IF NOT EXISTS email_logs_created_at_idx ON public.email_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS email_logs_email_type_idx ON public.email_logs (email_type);
CREATE INDEX IF NOT EXISTS email_logs_status_idx     ON public.email_logs (status);

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own email logs" ON public.email_logs;
CREATE POLICY "Users can view own email logs"
  ON public.email_logs FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all email logs" ON public.email_logs;
CREATE POLICY "Admins can view all email logs"
  ON public.email_logs FOR SELECT
  USING (public.is_admin(auth.uid()));

-- ------------------------------------
-- 2. user_email_preferences
-- ------------------------------------
CREATE TABLE IF NOT EXISTS public.user_email_preferences (
  user_id                 UUID    PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Transactional emails (on by default)
  welcome_email           BOOLEAN NOT NULL DEFAULT TRUE,
  gallery_upload_complete BOOLEAN NOT NULL DEFAULT TRUE,
  gallery_images_ready    BOOLEAN NOT NULL DEFAULT TRUE,
  style_training_started  BOOLEAN NOT NULL DEFAULT TRUE,
  style_ready             BOOLEAN NOT NULL DEFAULT TRUE,
  re_edit_submitted       BOOLEAN NOT NULL DEFAULT TRUE,
  re_edit_complete        BOOLEAN NOT NULL DEFAULT TRUE,
  gallery_shared          BOOLEAN NOT NULL DEFAULT TRUE,
  subscription_change     BOOLEAN NOT NULL DEFAULT TRUE,
  -- Timestamps
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_email_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own email preferences" ON public.user_email_preferences;
CREATE POLICY "Users can manage own email preferences"
  ON public.user_email_preferences FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Auto-create a preferences row for each new user
DROP FUNCTION IF EXISTS public.create_default_email_preferences();
CREATE OR REPLACE FUNCTION public.create_default_email_preferences()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_email_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_email_prefs ON auth.users;
CREATE TRIGGER on_auth_user_created_email_prefs
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_email_preferences();
