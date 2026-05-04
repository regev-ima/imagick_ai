-- 1. יצירת Enum לתפקידים
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION WHEN duplicate_object OR duplicate_table OR unique_violation THEN NULL; END $$;

-- 2. טבלת תפקידים
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  granted_by UUID REFERENCES auth.users(id),
  UNIQUE (user_id, role)
);

-- 3. Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. פונקציית בדיקת תפקיד (Security Definer)
DROP FUNCTION IF EXISTS public.has_role(UUID, app_role);
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 5. פונקציה לבדיקה אם המשתמש הוא Admin
DROP FUNCTION IF EXISTS public.is_admin(UUID);
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin'
  )
$$;

-- 6. טבלת תוכניות מנוי
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  price_monthly NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_yearly NUMERIC(10,2) NOT NULL DEFAULT 0,
  credits_per_month INTEGER NOT NULL DEFAULT 100,
  max_styles INTEGER NOT NULL DEFAULT 1,
  max_storage_gb INTEGER NOT NULL DEFAULT 5,
  has_ai_culling BOOLEAN NOT NULL DEFAULT false,
  has_team_access BOOLEAN NOT NULL DEFAULT false,
  has_api_access BOOLEAN NOT NULL DEFAULT false,
  has_priority_support BOOLEAN NOT NULL DEFAULT false,
  features JSONB DEFAULT '[]',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. טבלת מנויי משתמשים
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  plan_id UUID REFERENCES public.subscription_plans(id) NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',
  current_period_start DATE NOT NULL DEFAULT CURRENT_DATE,
  current_period_end DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '1 month'),
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  credits_used INTEGER NOT NULL DEFAULT 0,
  credits_remaining INTEGER NOT NULL DEFAULT 0,
  storage_used_mb INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Enable RLS
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

-- 9. RLS Policies for user_roles
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL
  USING (public.is_admin(auth.uid()));

-- 10. RLS Policies for subscription_plans
DROP POLICY IF EXISTS "Anyone can view active plans" ON public.subscription_plans;
CREATE POLICY "Anyone can view active plans"
  ON public.subscription_plans FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage plans" ON public.subscription_plans;
CREATE POLICY "Admins can manage plans"
  ON public.subscription_plans FOR ALL
  USING (public.is_admin(auth.uid()));

-- 11. RLS Policies for user_subscriptions
DROP POLICY IF EXISTS "Users can view own subscription" ON public.user_subscriptions;
CREATE POLICY "Users can view own subscription"
  ON public.user_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all subscriptions" ON public.user_subscriptions;
CREATE POLICY "Admins can view all subscriptions"
  ON public.user_subscriptions FOR SELECT
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage all subscriptions" ON public.user_subscriptions;
CREATE POLICY "Admins can manage all subscriptions"
  ON public.user_subscriptions FOR ALL
  USING (public.is_admin(auth.uid()));

-- 12. Admin policies for galleries
DROP POLICY IF EXISTS "Admins can view all galleries" ON public.galleries;
CREATE POLICY "Admins can view all galleries"
  ON public.galleries FOR SELECT
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update all galleries" ON public.galleries;
CREATE POLICY "Admins can update all galleries"
  ON public.galleries FOR UPDATE
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete all galleries" ON public.galleries;
CREATE POLICY "Admins can delete all galleries"
  ON public.galleries FOR DELETE
  USING (public.is_admin(auth.uid()));

-- 13. Admin policies for styles
DROP POLICY IF EXISTS "Admins can view all styles" ON public.styles;
CREATE POLICY "Admins can view all styles"
  ON public.styles FOR SELECT
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update all styles" ON public.styles;
CREATE POLICY "Admins can update all styles"
  ON public.styles FOR UPDATE
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete all styles" ON public.styles;
CREATE POLICY "Admins can delete all styles"
  ON public.styles FOR DELETE
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can insert styles" ON public.styles;
CREATE POLICY "Admins can insert styles"
  ON public.styles FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

-- 14. Admin policies for gallery_images
DROP POLICY IF EXISTS "Admins can view all gallery images" ON public.gallery_images;
CREATE POLICY "Admins can view all gallery images"
  ON public.gallery_images FOR SELECT
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage all gallery images" ON public.gallery_images;
CREATE POLICY "Admins can manage all gallery images"
  ON public.gallery_images FOR ALL
  USING (public.is_admin(auth.uid()));

-- 15. הוספת נתונים התחלתיים לתוכניות
INSERT INTO public.subscription_plans 
  (name, slug, price_monthly, price_yearly, credits_per_month, max_styles, max_storage_gb, has_ai_culling, has_team_access, has_api_access, has_priority_support, sort_order, features)
VALUES
  ('Pay As You Go', 'free', 0, 0, 100, 1, 5, false, false, false, false, 0, '["100 credits per month", "1 custom style", "5GB storage", "Basic support"]'::jsonb),
  ('Basic', 'basic', 19, 182, 1000, 3, 25, false, false, false, false, 1, '["1,000 credits per month", "3 custom styles", "25GB storage", "Email support"]'::jsonb),
  ('Pro', 'pro', 49, 470, 5000, 10, 100, true, false, false, true, 2, '["5,000 credits per month", "10 custom styles", "100GB storage", "AI Culling", "Priority support"]'::jsonb),
  ('Studio', 'studio', 149, 1430, 20000, -1, 500, true, true, true, true, 3, '["20,000 credits per month", "Unlimited styles", "500GB storage", "AI Culling", "Team access", "API access", "Priority support"]'::jsonb);

-- 16. Trigger to update updated_at
DROP TRIGGER IF EXISTS update_user_subscriptions_updated_at ON public.user_subscriptions;
CREATE TRIGGER update_user_subscriptions_updated_at
  BEFORE UPDATE ON public.user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();