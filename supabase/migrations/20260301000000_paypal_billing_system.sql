-- =====================================================================
-- Phase 0: PayPal Billing System Migration
-- Renames credits→edits, updates plans, adds PayPal support, creates
-- new tables for invoices, webhooks, add-ons, and plan mappings.
-- =====================================================================

-- =====================================================================
-- 1. RENAME COLUMNS: credits → edits
-- =====================================================================

-- subscription_plans
ALTER TABLE public.subscription_plans RENAME COLUMN credits_per_month TO edits_included;
ALTER TABLE public.subscription_plans RENAME COLUMN price_per_extra_credit TO price_per_extra_edit;

-- user_subscriptions
ALTER TABLE public.user_subscriptions RENAME COLUMN credits_used TO edits_used;
ALTER TABLE public.user_subscriptions RENAME COLUMN credits_remaining TO edits_remaining;

-- credit_usage_logs → edit_usage_logs
ALTER TABLE public.credit_usage_logs RENAME TO edit_usage_logs;
ALTER TABLE public.edit_usage_logs RENAME COLUMN credits_spent TO edits_spent;

-- Rename indexes
ALTER INDEX idx_credit_usage_logs_user_id RENAME TO idx_edit_usage_logs_user_id;
ALTER INDEX idx_credit_usage_logs_created_at RENAME TO idx_edit_usage_logs_created_at;

-- =====================================================================
-- 2. DROP OLD RLS POLICIES on edit_usage_logs (they reference old name)
-- =====================================================================

DROP POLICY IF EXISTS "Users can view their own credit logs" ON public.edit_usage_logs;
DROP POLICY IF EXISTS "Deny direct inserts to credit logs" ON public.edit_usage_logs;
DROP POLICY IF EXISTS "Deny updates to credit logs" ON public.edit_usage_logs;
DROP POLICY IF EXISTS "Deny deletes from credit logs" ON public.edit_usage_logs;

-- Recreate with new names
CREATE POLICY "Users can view their own edit logs"
ON public.edit_usage_logs FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Deny direct inserts to edit logs"
ON public.edit_usage_logs FOR INSERT
TO authenticated WITH CHECK (false);

CREATE POLICY "Deny updates to edit logs"
ON public.edit_usage_logs FOR UPDATE
TO authenticated USING (false);

CREATE POLICY "Deny deletes from edit logs"
ON public.edit_usage_logs FOR DELETE
TO authenticated USING (false);

-- =====================================================================
-- 3. RENAME PLAN: basic → starter, UPDATE PLAN DATA
-- =====================================================================

UPDATE public.subscription_plans SET name = 'Starter', slug = 'starter' WHERE slug = 'basic';

-- Free: $0, 3000 lifetime edits, 0 custom styles, 50GB storage
UPDATE public.subscription_plans
SET price_monthly = 0, price_yearly = 0, edits_included = 3000,
    max_styles = 0, max_storage_gb = 50,
    has_ai_culling = false, has_team_access = false, has_api_access = false, has_priority_support = false,
    price_per_extra_edit = 0,
    features = '["3,000 free AI edits", "50GB cloud storage", "View galleries", "Standard support"]'::jsonb
WHERE slug = 'free';

-- Starter: $9/mo, $86/yr, unlimited edits, 1 custom style, 300GB
UPDATE public.subscription_plans
SET price_monthly = 9, price_yearly = 86, edits_included = -1,
    max_styles = 1, max_storage_gb = 300,
    has_ai_culling = true, has_team_access = false, has_api_access = false, has_priority_support = false,
    price_per_extra_edit = 0,
    features = '["Unlimited AI edits", "1 custom style", "300GB storage", "Smart Culling", "Standard support"]'::jsonb
WHERE slug = 'starter';

-- Pro: $19/mo, $182/yr, unlimited edits, 5 custom styles, 1TB
UPDATE public.subscription_plans
SET price_monthly = 19, price_yearly = 182, edits_included = -1,
    max_styles = 5, max_storage_gb = 1024,
    has_ai_culling = true, has_team_access = false, has_api_access = false, has_priority_support = true,
    price_per_extra_edit = 0,
    features = '["Unlimited AI edits", "Up to 5 custom styles", "1TB storage", "Smart Culling", "Priority support"]'::jsonb
WHERE slug = 'pro';

-- Studio: $29/mo, $278/yr, unlimited edits, 10 custom styles, 2TB
UPDATE public.subscription_plans
SET price_monthly = 29, price_yearly = 278, edits_included = -1,
    max_styles = 10, max_storage_gb = 2048,
    has_ai_culling = true, has_team_access = true, has_api_access = true, has_priority_support = true,
    price_per_extra_edit = 0,
    features = '["Unlimited AI edits", "Up to 10 custom styles", "2TB storage", "Smart Culling", "Team access", "API access", "Priority support"]'::jsonb
WHERE slug = 'studio';

-- =====================================================================
-- 4. ADD PAYPAL COLUMNS TO user_subscriptions
-- =====================================================================

ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS paypal_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS paypal_plan_id TEXT,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS scheduled_plan_id UUID REFERENCES public.subscription_plans(id),
  ADD COLUMN IF NOT EXISTS scheduled_change_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspension_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_payment_at TIMESTAMPTZ;

