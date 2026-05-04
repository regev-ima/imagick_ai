
-- Add unique index to prevent duplicate edit log entries for the same image+style
-- Note: credit_usage_logs was renamed to edit_usage_logs in 20260301000000
CREATE UNIQUE INDEX IF NOT EXISTS idx_edit_usage_logs_unique_description
ON edit_usage_logs (user_id, description)
WHERE action_type = 'ai_edit';
