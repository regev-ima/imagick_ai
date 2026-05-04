ALTER TABLE public.styles DROP CONSTRAINT styles_status_check;
DO $$ BEGIN
  ALTER TABLE public.styles ADD CONSTRAINT styles_status_check 
  CHECK (status = ANY (ARRAY['uploading','importing','training','ready','error','deleted']));
EXCEPTION WHEN duplicate_object OR duplicate_table OR unique_violation THEN NULL; END $$;