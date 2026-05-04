
-- Explicitly deny INSERT/UPDATE/DELETE on credit_usage_logs for regular users
-- Only service role (used by triggers) should write to this table

DROP POLICY IF EXISTS "Deny direct inserts to credit logs" ON public.credit_usage_logs;
CREATE POLICY "Deny direct inserts to credit logs"
ON public.credit_usage_logs
FOR INSERT
TO authenticated
WITH CHECK (false);

DROP POLICY IF EXISTS "Deny updates to credit logs" ON public.credit_usage_logs;
CREATE POLICY "Deny updates to credit logs"
ON public.credit_usage_logs
FOR UPDATE
TO authenticated
USING (false);

DROP POLICY IF EXISTS "Deny deletes from credit logs" ON public.credit_usage_logs;
CREATE POLICY "Deny deletes from credit logs"
ON public.credit_usage_logs
FOR DELETE
TO authenticated
USING (false);
