ALTER TABLE public.styles
ADD COLUMN import_transfers_total integer DEFAULT 0,
ADD COLUMN import_transfers_completed integer DEFAULT 0;