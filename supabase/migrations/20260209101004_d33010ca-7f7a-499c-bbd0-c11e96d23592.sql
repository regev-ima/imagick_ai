-- Add 'transferring' status to galleries status check constraint
ALTER TABLE public.galleries DROP CONSTRAINT galleries_status_check;

ALTER TABLE public.galleries ADD CONSTRAINT galleries_status_check 
  CHECK (status = ANY (ARRAY['uploading'::text, 'transferring'::text, 'processing'::text, 'culling'::text, 'ready'::text, 'error'::text]));