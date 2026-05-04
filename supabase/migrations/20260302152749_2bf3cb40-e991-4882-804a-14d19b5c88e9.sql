-- Create invoices table
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  invoice_number text NOT NULL,
  type text NOT NULL DEFAULT 'subscription',
  description text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'paid',
  paypal_transaction_id text,
  plan_id uuid,
  billing_cycle text,
  pdf_storage_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create paypal_webhook_events table for idempotency
CREATE TABLE public.paypal_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  resource_type text,
  resource_id text,
  payload jsonb DEFAULT '{}'::jsonb,
  processed boolean NOT NULL DEFAULT false,
  processed_at timestamptz,
  processing_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paypal_webhook_events ENABLE ROW LEVEL SECURITY;

-- RLS: Users can view own invoices
CREATE POLICY "Users can view own invoices"
  ON public.invoices FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS: Admins can manage all invoices
CREATE POLICY "Admins can manage all invoices"
  ON public.invoices FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- RLS: No public access to webhook events
CREATE POLICY "No public access to webhook events"
  ON public.paypal_webhook_events FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Create indexes
CREATE INDEX idx_invoices_user_id ON public.invoices(user_id);
CREATE INDEX idx_invoices_created_at ON public.invoices(created_at DESC);
CREATE INDEX idx_webhook_events_event_id ON public.paypal_webhook_events(event_id);