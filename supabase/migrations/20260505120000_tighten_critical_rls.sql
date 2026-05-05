-- Tighten RLS on three tables that previously allowed unrestricted public read.
--
-- Background:
--   * face_clusters / face_detections had a "Public can view ..." policy with
--     USING (true), which let any unauthenticated visitor enumerate every
--     detected face in the system. We replace it with a check that the parent
--     gallery is shared via a client link (`client_link IS NOT NULL`), which
--     mirrors the existing public-read policy on `galleries` itself.
--   * paypal_plan_mapping had "Anyone can read PayPal plan mappings" with
--     USING (true), exposing internal plan->PayPal mapping IDs and sandbox
--     flags to anonymous visitors. Read access is restricted to authenticated
--     users (the checkout flow runs only after sign-in).

-- ── face_clusters ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public can view face_clusters" ON public.face_clusters;

CREATE POLICY "Public can view face_clusters via client link"
  ON public.face_clusters FOR SELECT
  USING (
    gallery_id IN (
      SELECT id FROM public.galleries WHERE client_link IS NOT NULL
    )
  );

-- ── face_detections ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public can view face_detections" ON public.face_detections;

CREATE POLICY "Public can view face_detections via client link"
  ON public.face_detections FOR SELECT
  USING (
    gallery_id IN (
      SELECT id FROM public.galleries WHERE client_link IS NOT NULL
    )
  );

-- ── paypal_plan_mapping ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can read PayPal plan mappings" ON public.paypal_plan_mapping;

CREATE POLICY "Authenticated users can read PayPal plan mappings"
  ON public.paypal_plan_mapping FOR SELECT
  USING (auth.role() = 'authenticated');
