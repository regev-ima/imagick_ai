-- Add culling_ready email preference column
ALTER TABLE public.user_email_preferences
  ADD COLUMN IF NOT EXISTS culling_ready BOOLEAN NOT NULL DEFAULT TRUE;

-- Backfill any existing rows
UPDATE public.user_email_preferences SET culling_ready = TRUE WHERE culling_ready IS NULL;
