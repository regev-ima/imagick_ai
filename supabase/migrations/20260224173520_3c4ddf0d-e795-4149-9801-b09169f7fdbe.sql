
-- ============================================================================
-- Customer Journey Email System — Full Migration
-- ============================================================================

-- 1. Add journey_emails preference column
ALTER TABLE public.user_email_preferences
ADD COLUMN IF NOT EXISTS journey_emails boolean NOT NULL DEFAULT true;

-- 2. Create user_lifecycle_profiles table
CREATE TABLE IF NOT EXISTS public.user_lifecycle_profiles (
  user_id uuid PRIMARY KEY,
  lifecycle_stage text NOT NULL DEFAULT 'new',
  conversion_score integer NOT NULL DEFAULT 0,
  days_since_signup integer NOT NULL DEFAULT 0,
  gallery_count integer NOT NULL DEFAULT 0,
  images_processed integer NOT NULL DEFAULT 0,
  login_count integer NOT NULL DEFAULT 0,
  is_paid boolean NOT NULL DEFAULT false,
  last_active_at timestamp with time zone,
  previous_stage text,
  stage_changed_at timestamp with time zone,
  last_computed_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.user_lifecycle_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all lifecycle profiles"
ON public.user_lifecycle_profiles FOR ALL
USING (is_admin(auth.uid()));

CREATE POLICY "Users can view their own lifecycle profile"
ON public.user_lifecycle_profiles FOR SELECT
USING (auth.uid() = user_id);

-- 3. Create email_sequences table
CREATE TABLE IF NOT EXISTS public.email_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  trigger_type text NOT NULL DEFAULT 'stage_enter',
  trigger_value text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.email_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all sequences"
ON public.email_sequences FOR ALL
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can view all sequences"
ON public.email_sequences FOR SELECT
USING (is_admin(auth.uid()));

-- 4. Create email_sequence_steps table
CREATE TABLE IF NOT EXISTS public.email_sequence_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id uuid NOT NULL REFERENCES public.email_sequences(id) ON DELETE CASCADE,
  step_order integer NOT NULL DEFAULT 1,
  delay_hours integer NOT NULL DEFAULT 0,
  subject text NOT NULL,
  body_html text NOT NULL,
  email_type text NOT NULL DEFAULT 'journey_email',
  condition_check text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.email_sequence_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all sequence steps"
ON public.email_sequence_steps FOR ALL
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can view all sequence steps"
ON public.email_sequence_steps FOR SELECT
USING (is_admin(auth.uid()));

-- 5. Create user_sequence_enrollments table
CREATE TABLE IF NOT EXISTS public.user_sequence_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  sequence_id uuid NOT NULL REFERENCES public.email_sequences(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  current_step integer NOT NULL DEFAULT 1,
  enrolled_at timestamp with time zone NOT NULL DEFAULT now(),
  next_send_at timestamp with time zone,
  completed_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, sequence_id)
);

ALTER TABLE public.user_sequence_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all enrollments"
ON public.user_sequence_enrollments FOR ALL
USING (is_admin(auth.uid()));

CREATE POLICY "Users can view their own enrollments"
ON public.user_sequence_enrollments FOR SELECT
USING (auth.uid() = user_id);

-- 6. Create trigger for auto-creating lifecycle profile on signup
CREATE OR REPLACE FUNCTION public.create_default_lifecycle_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.user_lifecycle_profiles (user_id, lifecycle_stage, conversion_score)
  VALUES (NEW.id, 'new', 0)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Attach trigger to auth.users via subscription-based approach (trigger on user_subscriptions which is created on signup)
CREATE OR REPLACE FUNCTION public.create_lifecycle_on_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.user_lifecycle_profiles (user_id, lifecycle_stage, conversion_score)
  VALUES (NEW.user_id, 'new', 0)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER create_lifecycle_on_subscription_insert
AFTER INSERT ON public.user_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.create_lifecycle_on_subscription();

