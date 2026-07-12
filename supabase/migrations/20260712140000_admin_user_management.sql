-- =====================================================================
-- Admin user management: support suspending an account.
--
-- "Cancel account" suspends the user (blocks access, keeps the minimal
-- anti-abuse record) rather than deleting immediately; a scheduled job
-- purges accounts left suspended for 60+ days (GDPR data-minimisation).
-- useSubscription already derives isSuspended / canEdit from status =
-- 'suspended', but the status CHECK never allowed that value — add it, plus
-- a timestamp so the purge job knows how long an account has been suspended.
-- =====================================================================

ALTER TABLE public.user_subscriptions
  DROP CONSTRAINT IF EXISTS user_subscriptions_status_check;

ALTER TABLE public.user_subscriptions
  ADD CONSTRAINT user_subscriptions_status_check
  CHECK (status IN ('active', 'cancelled', 'expired', 'suspended'));

ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_suspended_at
  ON public.user_subscriptions(suspended_at)
  WHERE suspended_at IS NOT NULL;
