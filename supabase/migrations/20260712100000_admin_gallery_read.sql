-- =====================================================================
-- Admin read access to every gallery.
--
-- Why: galleries (and their satellite tables) had OWNER-ONLY RLS. The
-- admin surfaces (GalleriesManagement, the showcase tooling, "open in
-- editor" from admin) query these tables directly from the browser — so
-- an admin could only ever see their OWN rows, and opening any other
-- account's gallery (including the shared __showcase__ gallery when it
-- belongs to a different account) dead-ended in "Gallery not found".
--
-- Fix: SELECT policies for admins (public.is_admin) on the gallery
-- editor's read path. READ ONLY — admin mutations on foreign galleries
-- stay blocked; impersonation/service-role flows cover those.
-- =====================================================================

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'galleries',
    'gallery_images',
    'image_edits',
    'image_features',
    'face_detections',
    'face_clusters'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS "Admins can view all %I" ON public.%I', t, t);
      EXECUTE format(
        'CREATE POLICY "Admins can view all %I" ON public.%I FOR SELECT USING (public.is_admin(auth.uid()))',
        t, t
      );
    END IF;
  END LOOP;
END $$;
