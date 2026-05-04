-- ============================================================
-- APPLY NEW PRICING MODEL
-- Run this in the Supabase SQL Editor to update plan data.
-- This script uses the CURRENT column names in production.
-- ============================================================

-- 1. Add has_full_style_library column if it doesn't exist
ALTER TABLE public.subscription_plans
ADD COLUMN IF NOT EXISTS has_full_style_library BOOLEAN NOT NULL DEFAULT false;

-- 2. Rename "Pay As You Go" → "Free" and update slug if needed
UPDATE public.subscription_plans
SET name = 'Free'
WHERE slug = 'free' AND name != 'Free';

-- 3. Rename "Basic" → "Starter"
UPDATE public.subscription_plans
SET name = 'Starter', slug = 'starter'
WHERE slug = 'basic';

-- 4. Update Free plan
UPDATE public.subscription_plans SET
  price_monthly = 0,
  price_yearly = 0,
  credits_per_month = 3000,
  max_styles = 0,
  max_storage_gb = 5,
  has_ai_culling = true,
  has_full_style_library = false,
  has_team_access = false,
  has_api_access = false,
  has_priority_support = false,
  price_per_extra_credit = 0,
  features = '["3,000 free AI edits", "5 pre-built AI styles", "Basic culling", "5GB cloud storage", "Standard support"]'::jsonb
WHERE slug = 'free';

-- 5. Update Starter plan (was Basic)
UPDATE public.subscription_plans SET
  price_monthly = 19,
  price_yearly = 180,
  credits_per_month = -1,
  max_styles = 0,
  max_storage_gb = 50,
  has_ai_culling = true,
  has_full_style_library = false,
  has_team_access = false,
  has_api_access = false,
  has_priority_support = false,
  price_per_extra_credit = 0,
  features = '["Unlimited AI edits", "Unlimited culling & grouping", "Unlimited galleries", "5 pre-built AI styles", "50GB cloud storage", "Email support"]'::jsonb
WHERE slug = 'starter';

-- 6. Update Pro plan
UPDATE public.subscription_plans SET
  price_monthly = 49,
  price_yearly = 468,
  credits_per_month = -1,
  max_styles = 2,
  max_storage_gb = 500,
  has_ai_culling = true,
  has_full_style_library = true,
  has_team_access = false,
  has_api_access = false,
  has_priority_support = true,
  price_per_extra_credit = 0,
  features = '["Everything in Starter", "2 Custom AI Models included", "Full style library (30+)", "500GB cloud storage", "Priority processing queue", "Chat + email support", "Extra models: $15 each"]'::jsonb
WHERE slug = 'pro';

-- 7. Update Studio plan
UPDATE public.subscription_plans SET
  price_monthly = 99,
  price_yearly = 948,
  credits_per_month = -1,
  max_styles = 10,
  max_storage_gb = 2048,
  has_ai_culling = true,
  has_full_style_library = true,
  has_team_access = true,
  has_api_access = true,
  has_priority_support = true,
  price_per_extra_credit = 0,
  features = '["Everything in Pro", "10 Custom AI Models", "Up to 10 team members", "Shared style library", "2TB cloud storage", "API access", "Dedicated account manager", "Extra models: $10 each"]'::jsonb
WHERE slug = 'studio';

-- 8. Verify results
SELECT name, slug, price_monthly, price_yearly, credits_per_month, max_styles, max_storage_gb, has_full_style_library
FROM public.subscription_plans
ORDER BY sort_order;
