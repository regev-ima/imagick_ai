-- Promote contact@imagick.ai to admin (idempotent).
--
-- A prior migration (20260510170000_restore_contact_admin_role.sql) already
-- granted the role, but migrations only run once. If the user_roles row was
-- removed after that ran, we need a fresh migration to re-grant it.

INSERT INTO public.user_roles (user_id, role, can_view_analytics)
SELECT id, 'admin'::public.app_role, true
FROM auth.users
WHERE lower(email) = 'contact@imagick.ai'
ON CONFLICT (user_id, role) DO UPDATE
  SET can_view_analytics = true;
