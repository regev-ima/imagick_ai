-- Add culling_labels column to galleries table for storing user-provided labels
ALTER TABLE public.galleries 
ADD COLUMN IF NOT EXISTS culling_labels text[] DEFAULT '{}'::text[];