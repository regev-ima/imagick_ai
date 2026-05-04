ALTER TABLE public.styles DROP CONSTRAINT styles_status_check;
ALTER TABLE public.styles ADD CONSTRAINT styles_status_check 
  CHECK (status = ANY (ARRAY['uploading','importing','training','ready','error','deleted']));