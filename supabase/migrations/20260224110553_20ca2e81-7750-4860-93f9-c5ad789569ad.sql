
-- 1. onboarding_questions
CREATE TABLE public.onboarding_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  subtitle TEXT,
  question_type TEXT NOT NULL DEFAULT 'pill_select',
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  allow_multiple BOOLEAN NOT NULL DEFAULT false,
  max_selections INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.onboarding_questions ENABLE ROW LEVEL SECURITY;

-- Everyone can read active questions
CREATE POLICY "Anyone can read active questions"
  ON public.onboarding_questions FOR SELECT
  USING (is_active = true);

-- Admins can read all (including inactive)
CREATE POLICY "Admins can read all questions"
  ON public.onboarding_questions FOR SELECT
  USING (is_admin(auth.uid()));

-- Admins can manage questions
CREATE POLICY "Admins can manage questions"
  ON public.onboarding_questions FOR ALL
  USING (is_admin(auth.uid()));

-- 2. onboarding_answers
CREATE TABLE public.onboarding_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.onboarding_questions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  answer JSONB NOT NULL DEFAULT '[]'::jsonb,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(question_id, user_id)
);

ALTER TABLE public.onboarding_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own answers"
  ON public.onboarding_answers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own answers"
  ON public.onboarding_answers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own answers"
  ON public.onboarding_answers FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all answers"
  ON public.onboarding_answers FOR SELECT
  USING (is_admin(auth.uid()));

-- 3. onboarding_skips
CREATE TABLE public.onboarding_skips (
  user_id UUID PRIMARY KEY,
  skipped_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.onboarding_skips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own skips"
  ON public.onboarding_skips FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own skips"
  ON public.onboarding_skips FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Trigger for updated_at on questions
CREATE TRIGGER update_onboarding_questions_updated_at
  BEFORE UPDATE ON public.onboarding_questions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Seed the 6 existing questions
INSERT INTO public.onboarding_questions (question_key, title, subtitle, question_type, options, sort_order, allow_multiple, max_selections) VALUES
(
  'photography_types',
  'What do you shoot?',
  'Select all that apply',
  'grid_select',
  '[{"id":"weddings","label":"Weddings","icon":"heart"},{"id":"portraits","label":"Portraits","icon":"user"},{"id":"events","label":"Events","icon":"calendar"},{"id":"commercial","label":"Commercial","icon":"briefcase"},{"id":"landscape","label":"Landscape","icon":"mountain"},{"id":"real_estate","label":"Real Estate","icon":"home"},{"id":"fashion","label":"Fashion","icon":"shirt"},{"id":"food","label":"Food","icon":"utensils"},{"id":"sports","label":"Sports","icon":"trophy"},{"id":"newborn","label":"Newborn","icon":"baby"},{"id":"wildlife","label":"Wildlife","icon":"bird"},{"id":"other","label":"Other","icon":"camera"}]',
  1, true, null
),
(
  'volume_per_month',
  'How many photos do you edit per month?',
  'Rough estimate is fine',
  'pill_select',
  '[{"id":"<500","label":"< 500"},{"id":"500-2000","label":"500 – 2,000"},{"id":"2000-5000","label":"2,000 – 5,000"},{"id":"5000-10000","label":"5,000 – 10,000"},{"id":">10000","label":"10,000+"}]',
  2, false, null
),
(
  'biggest_challenges',
  'What''s your biggest editing challenge?',
  'Pick up to 3',
  'list_select',
  '[{"id":"time","label":"Takes too long"},{"id":"consistency","label":"Keeping a consistent look"},{"id":"culling","label":"Selecting the best shots"},{"id":"color","label":"Color accuracy"},{"id":"batch","label":"Batch processing"},{"id":"delivery","label":"Fast client delivery"},{"id":"learning","label":"Learning new tools"},{"id":"cost","label":"Software costs"}]',
  3, true, 3
),
(
  'current_tools',
  'What tools do you currently use?',
  'Select all that apply',
  'pill_select',
  '[{"id":"lightroom","label":"Lightroom"},{"id":"photoshop","label":"Photoshop"},{"id":"capture_one","label":"Capture One"},{"id":"luminar","label":"Luminar"},{"id":"aftershoot","label":"Aftershoot"},{"id":"imagen","label":"Imagen"},{"id":"photoai","label":"Photo AI"},{"id":"other","label":"Other"}]',
  4, true, null
),
(
  'team_size',
  'What''s your team size?',
  null,
  'grid_select',
  '[{"id":"solo","label":"Just me","icon":"user"},{"id":"2-5","label":"2–5 people","icon":"users"},{"id":"6-20","label":"6–20 people","icon":"users"},{"id":"20+","label":"20+ people","icon":"building"}]',
  5, false, null
),
(
  'monthly_budget',
  'Monthly budget for editing tools?',
  null,
  'pill_select',
  '[{"id":"free","label":"Free only"},{"id":"<50","label":"< $50"},{"id":"50-100","label":"$50 – $100"},{"id":"100-300","label":"$100 – $300"},{"id":">300","label":"$300+"}]',
  6, false, null
);
