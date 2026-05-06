-- Persistent rate-limit buckets (replaces in-memory Map-based limiters that
-- only protect against same-instance bursts and reset on cold start).
--
-- The single function check_rate_limit(key, max_requests, window_seconds)
-- atomically increments a counter under a fixed window and returns whether
-- the call should be allowed plus how many seconds to wait before retrying.
-- It uses INSERT ... ON CONFLICT DO UPDATE so two concurrent calls cannot
-- race to "below limit" and both pass.

CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
  key          TEXT        PRIMARY KEY,
  count        INT         NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;

-- No public access — only service_role (used by edge functions) reads/writes.
DROP POLICY IF EXISTS "rate_limit_buckets admin only" ON public.rate_limit_buckets;
CREATE POLICY "rate_limit_buckets admin only"
  ON public.rate_limit_buckets FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key            TEXT,
  p_max_requests   INT,
  p_window_seconds INT
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now             TIMESTAMPTZ := NOW();
  v_window_interval INTERVAL    := (p_window_seconds || ' seconds')::INTERVAL;
  v_count           INT;
  v_window_start    TIMESTAMPTZ;
BEGIN
  -- Atomic upsert: if we're still inside the current window, increment;
  -- otherwise reset both counter and window. This is race-safe because
  -- ON CONFLICT serialises concurrent writers on the primary key.
  INSERT INTO public.rate_limit_buckets (key, count, window_start)
  VALUES (p_key, 1, v_now)
  ON CONFLICT (key) DO UPDATE SET
    count = CASE
      WHEN public.rate_limit_buckets.window_start + v_window_interval > v_now
        THEN public.rate_limit_buckets.count + 1
      ELSE 1
    END,
    window_start = CASE
      WHEN public.rate_limit_buckets.window_start + v_window_interval > v_now
        THEN public.rate_limit_buckets.window_start
      ELSE v_now
    END
  RETURNING count, window_start INTO v_count, v_window_start;

  IF v_count > p_max_requests THEN
    RETURN json_build_object(
      'allowed', false,
      'retry_after', GREATEST(0, EXTRACT(EPOCH FROM (v_window_start + v_window_interval - v_now))::INT)
    );
  END IF;

  RETURN json_build_object('allowed', true, 'retry_after', 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INT, INT)
  TO anon, authenticated, service_role;

-- Periodic cleanup of stale buckets so the table never grows unbounded.
-- Stale = window_start older than 24 hours, regardless of window length.
CREATE OR REPLACE FUNCTION public.prune_rate_limit_buckets() RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.rate_limit_buckets
  WHERE window_start < NOW() - INTERVAL '24 hours';
$$;
