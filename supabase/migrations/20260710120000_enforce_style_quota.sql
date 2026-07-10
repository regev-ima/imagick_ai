-- =====================================================================
-- Enforce the per-plan Custom AI Model quota at the database layer.
--
-- Until now `subscription_plans.max_styles` (Free = 0, paid tiers 1/5/10,
-- -1 = unlimited) plus `extra_model` add-ons were only ever DISPLAYED — the
-- create path (StylesPage buttons → CreateStylePage insert, train-style)
-- never checked it, so a Free (0-model) user could train unlimited custom
-- styles. This closes the hole with a BEFORE INSERT trigger that is
-- impossible to bypass from the client.
--
-- A "slot" is a top-level custom model the user owns and can see in their
-- list: is_preset = false, father_style_id IS NULL (retrains are versions of
-- an existing model, not new slots), is_active, and not soft-deleted. That
-- matches exactly what StylesPage counts as "your models".
-- =====================================================================

-- 1. get_effective_model_limit must treat a negative base limit as
--    UNLIMITED. The previous body did COALESCE(base,0) + addons, so an
--    unlimited plan (-1) that also carried an extra_model add-on would
--    resolve to a small positive number and wrongly cap the user.
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

  -- Negative base = unlimited; add-ons are irrelevant.
  IF base_limit IS NOT NULL AND base_limit < 0 THEN
    RETURN -1;
  END IF;

  SELECT COALESCE(SUM(quantity), 0) INTO addon_count
  FROM user_addons
  WHERE user_id = p_user_id AND addon_type = 'extra_model' AND status = 'active';

  RETURN COALESCE(base_limit, 0) + addon_count;
END;
$$;

-- 2. Canonical "slots used" count. Kept as a function so the trigger and any
--    future server code agree on one definition.
CREATE OR REPLACE FUNCTION public.count_custom_models(p_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.styles
  WHERE user_id = p_user_id
    AND is_preset = false
    AND father_style_id IS NULL
    AND COALESCE(is_active, true) = true
    AND status IS DISTINCT FROM 'deleted';
$$;

-- 3. The gate. Runs before every styles INSERT; only NEW top-level custom
--    models for non-admin users are subject to the quota.
CREATE OR REPLACE FUNCTION public.enforce_style_quota()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INTEGER;
  v_used  INTEGER;
BEGIN
  -- Presets and retrain children (new versions of an existing model) never
  -- consume a slot.
  IF COALESCE(NEW.is_preset, false) IS TRUE OR NEW.father_style_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Admins are unlimited (matches the app's admin branch).
  IF public.is_admin(NEW.user_id) THEN
    RETURN NEW;
  END IF;

  v_limit := public.get_effective_model_limit(NEW.user_id);

  -- -1 (or any negative) = unlimited.
  IF v_limit < 0 THEN
    RETURN NEW;
  END IF;

  v_used := public.count_custom_models(NEW.user_id);

  IF v_used >= v_limit THEN
    RAISE EXCEPTION
      'style_quota_exceeded: your plan allows % custom model(s); you already have %', v_limit, v_used
      USING ERRCODE = 'check_violation',
            HINT = 'Upgrade your plan or buy an extra-model add-on to train more styles.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_style_quota_trigger ON public.styles;
CREATE TRIGGER enforce_style_quota_trigger
  BEFORE INSERT ON public.styles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_style_quota();
