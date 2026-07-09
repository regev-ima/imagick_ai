-- =====================================================================
-- Admin style control upgrade — foundation columns.
--
-- is_system: marks a gallery as an internal/system gallery (not created
--   or seen by the user) so list queries can exclude it. Used first by
--   the per-style "source" gallery (__style_source__) that materializes a
--   style's BEFORE set for auto-editing + three-way compare.
-- source_gallery_id: the style's own source gallery (nullable — legacy
--   styles won't have one until backfilled).
-- idx_styles_father: father_style_id already exists (FK to styles.id);
--   this adds the lookup index for "children of this style" queries.
-- =====================================================================

ALTER TABLE public.galleries
  ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;

ALTER TABLE public.styles
  ADD COLUMN IF NOT EXISTS source_gallery_id uuid REFERENCES public.galleries(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_styles_father
  ON public.styles(father_style_id)
  WHERE father_style_id IS NOT NULL;
