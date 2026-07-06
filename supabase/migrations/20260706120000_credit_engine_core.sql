-- =====================================================================
-- CREDIT ENGINE CORE (Phase 1)
--
-- 1. Plan versioning: price/terms changes create a NEW plan version;
--    existing subscribers stay pinned to the row they signed up for.
--    is_published controls the pricing page; deletion is blocked while
--    any subscription references the plan.
-- 2. New v2 plan generation: paid tiers move from unlimited (-1) to a
--    monthly credit allowance; free welcome drops 3000 -> 1500 for NEW
--    signups only (existing rows keep whatever they were seeded with).
-- 3. Purchased credits: credit_grants.expires_at becomes nullable —
--    NULL = never expires (consumer-protection-safe for paid top-ups).
-- 4. Monthly refill: calendar-anchored (credits_refilled_at) so YEARLY
--    subscribers still get their credits every month, independent of
--    PayPal's yearly payment event.
-- 5. Action pricing + top-up packs seeded into platform_settings so
--    admins can retune without a deploy.
-- =====================================================================

-- ---------------------------------------------------------------
-- 1. PLAN VERSIONING COLUMNS
-- ---------------------------------------------------------------
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS family_slug TEXT,
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT true;

UPDATE public.subscription_plans SET family_slug = slug WHERE family_slug IS NULL;

ALTER TABLE public.subscription_plans
  ALTER COLUMN family_slug SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_plans_family_version
  ON public.subscription_plans(family_slug, version);

-- Friendly delete protection: a plan with ANY subscription history
-- (active or not — invoices/analytics point at it too) cannot be
-- deleted, only unpublished. The FK is the hard backstop; this trigger
-- turns the failure into a clear message with the subscriber count.
CREATE OR REPLACE FUNCTION public.guard_plan_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.user_subscriptions
  WHERE plan_id = OLD.id OR scheduled_plan_id = OLD.id;

  IF v_count > 0 THEN
    RAISE EXCEPTION 'Plan "%" has % subscriber(s) and cannot be deleted. Unpublish it instead (is_published = false).',
      OLD.name, v_count
      USING ERRCODE = 'P0001';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS guard_plan_delete_trigger ON public.subscription_plans;
CREATE TRIGGER guard_plan_delete_trigger
  BEFORE DELETE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.guard_plan_delete();

-- ---------------------------------------------------------------
-- 2. V2 PLAN ROWS — credit allowances replace "unlimited"
--    The v2 row TAKES OVER the public slug (all slug-based lookups —
--    signup trigger, webhook downgrade-to-free, pricing page — resolve
--    to v2). The v1 row is renamed <slug>-v1 and unpublished; existing
--    user_subscriptions still point at it by id, so nothing changes for
--    current subscribers (paid v1 keeps edits_included = -1 unlimited —
--    that IS the legacy grandfathering).
-- ---------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
  v_new_id UUID;
  v_allowance INTEGER;
  v_features JSONB;
BEGIN
  FOR r IN
    SELECT * FROM public.subscription_plans
    WHERE slug IN ('free', 'starter', 'pro', 'studio') AND version = 1
  LOOP
    v_allowance := CASE r.slug
      WHEN 'free'    THEN 1500
      WHEN 'starter' THEN 5000
      WHEN 'pro'     THEN 15000
      WHEN 'studio'  THEN 40000
    END;
    v_features := CASE r.slug
      WHEN 'free'    THEN '["1,500 welcome credits", "All AI features included — culling, faces, editing", "5 pre-built AI styles", "5GB cloud storage", "Standard support"]'::jsonb
      WHEN 'starter' THEN '["5,000 credits every month", "AI culling, grouping & face recognition", "Unlimited galleries", "5 pre-built AI styles", "50GB cloud storage", "Email support"]'::jsonb
      WHEN 'pro'     THEN '["15,000 credits every month", "Everything in Starter", "2 Custom AI Models included", "Full style library (30+)", "500GB cloud storage", "Priority processing queue", "Chat + email support"]'::jsonb
      WHEN 'studio'  THEN '["40,000 credits every month", "Everything in Pro", "10 Custom AI Models", "Up to 10 team members", "2TB cloud storage", "API access", "Dedicated account manager"]'::jsonb
    END;

    -- Rename + unpublish the v1 row first (frees the slug).
    UPDATE public.subscription_plans
    SET slug = r.slug || '-v1', is_published = false
    WHERE id = r.id;

    -- Clone into v2 with the credit allowance, taking over the slug.
    INSERT INTO public.subscription_plans
      (name, slug, family_slug, version, is_published,
       price_monthly, price_yearly, edits_included, price_per_extra_edit,
       max_styles, max_storage_gb,
       has_ai_culling, has_full_style_library, has_team_access,
       has_api_access, has_priority_support,
       features, sort_order, is_active)
    VALUES
      (r.name, r.slug, r.family_slug, 2, true,
       r.price_monthly, r.price_yearly, v_allowance, r.price_per_extra_edit,
       r.max_styles, r.max_storage_gb,
       r.has_ai_culling, r.has_full_style_library, r.has_team_access,
       r.has_api_access, r.has_priority_support,
       v_features, r.sort_order, true)
    RETURNING id INTO v_new_id;

    -- Same price ⇒ the existing PayPal billing plans stay valid; just
    -- re-point their mappings at the v2 row so NEW subscribers resolve
    -- to v2 in the activation webhook. v1 subscribers are keyed by
    -- paypal_subscription_id, never re-mapped.
    UPDATE public.paypal_plan_mapping
    SET plan_id = v_new_id
    WHERE plan_id = r.id;
  END LOOP;
