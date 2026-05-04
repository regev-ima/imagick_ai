-- 1) Expand CHECK constraint on lead_scheduled_emails.status to include 'held'
ALTER TABLE public.lead_scheduled_emails
  DROP CONSTRAINT IF EXISTS lead_scheduled_emails_status_check;
DO $$ BEGIN
  ALTER TABLE public.lead_scheduled_emails
  ADD CONSTRAINT lead_scheduled_emails_status_check
  CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled', 'skipped', 'held'));
EXCEPTION WHEN duplicate_object OR duplicate_table OR unique_violation THEN NULL; END $$;

-- 2) Update cancel_lead_on_signup() to also cancel 'held' emails when a lead converts
DROP FUNCTION IF EXISTS public.cancel_lead_on_signup();
CREATE OR REPLACE FUNCTION public.cancel_lead_on_signup()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_lead_id uuid;
  v_now timestamptz := now();
BEGIN
  v_email := lower(trim(NEW.email));

  SELECT id INTO v_lead_id
  FROM public.lead_contacts
  WHERE email_normalized = v_email
    AND status = 'active'
  LIMIT 1;

  IF v_lead_id IS NOT NULL THEN
    UPDATE public.lead_contacts
    SET status = 'converted',
        suppression_reason = 'signed_up',
        converted_at = v_now,
        updated_at = v_now
    WHERE id = v_lead_id;

    UPDATE public.lead_enrollments
    SET status = 'cancelled',
        cancelled_at = v_now,
        updated_at = v_now
    WHERE lead_id = v_lead_id AND status = 'active';

    UPDATE public.lead_scheduled_emails
    SET status = 'cancelled',
        last_error = 'Lead converted (signed up)',
        updated_at = v_now
    WHERE lead_id = v_lead_id AND status IN ('pending', 'processing', 'held');
  END IF;

  RETURN NEW;
END;
$$;

-- 3) Partial index for held emails (useful for release queries)
CREATE INDEX IF NOT EXISTS idx_lead_scheduled_held
  ON public.lead_scheduled_emails (lead_id, enrollment_id)
  WHERE status = 'held';
