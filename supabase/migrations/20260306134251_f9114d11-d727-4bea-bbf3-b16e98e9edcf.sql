
ALTER TABLE public.paypal_plan_mapping 
  ADD COLUMN IF NOT EXISTS is_sandbox BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.paypal_plan_mapping 
  DROP CONSTRAINT IF EXISTS paypal_plan_mapping_plan_id_billing_cycle_key;

DO $$ BEGIN
  ALTER TABLE public.paypal_plan_mapping 
  ADD CONSTRAINT paypal_plan_mapping_plan_id_billing_cycle_is_sandbox_key 
  UNIQUE (plan_id, billing_cycle, is_sandbox);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
