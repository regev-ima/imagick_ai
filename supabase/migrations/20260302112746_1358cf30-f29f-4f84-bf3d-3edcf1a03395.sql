CREATE TABLE public.paypal_plan_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
  billing_cycle text NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
  paypal_plan_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, billing_cycle)
);

ALTER TABLE public.paypal_plan_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view plan mappings"
  ON public.paypal_plan_mapping FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage plan mappings"
  ON public.paypal_plan_mapping FOR ALL
  USING (public.is_admin(auth.uid()));