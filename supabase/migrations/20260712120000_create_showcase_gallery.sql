-- =====================================================================
-- Create the shared Showcase gallery row.
--
-- SHOWCASE_GALLERY_ID (0bdc4555-c5f1-4c93-bf4c-a66d8efd2eef) is referenced
-- throughout the app (src/lib/constants.ts) as the single, reusable demo
-- gallery: admins upload sample photos here once, then every style is run
-- over them to produce before/after previews. But the row was never
-- created, so "Open Collection" in the Showcase Manager 404s ("Gallery not
-- found") and there is nowhere to upload the demo photos.
--
-- Create it, owned by the system user and flagged is_system (hidden from
-- users' collection lists; admins can still open it by URL via the "Admins
-- can view/manage all galleries" policies). Idempotent.
-- =====================================================================

INSERT INTO public.galleries (id, user_id, name, description, status, is_system)
VALUES (
  '0bdc4555-c5f1-4c93-bf4c-a66d8efd2eef'::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'Showcase',
  'Shared demo photos used to generate before/after previews for every style.',
  'ready',
  true
)
ON CONFLICT (id) DO NOTHING;
