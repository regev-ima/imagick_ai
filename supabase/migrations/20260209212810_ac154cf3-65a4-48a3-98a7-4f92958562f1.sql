
ALTER TABLE public.subscription_plans
ADD COLUMN price_per_extra_credit numeric NOT NULL DEFAULT 0.030;

-- Set per-plan pricing
UPDATE public.subscription_plans SET price_per_extra_credit = 0.030 WHERE slug = 'pay_as_you_go';
UPDATE public.subscription_plans SET price_per_extra_credit = 0.020 WHERE slug = 'basic';
UPDATE public.subscription_plans SET price_per_extra_credit = 0.018 WHERE slug = 'pro';
UPDATE public.subscription_plans SET price_per_extra_credit = 0.015 WHERE slug = 'studio';