-- 7. Login count incrementer
CREATE OR REPLACE FUNCTION public.increment_lifecycle_login(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE public.user_lifecycle_profiles
  SET login_count = login_count + 1,
      last_active_at = now(),
      updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;

-- 8. Backfill lifecycle profiles for existing users
INSERT INTO public.user_lifecycle_profiles (user_id, lifecycle_stage, conversion_score)
SELECT user_id, 'new', 0
FROM public.user_subscriptions
ON CONFLICT (user_id) DO NOTHING;

-- 9. Seed the New User Onboarding sequence
INSERT INTO public.email_sequences (id, name, description, trigger_type, trigger_value, is_active)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'New User Onboarding',
  'Automated drip campaign to nurture new users toward becoming paying customers',
  'signup',
  'new',
  true
);

-- Step 1: Day 1 — Create Your First Gallery
INSERT INTO public.email_sequence_steps (sequence_id, step_order, delay_hours, subject, body_html, email_type, condition_check)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  1,
  24,
  'Ready to see the magic? Create your first gallery 📸',
  '<div class="badge">Getting Started</div>
<h1 class="title">Create your first <span class="title-grad">gallery</span> 📸</h1>
<p class="text">Hi {{first_name}},</p>
<p class="text">You signed up for Imagick.ai — great choice! But the real magic starts when you upload your first photos.</p>
<p class="text">It takes less than 2 minutes:</p>
<div style="margin: 20px 0;">
  <div style="display:flex; gap:14px; align-items:flex-start; margin-bottom:14px;">
    <div style="background:#e85c9b; color:#fff; font-weight:800; font-size:13px; width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; flex-shrink:0; text-align:center; line-height:24px;">1</div>
    <p style="margin:0; font-size:14px; color:#52525b;">Click <strong>"New Gallery"</strong> in your dashboard</p>
  </div>
  <div style="display:flex; gap:14px; align-items:flex-start; margin-bottom:14px;">
    <div style="background:#e85c9b; color:#fff; font-weight:800; font-size:13px; width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; flex-shrink:0; text-align:center; line-height:24px;">2</div>
    <p style="margin:0; font-size:14px; color:#52525b;">Upload a few photos (even 5 is enough to start)</p>
  </div>
  <div style="display:flex; gap:14px; align-items:flex-start;">
    <div style="background:#e85c9b; color:#fff; font-weight:800; font-size:13px; width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; flex-shrink:0; text-align:center; line-height:24px;">3</div>
    <p style="margin:0; font-size:14px; color:#52525b;">Watch the AI edit them in your style — automatically</p>
  </div>
</div>
<div class="cta-wrap">
  <a href="{{studio_url}}/dashboard/galleries/new" class="cta-btn">Create my first gallery →</a>
</div>
<hr class="divider" />
<p class="text" style="font-size:13px;">Need help? Just reply to this email.</p>',
  'journey_first_gallery',
  'no_gallery'
);

-- Step 2: Day 3 — Social Proof
INSERT INTO public.email_sequence_steps (sequence_id, step_order, delay_hours, subject, body_html, email_type, condition_check)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  2,
  72,
  'Photographers are editing 1,000+ photos in 10 minutes ⚡',
  '<div class="badge">What Others Are Doing</div>
<h1 class="title">See what other photographers are <span class="title-grad">creating</span> ⚡</h1>
<p class="text">Hi {{first_name}},</p>
<p class="text">While you were away, photographers on Imagick.ai have been doing some incredible things:</p>
<div class="info-box">
  <div class="info-row">
    <span class="info-label">Speed</span>
    <span class="info-value">1,000+ photos edited in under 10 minutes</span>
  </div>
  <div class="info-row">
    <span class="info-label">Consistency</span>
    <span class="info-value">AI-powered style matching across entire shoots</span>
  </div>
  <div class="info-row">
    <span class="info-label">Delivery</span>
    <span class="info-value">Client galleries shared with one click</span>
  </div>
</div>
<p class="text">The best part? <strong>You already have an account.</strong> All you need to do is upload your first photos.</p>
<div class="cta-wrap">
  <a href="{{studio_url}}/dashboard/galleries/new" class="cta-btn">Start now — it''s free →</a>
</div>
<hr class="divider" />
<p class="text" style="font-size:13px;">Your free plan includes enough credits to try it out. No credit card required.</p>',
  'journey_social_proof',
  'no_gallery'
);

-- Step 3: Day 7 — Upload More Photos
INSERT INTO public.email_sequence_steps (sequence_id, step_order, delay_hours, subject, body_html, email_type, condition_check)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  3,
  168,
  'Your gallery is looking good — add more photos! 📷',
  '<div class="badge">Keep Going</div>
