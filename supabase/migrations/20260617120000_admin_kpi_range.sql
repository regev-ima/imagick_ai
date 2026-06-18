-- Parameterized admin KPI lookup for an arbitrary date range.
--
-- Mirrors the time-bound metrics of public.admin_kpi_overview
-- (signups / edits / cancellations + derived churn %) but scoped to
-- [p_from, p_to). Snapshot metrics (MRR, active subscribers, totals) are
-- point-in-time and intentionally NOT part of this function — the dashboard
-- keeps reading those from get_admin_kpi_overview().
--
-- Same access model as get_admin_kpi_overview: SECURITY DEFINER + is_admin guard.

CREATE OR REPLACE FUNCTION public.get_admin_kpi_range(
  p_from timestamptz,
  p_to   timestamptz
)
RETURNS TABLE (
  signups       int,
  edits         int,
  cancellations int,
  churn_pct     numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active_subs   int;
  v_cancellations int;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = '42501';
  END IF;

  IF p_from IS NULL OR p_to IS NULL OR p_to <= p_from THEN
    RAISE EXCEPTION 'invalid date range' USING ERRCODE = '22023';
  END IF;

  -- Active paying subscribers right now (denominator for churn %, matching
  -- the active_subs CTE in admin_kpi_overview).
  SELECT COUNT(*)::int INTO v_active_subs
  FROM public.user_subscriptions us
  JOIN public.subscription_plans sp ON sp.id = us.plan_id
  WHERE us.status = 'active'
    AND us.paypal_subscription_id IS NOT NULL
    AND sp.slug <> 'free';

  SELECT COUNT(*)::int INTO v_cancellations
  FROM public.paypal_webhook_events
  WHERE event_type = 'BILLING.SUBSCRIPTION.CANCELLED'
    AND created_at >= p_from
    AND created_at <  p_to;

  RETURN QUERY
  SELECT
    (SELECT COUNT(*)::int FROM auth.users
       WHERE created_at >= p_from AND created_at < p_to),
    (SELECT COUNT(*)::int FROM public.gallery_images
       WHERE processing_completed_at IS NOT NULL
         AND processing_completed_at >= p_from
         AND processing_completed_at <  p_to),
    v_cancellations,
    CASE
      WHEN v_active_subs = 0 THEN 0
      ELSE ROUND(
        (v_cancellations::numeric
          / GREATEST(v_active_subs + v_cancellations, 1)) * 100,
        2
      )
    END;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_kpi_range(timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_kpi_range(timestamptz, timestamptz) TO authenticated;

COMMENT ON FUNCTION public.get_admin_kpi_range(timestamptz, timestamptz) IS
  'Admin-only. Time-bound KPIs (signups / edits / cancellations + churn %) for the [p_from, p_to) window. Snapshot metrics live in get_admin_kpi_overview.';
