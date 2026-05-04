-- =====================================================================
-- Edit Reservations: prevent race condition where free users over-commit
-- edits by submitting multiple galleries while processing is in-flight.
-- =====================================================================

-- 1. Add reservation columns
ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS edits_reserved INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.galleries
  ADD COLUMN IF NOT EXISTS edits_reserved INTEGER NOT NULL DEFAULT 0;

-- 2. Update the edit-usage trigger to also release reservations
CREATE OR REPLACE FUNCTION public.update_edits_on_usage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_subscriptions
  SET edits_used = edits_used + NEW.edits_spent,
      edits_remaining = CASE
        WHEN edits_remaining = -1 THEN -1
        ELSE GREATEST(0, edits_remaining - NEW.edits_spent)
      END,
      edits_reserved = GREATEST(0, edits_reserved - NEW.edits_spent),
      updated_at = now()
  WHERE user_id = NEW.user_id;
  RETURN NEW;
END;
$$;

-- 3. Atomic reserve RPC — reserves edits if sufficient available, returns true/false
CREATE OR REPLACE FUNCTION public.reserve_edits_atomic(p_user_id UUID, p_gallery_id UUID, p_needed INTEGER)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows INTEGER;
BEGIN
  UPDATE public.user_subscriptions
  SET edits_reserved = edits_reserved + p_needed,
      updated_at = now()
  WHERE user_id = p_user_id
    AND (edits_remaining = -1 OR edits_remaining - edits_reserved >= p_needed);

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN
    RETURN false;
  END IF;

  UPDATE public.galleries
  SET edits_reserved = edits_reserved + p_needed
  WHERE id = p_gallery_id;

  RETURN true;
END;
$$;

-- 4. RPC to release leftover gallery reservation (errors/skipped images)
CREATE OR REPLACE FUNCTION public.release_gallery_reservation(p_gallery_id UUID, p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reserved INTEGER;
BEGIN
  SELECT edits_reserved INTO v_reserved
  FROM public.galleries
  WHERE id = p_gallery_id;

  IF v_reserved IS NOT NULL AND v_reserved > 0 THEN
    UPDATE public.user_subscriptions
    SET edits_reserved = GREATEST(0, edits_reserved - v_reserved),
        updated_at = now()
    WHERE user_id = p_user_id;

    UPDATE public.galleries
    SET edits_reserved = 0
    WHERE id = p_gallery_id;
  END IF;
END;
$$;
