-- =====================================================================
-- Re-engagement cron schedule + admin KPI helper view.
--
-- 1. pg_cron job that calls re-engagement-cron edge function daily at
--    10:00 UTC. Uses the same pattern as process-lead-email-queue
--    (20260310174000_lead_reactivation_system.sql).
-- 2. admin_kpi_overview view: a single row with MRR, active subs,
--    churn-30d, edits-7d, edits-30d. Read-only, admin-only via RLS on
--    underlying tables. Computed at query time so we never lag behind.
-- =====================================================================

-- ── 0. Self-heal a production schema drift ──────────────────────────────
-- The admin_kpi_overview view below reads gallery_images.processing_completed_at.
-- Migration 20260225203919 added that column, but production drifted (the
-- column went missing while the migration stayed recorded as applied), which
-- made THIS migration fail — and that failure silently blocked the whole
-- `supabase db push` chain (and therefore every backend deploy) for weeks.
-- Re-assert the column defensively so the chain can always apply.
ALTER TABLE public.gallery_images
  ADD COLUMN IF NOT EXISTS processing_completed_at timestamptz;

-- ── 1. Schedule re-engagement-cron daily ────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 're-engagement-cron-daily'
  ) THEN
    PERFORM cron.schedule(
      're-engagement-cron-daily',
      '0 10 * * *',
      $job$
        SELECT net.http_post(
          url := 'https://zfcltfqgrhytpvgqkkfo.supabase.co/functions/v1/re-engagement-cron',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
          ),
          body := '{"trigger":"cron"}'::jsonb
        ) AS request_id;
      $job$
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not auto-schedule re-engagement-cron: %', SQLERRM;
END $$;

-- ── 2. Admin KPI overview view ──────────────────────────────────────────
-- Normalises annual subs to monthly so MRR is always a monthly figure.
-- Churn-30d = (cancellations in last 30 days) / (active subs 30 days ago).
-- Edits per day proxies on gallery_images.processing_completed_at since
-- that's where the edit credit is actually consumed.

CREATE OR REPLACE VIEW public.admin_kpi_overview AS
WITH active_subs AS (
  SELECT
    us.user_id,
    us.billing_cycle,
    us.created_at,
    sp.price_monthly,
    sp.price_yearly
  FROM public.user_subscriptions us
  JOIN public.subscription_plans sp ON sp.id = us.plan_id
  WHERE us.status = 'active'
    AND us.paypal_subscription_id IS NOT NULL
    AND sp.slug <> 'free'
),
mrr AS (
  SELECT COALESCE(SUM(
    CASE
      WHEN billing_cycle = 'yearly' THEN price_yearly / 12.0
      ELSE price_monthly
    END
  ), 0)::numeric(10,2) AS mrr_usd
  FROM active_subs
),
churn AS (
  SELECT
    COUNT(*) FILTER (
      WHERE event_type = 'BILLING.SUBSCRIPTION.CANCELLED'
        AND created_at >= NOW() - INTERVAL '30 days'
    )::int AS cancellations_30d
  FROM public.paypal_webhook_events
),
edits AS (
  SELECT
    COUNT(*) FILTER (
      WHERE processing_completed_at >= NOW() - INTERVAL '7 days'
    )::int AS edits_7d,
    COUNT(*) FILTER (
      WHERE processing_completed_at >= NOW() - INTERVAL '30 days'
    )::int AS edits_30d,
    COUNT(*) FILTER (
      WHERE processing_completed_at >= CURRENT_DATE
    )::int AS edits_today
  FROM public.gallery_images
  WHERE processing_completed_at IS NOT NULL
),
signups AS (
  SELECT
    (SELECT COUNT(*) FROM auth.users WHERE created_at >= NOW() - INTERVAL '30 days')::int AS signups_30d,
    (SELECT COUNT(*) FROM auth.users WHERE created_at >= NOW() - INTERVAL '7 days')::int  AS signups_7d
)
SELECT
  (SELECT COUNT(*) FROM active_subs)::int AS active_subscribers,
  mrr.mrr_usd,
  churn.cancellations_30d,
  CASE
    WHEN (SELECT COUNT(*) FROM active_subs) = 0 THEN 0
    ELSE ROUND(
      (churn.cancellations_30d::numeric
        / GREATEST((SELECT COUNT(*) FROM active_subs) + churn.cancellations_30d, 1)) * 100,
      2
    )
  END AS churn_pct_30d,
  edits.edits_today,
  edits.edits_7d,
  edits.edits_30d,
  signups.signups_7d,
  signups.signups_30d,
  NOW() AS computed_at
FROM mrr, churn, edits, signups;

COMMENT ON VIEW public.admin_kpi_overview IS
  'High-level KPIs for /dashboard/admin. MRR is normalised to monthly. Computed at query time.';

-- Direct view access stays restricted; clients must go through the
-- SECURITY DEFINER RPC below which runs the admin guard.
REVOKE ALL ON public.admin_kpi_overview FROM PUBLIC;

-- Views can't have RLS directly, so expose via a SECURITY DEFINER RPC
-- that checks is_admin before returning the row.
CREATE OR REPLACE FUNCTION public.get_admin_kpi_overview()
RETURNS public.admin_kpi_overview
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.admin_kpi_overview;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO result FROM public.admin_kpi_overview;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_kpi_overview() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_kpi_overview() TO authenticated;
