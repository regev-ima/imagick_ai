
-- ── email_logs ────────────────────────────────────────────────────────────
CREATE TABLE public.email_logs (
  id                UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID        NULL,
  recipient_email   TEXT        NOT NULL,
  email_type        TEXT        NOT NULL,
  subject           TEXT        NOT NULL,
  status            TEXT        NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','failed','skipped')),
  resend_message_id TEXT        NULL,
  error_message     TEXT        NULL,
  metadata          JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view all logs
CREATE POLICY "Admins can view all email logs"
  ON public.email_logs FOR SELECT
  USING (is_admin(auth.uid()));

-- Service role inserts (via edge functions with service role key) bypass RLS automatically.
-- We still allow authenticated users to read their own logs for settings pages.
CREATE POLICY "Users can view their own email logs"
  ON public.email_logs FOR SELECT
  USING (auth.uid() = user_id);

-- ── user_email_preferences ────────────────────────────────────────────────
CREATE TABLE public.user_email_preferences (
  user_id                 UUID    NOT NULL UNIQUE,
  welcome_email           BOOLEAN NOT NULL DEFAULT true,
  gallery_upload_complete BOOLEAN NOT NULL DEFAULT true,
  gallery_images_ready    BOOLEAN NOT NULL DEFAULT true,
  style_training_started  BOOLEAN NOT NULL DEFAULT true,
  style_ready             BOOLEAN NOT NULL DEFAULT true,
  re_edit_submitted       BOOLEAN NOT NULL DEFAULT true,
  re_edit_complete        BOOLEAN NOT NULL DEFAULT true,
  gallery_shared          BOOLEAN NOT NULL DEFAULT true,
  subscription_change     BOOLEAN NOT NULL DEFAULT true,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_email_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own email preferences"
  ON public.user_email_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own email preferences"
  ON public.user_email_preferences FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own email preferences"
  ON public.user_email_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Trigger to keep updated_at fresh
CREATE TRIGGER update_user_email_preferences_updated_at
  BEFORE UPDATE ON public.user_email_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for fast lookup by user_id
CREATE INDEX idx_email_logs_user_id    ON public.email_logs (user_id);
CREATE INDEX idx_email_logs_created_at ON public.email_logs (created_at DESC);
CREATE INDEX idx_email_logs_status     ON public.email_logs (status);
CREATE INDEX idx_email_logs_email_type ON public.email_logs (email_type);