<h1 class="title">Add more photos to <span class="title-grad">unlock the full power</span> 📷</h1>
<p class="text">Hi {{first_name}},</p>
<p class="text">You''ve made a great start with your first gallery! The more photos you upload, the better results you''ll get from the AI.</p>
<p class="text">Here''s why uploading more matters:</p>
<div class="info-box">
  <div class="info-row">
    <span class="info-label">AI Culling</span>
    <span class="info-value">Automatically picks the best shots from large batches</span>
  </div>
  <div class="info-row">
    <span class="info-label">Batch Edit</span>
    <span class="info-value">Edit hundreds of photos at once with consistent results</span>
  </div>
  <div class="info-row">
    <span class="info-label">Client Ready</span>
    <span class="info-value">Share a polished gallery your clients will love</span>
  </div>
</div>
<div class="cta-wrap">
  <a href="{{studio_url}}/dashboard/galleries" class="cta-btn">Upload more photos →</a>
</div>',
  'journey_upload_more',
  'low_images'
);

-- Step 4: Day 14 — Upgrade to Pro
INSERT INTO public.email_sequence_steps (sequence_id, step_order, delay_hours, subject, body_html, email_type, condition_check)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  4,
  336,
  'You''re outgrowing the free plan — upgrade to Pro 🚀',
  '<div class="badge">Level Up</div>
<h1 class="title">Ready to go <span class="title-grad">Pro?</span> 🚀</h1>
<p class="text">Hi {{first_name}},</p>
<p class="text">You''ve been using Imagick.ai and getting results. But you''re only scratching the surface.</p>
<p class="text"><strong>With Pro, you get:</strong></p>
<div class="info-box">
  <div class="info-row">
    <span class="info-label">More Credits</span>
    <span class="info-value">Edit thousands of photos per month</span>
  </div>
  <div class="info-row">
    <span class="info-label">AI Culling</span>
    <span class="info-value">Let AI pick the best shots — save hours</span>
  </div>
  <div class="info-row">
    <span class="info-label">Custom Styles</span>
    <span class="info-value">Train unlimited AI styles on your editing look</span>
  </div>
  <div class="info-row">
    <span class="info-label">Priority</span>
    <span class="info-value">Faster processing and priority support</span>
  </div>
</div>
<div class="cta-wrap">
  <a href="{{studio_url}}/dashboard/billing" class="cta-btn">See Pro plans →</a>
</div>
<hr class="divider" />
<p class="text" style="font-size:13px;">Have questions about which plan is right for you? Just reply to this email.</p>',
  'journey_upgrade',
  'free_plan'
);

-- Step 5: Day 21 — Re-engagement
INSERT INTO public.email_sequence_steps (sequence_id, step_order, delay_hours, subject, body_html, email_type, condition_check)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  5,
  504,
  'We miss you! Your AI editing studio is waiting 💜',
  '<div class="badge">We Miss You</div>
<h1 class="title">Your studio is <span class="title-grad">waiting for you</span> 💜</h1>
<p class="text">Hi {{first_name}},</p>
<p class="text">It''s been a while since we''ve seen you on Imagick.ai. We wanted to remind you that your account is still active and ready to go.</p>
<p class="text">Since you''ve been away, we''ve made some improvements:</p>
<div class="info-box">
  <div class="info-row">
    <span class="info-label">Faster AI</span>
    <span class="info-value">Processing speed improved by 3x</span>
  </div>
  <div class="info-row">
    <span class="info-label">Better Results</span>
    <span class="info-value">Enhanced colour accuracy and detail preservation</span>
  </div>
  <div class="info-row">
    <span class="info-label">New Features</span>
    <span class="info-value">AI Culling, Smart Grouping, and more</span>
  </div>
</div>
<p class="text">Your free credits are still available. Why not give it another try?</p>
<div class="cta-wrap">
  <a href="{{studio_url}}/dashboard" class="cta-btn">Come back to Imagick →</a>
</div>
<hr class="divider" />
<p class="text" style="font-size:13px;">If Imagick.ai isn''t the right fit, no hard feelings. You can unsubscribe from these emails below.</p>',
  'journey_reengagement',
  'inactive'
);

-- 10. Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;
