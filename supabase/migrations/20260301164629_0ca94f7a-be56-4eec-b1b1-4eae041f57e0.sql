
-- 1. Create credit_grants table
CREATE TABLE IF NOT EXISTS public.credit_grants (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  grant_type       TEXT NOT NULL DEFAULT 'gift'
                     CHECK (grant_type IN ('gift', 'purchased', 'promo')),
  credits_initial  INTEGER NOT NULL CHECK (credits_initial > 0),
  credits_remaining INTEGER NOT NULL CHECK (credits_remaining >= 0),
  granted_by       UUID REFERENCES auth.users(id),
  reason           TEXT,
  status           TEXT NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active', 'expired', 'depleted')),
  expires_at       TIMESTAMPTZ NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  expired_at       TIMESTAMPTZ
);

ALTER TABLE public.credit_grants ENABLE ROW LEVEL SECURITY;

-- 2. RLS policies
DROP POLICY IF EXISTS "Users can view own credit grants" ON public.credit_grants;
CREATE POLICY "Users can view own credit grants"
  ON public.credit_grants FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins full access on credit grants" ON public.credit_grants;
CREATE POLICY "Admins full access on credit grants"
  ON public.credit_grants FOR ALL
  USING (public.is_admin(auth.uid()));

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_credit_grants_user_id
  ON public.credit_grants(user_id);

CREATE INDEX IF NOT EXISTS idx_credit_grants_active_expires
  ON public.credit_grants(expires_at)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_credit_grants_user_active
  ON public.credit_grants(user_id, expires_at)
  WHERE status = 'active';

-- 4. admin_grant_credits RPC (corrected column names)
DROP FUNCTION IF EXISTS public.admin_grant_credits(UUID, INTEGER, TIMESTAMPTZ, TEXT);
CREATE OR REPLACE FUNCTION public.admin_grant_credits(
  p_user_id    UUID,
  p_amount     INTEGER,
  p_expires_at TIMESTAMPTZ,
  p_reason     TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grant_id UUID;
  v_caller   UUID;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL OR NOT public.is_admin(v_caller) THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;
  IF p_expires_at <= now() THEN
    RAISE EXCEPTION 'Expiration must be in the future';
  END IF;

  INSERT INTO public.credit_grants
    (user_id, grant_type, credits_initial, credits_remaining,
     granted_by, reason, expires_at)
  VALUES
    (p_user_id, 'gift', p_amount, p_amount,
     v_caller, p_reason, p_expires_at)
  RETURNING id INTO v_grant_id;

  UPDATE public.user_subscriptions
  SET credits_remaining = CASE
        WHEN credits_remaining = -1 THEN -1
        ELSE credits_remaining + p_amount
      END,
      updated_at = now()
  WHERE user_id = p_user_id;

  RETURN v_grant_id;
END;
$$;

-- 5. Updated update_credits_on_usage trigger function (corrected columns, grant depletion)
DROP FUNCTION IF EXISTS public.update_credits_on_usage();
CREATE OR REPLACE FUNCTION public.update_credits_on_usage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_to_deduct INTEGER := NEW.credits_spent;
  v_grant     RECORD;
  v_take      INTEGER;
BEGIN
  -- Update main subscription counter
  UPDATE public.user_subscriptions
  SET credits_used = credits_used + NEW.credits_spent,
      credits_remaining = CASE
        WHEN credits_remaining = -1 THEN -1
        ELSE GREATEST(0, credits_remaining - NEW.credits_spent)
      END,
      updated_at = now()
  WHERE user_id = NEW.user_id;

  -- Deplete grant credits (soonest-expiring first)
  IF v_to_deduct > 0 THEN
    FOR v_grant IN
      SELECT id, credits_remaining
      FROM public.credit_grants
      WHERE user_id = NEW.user_id
        AND status = 'active'
        AND credits_remaining > 0
      ORDER BY expires_at ASC
      FOR UPDATE
    LOOP
      EXIT WHEN v_to_deduct <= 0;

      v_take := LEAST(v_to_deduct, v_grant.credits_remaining);

      UPDATE public.credit_grants
      SET credits_remaining = credits_remaining - v_take,
          status = CASE
            WHEN credits_remaining - v_take <= 0 THEN 'depleted'
            ELSE 'active'
          END
      WHERE id = v_grant.id;

      v_to_deduct := v_to_deduct - v_take;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- 6. expire_credit_grants RPC (corrected column names)
DROP FUNCTION IF EXISTS public.expire_credit_grants();
CREATE OR REPLACE FUNCTION public.expire_credit_grants()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grant RECORD;
  v_count INTEGER := 0;
BEGIN
  FOR v_grant IN
    SELECT id, user_id, credits_remaining
    FROM public.credit_grants
    WHERE status = 'active'
      AND expires_at <= now()
    FOR UPDATE
  LOOP
    IF v_grant.credits_remaining > 0 THEN
      UPDATE public.user_subscriptions
      SET credits_remaining = CASE
            WHEN credits_remaining = -1 THEN -1
            ELSE GREATEST(0, credits_remaining - v_grant.credits_remaining)
          END,
          updated_at = now()
      WHERE user_id = v_grant.user_id;
    END IF;

    UPDATE public.credit_grants
    SET status = 'expired',
        expired_at = now(),
        credits_remaining = 0
    WHERE id = v_grant.id;

    v_count := v_count + 1;
  END LOOP;

  -- Also mark zero-remaining active grants as depleted
  UPDATE public.credit_grants
  SET status = 'depleted'
  WHERE status = 'active'
    AND credits_remaining = 0;

  RETURN v_count;
END;
$$;