END $$;

-- ---------------------------------------------------------------
-- 3. PURCHASED CREDITS NEVER EXPIRE — expires_at becomes nullable
-- ---------------------------------------------------------------
ALTER TABLE public.credit_grants
  ALTER COLUMN expires_at DROP NOT NULL;

-- Depletion order: soonest-expiring first, never-expiring (purchased)
-- last — so gifts burn before paid credits.
CREATE OR REPLACE FUNCTION public.update_edits_on_usage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_to_deduct INTEGER := NEW.edits_spent;
  v_grant     RECORD;
  v_take      INTEGER;
BEGIN
  UPDATE public.user_subscriptions
  SET edits_used = edits_used + NEW.edits_spent,
      edits_remaining = CASE
        WHEN edits_remaining = -1 THEN -1
        ELSE GREATEST(0, edits_remaining - NEW.edits_spent)
      END,
      edits_reserved = GREATEST(0, edits_reserved - NEW.edits_spent),
      updated_at = now()
  WHERE user_id = NEW.user_id;

  IF v_to_deduct > 0 THEN
    FOR v_grant IN
      SELECT id, credits_remaining
      FROM public.credit_grants
      WHERE user_id = NEW.user_id
        AND status = 'active'
        AND credits_remaining > 0
      ORDER BY expires_at ASC NULLS LAST
      FOR UPDATE
    LOOP
      EXIT WHEN v_to_deduct <= 0;
      v_take := LEAST(v_to_deduct, v_grant.credits_remaining);
      UPDATE public.credit_grants
      SET credits_remaining = credits_remaining - v_take,
          status = CASE WHEN credits_remaining - v_take <= 0 THEN 'depleted' ELSE 'active' END
      WHERE id = v_grant.id;
      v_to_deduct := v_to_deduct - v_take;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;
-- (expire_credit_grants already filters expires_at <= now(), which a
-- NULL never satisfies — never-expiring grants are naturally immune.)

-- Sum of a user's active grant credits — used wherever the plan pool is
-- reset (monthly refill, downgrade-to-free) so gift/purchased credits
-- survive plan changes instead of being zeroed.
CREATE OR REPLACE FUNCTION public.sum_active_grant_credits(p_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(credits_remaining), 0)::INTEGER
  FROM public.credit_grants
  WHERE user_id = p_user_id
    AND status = 'active'
    AND credits_remaining > 0
    AND (expires_at IS NULL OR expires_at > now());
$$;

