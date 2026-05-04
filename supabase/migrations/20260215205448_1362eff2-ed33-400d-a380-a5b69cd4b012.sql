
-- Add is_active column to styles, default true
ALTER TABLE public.styles ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
