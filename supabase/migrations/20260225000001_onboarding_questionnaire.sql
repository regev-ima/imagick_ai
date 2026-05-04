-- ============================================================
-- Onboarding Questionnaire: stores post-registration answers
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_onboarding_responses (
  user_id            UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Step 1: Photography type & volume
  photography_types  TEXT[]      NOT NULL DEFAULT '{}',
  -- e.g. ['weddings', 'portraits', 'commercial', 'real_estate', 'nature', 'events', 'fashion', 'other']
  volume_per_month   TEXT,
  -- '<500' | '500-2000' | '2000-10000' | '10000+'

  -- Step 2: Workflow & challenges
  biggest_challenges TEXT[]      NOT NULL DEFAULT '{}',
  -- e.g. ['editing_time', 'consistent_style', 'client_feedback', 'delivery', 'other']
  current_tools      TEXT[]      NOT NULL DEFAULT '{}',
  -- e.g. ['lightroom', 'capture_one', 'luminar', 'photoshop', 'aftershoot', 'imagen_ai', 'manual', 'other']

  -- Step 3: Team & budget
  team_size          TEXT,
  -- 'solo' | '2-5' | '6-20' | '20+'
  monthly_budget     TEXT,
  -- '<20' | '20-50' | '50-100' | '100+'

  -- Control flags
  completed_at       TIMESTAMPTZ,
  skipped            BOOLEAN     NOT NULL DEFAULT FALSE,
  skipped_at         TIMESTAMPTZ,

  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.user_onboarding_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own onboarding responses" ON public.user_onboarding_responses;
CREATE POLICY "Users manage own onboarding responses"
  ON public.user_onboarding_responses FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins read all onboarding responses" ON public.user_onboarding_responses;
CREATE POLICY "Admins read all onboarding responses"
  ON public.user_onboarding_responses FOR SELECT
  USING (public.is_admin(auth.uid()));

-- Indexes for admin insights aggregation
CREATE INDEX IF NOT EXISTS idx_onboarding_completed
  ON public.user_onboarding_responses (completed_at)
  WHERE completed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_onboarding_photo_types
  ON public.user_onboarding_responses USING GIN (photography_types);

CREATE INDEX IF NOT EXISTS idx_onboarding_challenges
  ON public.user_onboarding_responses USING GIN (biggest_challenges);

CREATE INDEX IF NOT EXISTS idx_onboarding_tools
  ON public.user_onboarding_responses USING GIN (current_tools);
