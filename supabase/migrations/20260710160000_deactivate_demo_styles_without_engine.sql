-- =====================================================================
-- Retire demo/placeholder styles that have no editing-engine model.
--
-- A preset style with style_id_external = NULL is never linked to a real
-- engine model, so it can't actually edit photos — and when a customer picks
-- one the client silently falls back to engine "1" (see the
-- `style_id_external || "1"` fallbacks), which misleads them. Deactivate these
-- so only real, engine-backed styles are selectable. is_active = false is the
-- canonical "hidden from every picker" flag (StylesPage and the gallery-create
-- flow both filter on it); admins still see the rows and can flip is_active
-- back on to restore, so this is fully reversible.
--
-- The 22 seeded public styles all carry an engine id, so they are untouched.
-- =====================================================================

UPDATE public.styles
SET is_active = false
WHERE is_preset = true
  AND (style_id_external IS NULL OR btrim(style_id_external) = '')
  AND is_active = true;
