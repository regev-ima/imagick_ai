-- Migration: Update pricing model to new tiers
-- Free: $0, Starter: $19/$180, Pro: $49/$468, Studio: $99/$948

-- Add has_full_style_library column to distinguish 5 preset vs 30+ full library
ALTER TABLE public.subscription_plans
ADD COLUMN IF NOT EXISTS has_full_style_library BOOLEAN NOT NULL DEFAULT false;

-- Update Free plan
UPDATE public.subscription_plans SET
  price_monthly = 0,
  price_yearly = 0,
  edits_included = 3000,
  max_styles = 0,
  max_storage_gb = 5,
  has_ai_culling = true,
  has_full_style_library = false,
  has_team_access = false,
  has_api_access = false,
  has_priority_support = false,
  price_per_extra_edit = 0,
  features = '["3,000 free AI edits", "5 pre-built AI styles", "Basic culling", "5GB cloud storage", "Standard support"]'::jsonb
WHERE slug = 'free';

-- Update Starter plan
UPDATE public.subscription_plans SET
  price_monthly = 19,
  price_yearly = 180,
  edits_included = -1,
  max_styles = 0,
  max_storage_gb = 50,
  has_ai_culling = true,
  has_full_style_library = false,
  has_team_access = false,
  has_api_access = false,
  has_priority_support = false,
  price_per_extra_edit = 0,
  features = '["Unlimited AI edits", "Unlimited culling & grouping", "Unlimited galleries", "5 pre-built AI styles", "50GB cloud storage", "Email support"]'::jsonb
WHERE slug = 'starter';

-- Update Pro plan
UPDATE public.subscription_plans SET
  price_monthly = 49,
  price_yearly = 468,
  edits_included = -1,
  max_styles = 2,
  max_storage_gb = 500,
  has_ai_culling = true,
  has_full_style_library = true,
  has_team_access = false,
  has_api_access = false,
  has_priority_support = true,
  price_per_extra_edit = 0,
  features = '["Everything in Starter", "2 Custom AI Models included", "Full style library (30+)", "500GB cloud storage", "Priority processing queue", "Chat + email support", "Extra models: $15 each"]'::jsonb
WHERE slug = 'pro';

-- Update Studio plan
UPDATE public.subscription_plans SET
  price_monthly = 99,
  price_yearly = 948,
  edits_included = -1,
  max_styles = 10,
  max_storage_gb = 2048,
  has_ai_culling = true,
  has_full_style_library = true,
  has_team_access = true,
  has_api_access = true,
  has_priority_support = true,
  price_per_extra_edit = 0,
  features = '["Everything in Pro", "10 Custom AI Models", "Up to 10 team members", "Shared style library", "2TB cloud storage", "API access", "Dedicated account manager", "Extra models: $10 each"]'::jsonb
WHERE slug = 'studio';

-- Add priority_processing to allowed addon types
ALTER TABLE public.user_addons
DROP CONSTRAINT IF EXISTS user_addons_addon_type_check;

DO $$ BEGIN
  ALTER TABLE public.user_addons
ADD CONSTRAINT user_addons_addon_type_check
CHECK (addon_type IN ('extra_model', 'extra_storage', 'priority_processing'));
EXCEPTION WHEN duplicate_object OR duplicate_table OR unique_violation THEN NULL; END $$;
