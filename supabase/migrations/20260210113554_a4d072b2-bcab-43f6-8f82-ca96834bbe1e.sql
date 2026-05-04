ALTER TABLE public.styles
ADD COLUMN IF NOT EXISTS import_transfers_total integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS import_transfers_completed integer DEFAULT 0;