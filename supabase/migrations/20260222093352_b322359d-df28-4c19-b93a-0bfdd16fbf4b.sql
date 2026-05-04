
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  device_type text,
  browser text,
  os text,
  ip_address text,
  screen_width integer,
  screen_height integer,
  color_scheme text,
  user_agent text
);

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Admins can read all sessions
CREATE POLICY "Admins can view all sessions"
ON public.user_sessions FOR SELECT
USING (is_admin(auth.uid()));

-- Authenticated users can insert their own sessions
CREATE POLICY "Users can insert own sessions"
ON public.user_sessions FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can view their own sessions
CREATE POLICY "Users can view own sessions"
ON public.user_sessions FOR SELECT
USING (auth.uid() = user_id);
