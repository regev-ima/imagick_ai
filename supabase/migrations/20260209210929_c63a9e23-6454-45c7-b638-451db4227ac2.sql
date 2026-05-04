
CREATE TABLE public.credit_usage_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  gallery_id UUID REFERENCES public.galleries(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  credits_spent INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own credit logs"
ON public.credit_usage_logs
FOR SELECT
USING (auth.uid() = user_id);

CREATE INDEX idx_credit_usage_logs_user_id ON public.credit_usage_logs(user_id);
CREATE INDEX idx_credit_usage_logs_created_at ON public.credit_usage_logs(created_at);
