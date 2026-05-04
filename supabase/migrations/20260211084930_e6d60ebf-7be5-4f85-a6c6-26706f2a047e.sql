
-- 1. Auto-create subscription for new users
CREATE OR REPLACE FUNCTION public.create_default_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_subscriptions (user_id, plan_id, status, credits_remaining)
  SELECT NEW.id, sp.id, 'active', sp.credits_per_month
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

-- 2. Credit deduction trigger
CREATE OR REPLACE FUNCTION public.update_credits_on_usage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_subscriptions
  SET credits_used = credits_used + NEW.credits_spent,
      credits_remaining = GREATEST(0, credits_remaining - NEW.credits_spent),
      updated_at = now()
  WHERE user_id = NEW.user_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_credit_usage_logged
  AFTER INSERT ON public.credit_usage_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_credits_on_usage();

-- 3. Storage recalculation function
CREATE OR REPLACE FUNCTION public.recalculate_user_storage(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_bytes bigint;
BEGIN
  SELECT COALESCE(SUM(file_size_bytes), 0) INTO total_bytes
  FROM public.gallery_images
  WHERE user_id = p_user_id;

  UPDATE public.user_subscriptions
  SET storage_used_mb = CEIL(total_bytes::numeric / (1024 * 1024)),
      updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;

-- 4. Auto-update storage on image insert/delete
CREATE OR REPLACE FUNCTION public.update_storage_on_image_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalculate_user_storage(OLD.user_id);
    RETURN OLD;
  ELSE
    PERFORM public.recalculate_user_storage(NEW.user_id);
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER on_gallery_image_storage_change
  AFTER INSERT OR DELETE ON public.gallery_images
  FOR EACH ROW
  EXECUTE FUNCTION public.update_storage_on_image_change();

-- 5. Insert subscription for existing users without one
INSERT INTO public.user_subscriptions (user_id, plan_id, status, credits_remaining)
SELECT u.id, sp.id, 'active', sp.credits_per_month
FROM auth.users u
CROSS JOIN (SELECT id, credits_per_month FROM public.subscription_plans WHERE slug = 'free' LIMIT 1) sp
WHERE u.id NOT IN (SELECT user_id FROM public.user_subscriptions);
