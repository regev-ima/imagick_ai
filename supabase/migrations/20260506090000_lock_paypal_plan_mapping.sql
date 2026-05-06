-- =====================================================================
-- Lock down paypal_plan_mapping to admins only.
--
-- The previous policy (20260505120000_tighten_critical_rls.sql) limited
-- SELECT to authenticated users, which still meant any logged-in user
-- could enumerate the internal PayPal plan IDs and the sandbox/live flag.
-- Edge functions bypass RLS via the service role, so the only legitimate
-- frontend reader is the admin PayPal settings page.
-- =====================================================================

DROP POLICY IF EXISTS "Anyone can read PayPal plan mappings" ON public.paypal_plan_mapping;
DROP POLICY IF EXISTS "Authenticated users can read PayPal plan mappings" ON public.paypal_plan_mapping;
DROP POLICY IF EXISTS "Admins can read PayPal plan mappings" ON public.paypal_plan_mapping;

CREATE POLICY "Admins can read PayPal plan mappings"
  ON public.paypal_plan_mapping FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Mutation policies (already admin-only per 20260302112746) re-asserted
-- here defensively in case earlier migrations were dropped/renamed.
DROP POLICY IF EXISTS "Admins can manage plan mappings" ON public.paypal_plan_mapping;
CREATE POLICY "Admins can manage plan mappings"
  ON public.paypal_plan_mapping FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
