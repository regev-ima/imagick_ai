ALTER TABLE public.styles DROP CONSTRAINT styles_category_check;
DO $$ BEGIN
  ALTER TABLE public.styles ADD CONSTRAINT styles_category_check 
  CHECK (category IS NULL OR category = ANY (ARRAY[
    'portrait','landscape','wedding','product','street','artistic',
    'vintage','moody','bright','custom',
    'newborn','family','event','commercial','real_estate','fashion',
    'food','sports'
  ]));
EXCEPTION WHEN duplicate_object OR duplicate_table OR unique_violation THEN NULL; END $$;