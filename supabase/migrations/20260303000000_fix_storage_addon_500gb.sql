-- Fix: storage add-on should grant 500GB per purchase (was 100GB)
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

  SELECT COALESCE(SUM(quantity * 500), 0) INTO addon_gb
  FROM user_addons
  WHERE user_id = p_user_id AND addon_type = 'extra_storage' AND status = 'active';

  RETURN COALESCE(base_limit, 0) + addon_gb;
END;
$$;
