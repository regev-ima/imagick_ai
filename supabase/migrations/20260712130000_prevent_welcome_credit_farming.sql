-- =====================================================================
-- Stop the delete-account → re-signup welcome-credit farm.
--
-- Every new auth user gets a free subscription seeded with the plan's
-- welcome credits (edits_remaining) by create_default_subscription().
-- delete-account hard-deletes the user and all their rows, so signing up
-- again mints a brand-new user and a fresh welcome grant — repeat forever.
--
-- Fix: record which (normalized) email has already claimed the one-time
-- welcome credits in a table that is NOT keyed on user_id and is NOT touched
-- by delete-account, so the claim survives deletion. A repeat signup with the
-- same email gets the free plan with 0 welcome credits; admins can still grant
-- credits manually for legitimate cases.
-- =====================================================================

-- Strict normalization for anti-abuse keying. The existing normalize_email()
-- (lower/trim only) is relied on by the lead system and must stay as-is, so
-- this is a separate, stronger key that also collapses "+alias" tags and Gmail
-- dot-insensitivity — the two trivial ways to mint "new" emails.
CREATE OR REPLACE FUNCTION public.welcome_email_key(raw text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v text;
  local_part text;
  domain_part text;
BEGIN
  IF raw IS NULL OR position('@' in raw) = 0 THEN
    RETURN NULL;
  END IF;
  v := lower(trim(raw));
  local_part := split_part(v, '@', 1);
  domain_part := split_part(v, '@', 2);
  local_part := split_part(local_part, '+', 1);            -- drop "+alias"
  IF domain_part IN ('gmail.com', 'googlemail.com') THEN
    local_part := replace(local_part, '.', '');            -- gmail ignores dots
    domain_part := 'gmail.com';
  END IF;
  IF local_part = '' OR domain_part = '' THEN
    RETURN NULL;
  END IF;
  RETURN local_part || '@' || domain_part;
END;
$$;

-- Persistent claim ledger. Keyed on the normalized email, no FK to auth.users,
-- deliberately excluded from delete-account, so it outlives the account.
CREATE TABLE IF NOT EXISTS public.welcome_grant_claims (
  email_key        text PRIMARY KEY,
  first_granted_at timestamptz NOT NULL DEFAULT now(),
  last_signup_at   timestamptz NOT NULL DEFAULT now(),
  signup_count     integer NOT NULL DEFAULT 1
);
ALTER TABLE public.welcome_grant_claims ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: only SECURITY DEFINER functions / the service role
-- may read or write it. Users must never see or tamper with it.

-- Backfill every existing account so they can't farm either.
INSERT INTO public.welcome_grant_claims (email_key)
SELECT DISTINCT public.welcome_email_key(u.email)
FROM auth.users u
WHERE u.email IS NOT NULL
  AND public.welcome_email_key(u.email) IS NOT NULL
ON CONFLICT (email_key) DO NOTHING;

-- Gate the welcome credits inside the signup trigger. First-ever email for a
-- normalized key gets the plan's welcome credits; any later signup with the
-- same key gets the free plan seeded with 0 credits.
CREATE OR REPLACE FUNCTION public.create_default_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_id  uuid;
  v_included integer;
  v_key      text;
  v_is_first boolean;
  v_welcome  integer;
BEGIN
  SELECT id, edits_included INTO v_plan_id, v_included
  FROM public.subscription_plans
  WHERE slug = 'free'
  LIMIT 1;

  v_key := public.welcome_email_key(NEW.email);

  IF v_key IS NULL THEN
    -- No usable email (shouldn't happen) — fall back to the normal welcome.
    v_welcome := v_included;
  ELSE
    -- Atomic claim: xmax = 0 on the RETURNING row means this was a fresh
    -- INSERT (first time), not an ON CONFLICT update (repeat signup).
    INSERT INTO public.welcome_grant_claims (email_key)
    VALUES (v_key)
    ON CONFLICT (email_key) DO UPDATE
      SET signup_count   = welcome_grant_claims.signup_count + 1,
          last_signup_at = now()
    RETURNING (xmax = 0) INTO v_is_first;

    v_welcome := CASE WHEN v_is_first THEN v_included ELSE 0 END;
  END IF;

  INSERT INTO public.user_subscriptions (user_id, plan_id, status, edits_remaining)
  VALUES (NEW.id, v_plan_id, 'active', v_welcome);

  RETURN NEW;
END;
$$;
