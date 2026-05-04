
-- Add unique index to prevent duplicate credit log entries for the same image+style
CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_usage_logs_unique_description 
ON credit_usage_logs (user_id, description) 
WHERE action_type = 'ai_edit';
