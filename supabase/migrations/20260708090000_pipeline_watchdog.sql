-- =====================================================================
-- Pipeline watchdog — liveness tracking for AI-culling runs + a pg_cron
-- job that rescues dead runs, releases their credit reservations, and
-- alerts admins.
--
-- Why: a culling run is a chain of process-pipeline invocations. When a
-- link died (killed invocation, hung provider, lost dispatch) the gallery
-- stayed at culling_status='processing' forever — eternal spinner for the
-- user, stranded credit reservation, and nobody alerted.
--
-- New columns on galleries:
--   pipeline_heartbeat — stamped by every chain link at start; a stale
--     heartbeat while 'processing' = dead run.
--   pipeline_options   — the run's configuration, persisted so the
--     watchdog can resume with the exact same settings.
--   pipeline_watchdog  — watchdog bookkeeping {kicks, last_kick}: two
--     auto-resumes, then the run is declared dead (error + settle + alert).
-- =====================================================================

ALTER TABLE public.galleries
  ADD COLUMN IF NOT EXISTS pipeline_heartbeat timestamptz,
  ADD COLUMN IF NOT EXISTS pipeline_options jsonb,
  ADD COLUMN IF NOT EXISTS pipeline_watchdog jsonb;

-- The watchdog polls for in-flight runs every 5 minutes — keep that scan
-- off the main table path. Tiny partial index: only 'processing' rows.
CREATE INDEX IF NOT EXISTS idx_galleries_culling_processing
  ON public.galleries (pipeline_heartbeat)
  WHERE culling_status = 'processing';

-- ── Schedule the watchdog every 5 minutes ────────────────────────────────
-- Same pattern as re-engagement-cron (20260506100000).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'pipeline-watchdog-5min'
  ) THEN
    PERFORM cron.schedule(
      'pipeline-watchdog-5min',
      '*/5 * * * *',
      $job$
        SELECT net.http_post(
          url := 'https://zfcltfqgrhytpvgqkkfo.supabase.co/functions/v1/pipeline-watchdog',
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
    RAISE NOTICE 'Could not auto-schedule pipeline-watchdog: %', SQLERRM;
END $$;
