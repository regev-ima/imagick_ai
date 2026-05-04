
CREATE TABLE IF NOT EXISTS public.user_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  addon_type text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'active',
  paypal_order_id text,
  paypal_subscription_id text,
  invoice_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz
);

ALTER TABLE public.user_addons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own addons" ON public.user_addons
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all addons" ON public.user_addons
  FOR ALL USING (is_admin(auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.user_addons;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_subscriptions;