-- Server-side grant insert for PURCHASED credits (PayPal capture runs as
-- service role, not an admin user — admin_grant_credits requires auth.uid()).
CREATE OR REPLACE FUNCTION public.grant_purchased_credits(
  p_user_id UUID,
  p_amount  INTEGER,
  p_reason  TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grant_id UUID;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  INSERT INTO public.credit_grants
    (user_id, grant_type, credits_initial, credits_remaining, reason, expires_at)
  VALUES
    (p_user_id, 'purchased', p_amount, p_amount, p_reason, NULL)
  RETURNING id INTO v_grant_id;

  UPDATE public.user_subscriptions
  SET edits_remaining = CASE
        WHEN edits_remaining = -1 THEN -1
        ELSE edits_remaining + p_amount
      END,
      updated_at = now()
  WHERE user_id = p_user_id;

  RETURN v_grant_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.grant_purchased_credits(UUID, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------
-- 4. MONTHLY REFILL — calendar-anchored, billing-cycle independent
-- ---------------------------------------------------------------
ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS credits_refilled_at TIMESTAMPTZ;

-- Existing active paid subs start their refill clock now (they're all
-- legacy-unlimited so refill skips them anyway until they move to v2).
UPDATE public.user_subscriptions
SET credits_refilled_at = now()
WHERE credits_refilled_at IS NULL AND status = 'active';

-- Refill every ACTIVE sub on a metered paid plan whose last refill is
-- a month or more old. Pool = plan allowance + surviving grant credits;
-- edits_used resets so the meter reads "this month".
CREATE OR REPLACE FUNCTION public.refill_plan_credits()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub   RECORD;
  v_count INTEGER := 0;
BEGIN
  FOR v_sub IN
    SELECT us.user_id, us.credits_refilled_at, sp.edits_included
    FROM public.user_subscriptions us
    JOIN public.subscription_plans sp ON sp.id = us.plan_id
    WHERE us.status = 'active'
      AND sp.price_monthly > 0            -- paid plans only (free welcome is one-time)
      AND sp.edits_included > 0           -- skip legacy unlimited (-1)
      AND (us.credits_refilled_at IS NULL
           OR us.credits_refilled_at <= now() - INTERVAL '1 month')
    FOR UPDATE OF us
  LOOP
    UPDATE public.user_subscriptions
    SET edits_remaining = v_sub.edits_included + public.sum_active_grant_credits(v_sub.user_id),
        edits_used = 0,
        credits_refilled_at = now(),
        updated_at = now()
    WHERE user_id = v_sub.user_id;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.refill_plan_credits() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------
-- 5. SIMPLE (SUBSCRIPTION-LEVEL) CREDIT RESERVATION — used by the
--    culling/faces pipeline. Deliberately does NOT touch
--    galleries.edits_reserved, which belongs to the style-edit flow
--    (image-webhook decrements it per edit and releases at the end);
--    mixing the two counters would let one flow release the other's
--    reservation. The pipeline tracks its own share in
--    galleries.pipeline_billing instead.
-- ---------------------------------------------------------------
ALTER TABLE public.galleries
  ADD COLUMN IF NOT EXISTS pipeline_billing JSONB;

CREATE OR REPLACE FUNCTION public.reserve_credits_simple(p_user_id UUID, p_needed INTEGER)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows INTEGER;
BEGIN
  IF p_needed <= 0 THEN
    RETURN true;
  END IF;

  UPDATE public.user_subscriptions
  SET edits_reserved = edits_reserved + p_needed,
      updated_at = now()
  WHERE user_id = p_user_id
    AND (edits_remaining = -1 OR edits_remaining - edits_reserved >= p_needed);

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.reserve_credits_simple(UUID, INTEGER) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.release_credits_simple(p_user_id UUID, p_amount INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_amount > 0 THEN
    UPDATE public.user_subscriptions
    SET edits_reserved = GREATEST(0, edits_reserved - p_amount),
        updated_at = now()
    WHERE user_id = p_user_id;
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.release_credits_simple(UUID, INTEGER) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------
-- 6. INVOICE TYPES — allow one-time credit purchases. Also adds
--    'addon_priority', which paypal-capture-addon has been writing
--    all along but the constraint never allowed (silent insert
--    failures for priority-processing invoices).
-- ---------------------------------------------------------------
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_type_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_type_check
  CHECK (type IN ('subscription', 'addon_model', 'addon_storage', 'addon_priority', 'upgrade', 'renewal', 'credits'));

-- ---------------------------------------------------------------
-- 7. ACTION PRICING + TOP-UP PACKS (admin-tunable, no deploy needed)
-- ---------------------------------------------------------------
INSERT INTO public.platform_settings (key, value)
VALUES
  ('credit_pricing',
   '{"ai_edit": 1, "ai_culling": 0.2, "face_recognition": 0.1, "style_training": 1000}'),
  ('credit_packs',
   '[{"id":"pack_s","credits":1000,"usd":9},{"id":"pack_m","credits":5000,"usd":39},{"id":"pack_l","credits":15000,"usd":99}]')
ON CONFLICT (key) DO NOTHING;
