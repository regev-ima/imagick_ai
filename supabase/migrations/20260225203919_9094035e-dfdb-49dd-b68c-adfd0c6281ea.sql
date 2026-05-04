
ALTER TABLE public.galleries
  ADD COLUMN IF NOT EXISTS culling_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS culling_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS upload_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS upload_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS processing_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS processing_completed_at timestamptz;