-- =====================================================================
-- 5. UPDATE TRIGGERS FOR NEW COLUMN NAMES
-- =====================================================================

-- Drop old triggers
DROP TRIGGER IF EXISTS on_credit_usage_logged ON public.edit_usage_logs;
DROP FUNCTION IF EXISTS public.update_credits_on_usage();

-- New edit deduction trigger (skips unlimited plans where edits_remaining = -1)
CREATE OR REPLACE FUNCTION public.update_edits_on_usage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_subscriptions
  SET edits_used = edits_used + NEW.edits_spent,
      edits_remaining = CASE
        WHEN edits_remaining = -1 THEN -1
        ELSE GREATEST(0, edits_remaining - NEW.edits_spent)
      END,
      updated_at = now()
  WHERE user_id = NEW.user_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_edit_usage_logged
  AFTER INSERT ON public.edit_usage_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_edits_on_usage();

-- Update signup trigger to give 3000 edits
DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;

CREATE OR REPLACE FUNCTION public.create_default_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_subscriptions (user_id, plan_id, status, edits_remaining)
  SELECT NEW.id, sp.id, 'active', sp.edits_included
  FROM public.subscription_plans sp
  WHERE sp.slug = 'free'
  LIMIT 1;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_subscription();

-- =====================================================================
-- 6. UPDATE EXISTING FREE USERS to 3000 edits
-- =====================================================================

UPDATE public.user_subscriptions us
SET edits_remaining = GREATEST(0, 3000 - us.edits_used)
FROM public.subscription_plans sp
WHERE us.plan_id = sp.id AND sp.slug = 'free';

-- =====================================================================
-- 7. CREATE INVOICES TABLE
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  invoice_number TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'subscription'
    CHECK (type IN ('subscription', 'addon_model', 'addon_storage', 'upgrade', 'renewal')),
  description TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'paid'
    CHECK (status IN ('paid', 'pending', 'failed', 'refunded')),
  paypal_transaction_id TEXT,
  plan_id UUID REFERENCES public.subscription_plans(id),
  billing_cycle TEXT,
  pdf_storage_path TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own invoices"
ON public.invoices FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all invoices"
ON public.invoices FOR ALL
USING (public.is_admin(auth.uid()));

CREATE INDEX idx_invoices_user_id ON public.invoices(user_id);
CREATE INDEX idx_invoices_created_at ON public.invoices(created_at);

-- Invoice number sequence
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START WITH 1001;

-- =====================================================================
-- 8. CREATE PAYPAL WEBHOOK EVENTS TABLE (idempotency + audit)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.paypal_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  payload JSONB NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT false,
  processing_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

ALTER TABLE public.paypal_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view webhook events"
ON public.paypal_webhook_events FOR ALL
USING (public.is_admin(auth.uid()));

CREATE INDEX idx_paypal_webhook_event_id ON public.paypal_webhook_events(event_id);
CREATE INDEX idx_paypal_webhook_event_type ON public.paypal_webhook_events(event_type);

-- =====================================================================
-- 9. CREATE PAYPAL PLAN MAPPING TABLE
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.paypal_plan_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
  paypal_plan_id TEXT NOT NULL,
  is_sandbox BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(plan_id, billing_cycle, is_sandbox)
);

ALTER TABLE public.paypal_plan_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read PayPal plan mappings"
ON public.paypal_plan_mapping FOR SELECT USING (true);

CREATE POLICY "Admins can manage PayPal plan mappings"
ON public.paypal_plan_mapping FOR ALL
USING (public.is_admin(auth.uid()));

-- =====================================================================
-- 10. CREATE USER ADD-ONS TABLE
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.user_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  addon_type TEXT NOT NULL CHECK (addon_type IN ('extra_model', 'extra_storage')),
  quantity INTEGER NOT NULL DEFAULT 1,
  paypal_order_id TEXT,
  invoice_id UUID REFERENCES public.invoices(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_addons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own addons"
ON public.user_addons FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all addons"
ON public.user_addons FOR ALL
USING (public.is_admin(auth.uid()));

CREATE INDEX idx_user_addons_user_id ON public.user_addons(user_id);

-- =====================================================================
-- 11. HELPER FUNCTIONS for effective limits (plan + add-ons)
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_effective_model_limit(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_limit INTEGER;
  addon_count INTEGER;
BEGIN
  SELECT sp.max_styles INTO base_limit
  FROM user_subscriptions us
  JOIN subscription_plans sp ON us.plan_id = sp.id
  WHERE us.user_id = p_user_id;

  SELECT COALESCE(SUM(quantity), 0) INTO addon_count
  FROM user_addons
  WHERE user_id = p_user_id AND addon_type = 'extra_model' AND status = 'active';

  RETURN COALESCE(base_limit, 0) + addon_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_effective_storage_limit(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_limit INTEGER;
  addon_gb INTEGER;
BEGIN
  SELECT sp.max_storage_gb INTO base_limit
  FROM user_subscriptions us
  JOIN subscription_plans sp ON us.plan_id = sp.id
  WHERE us.user_id = p_user_id;

  SELECT COALESCE(SUM(quantity * 100), 0) INTO addon_gb
  FROM user_addons
  WHERE user_id = p_user_id AND addon_type = 'extra_storage' AND status = 'active';

  RETURN COALESCE(base_limit, 0) + addon_gb;
END;
$$;
