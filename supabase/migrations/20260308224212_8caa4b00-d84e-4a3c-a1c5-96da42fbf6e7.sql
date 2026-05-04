ALTER TABLE public.styles DROP CONSTRAINT styles_category_check;
ALTER TABLE public.styles ADD CONSTRAINT styles_category_check 
  CHECK (category IS NULL OR category = ANY (ARRAY[
    'portrait','landscape','wedding','product','street','artistic',
    'vintage','moody','bright','custom',
    'newborn','family','event','commercial','real_estate','fashion',
    'food','sports'
  ]));