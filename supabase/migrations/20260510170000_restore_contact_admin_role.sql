-- Restore admin role for the founding account.
--
-- contact@imagick.ai had admin privileges + analytics access since the
-- platform launched, and the user reported that the admin section
-- silently disappeared from their UI ("לאן הם נעלמו"). The most
-- likely cause is that the (user_id, role='admin') row in
-- public.user_roles was deleted at some point — there is no migration
-- in this repo that ever explicitly grants the role, so the original
-- grant must have been done via the Supabase dashboard, and once
-- removed there's nothing in version control to put it back.
--
-- Re-grant it here so a fresh deploy doesn't depend on remembering to
-- set it manually. The migration is idempotent:
--   - INSERT ... ON CONFLICT DO NOTHING re-creates the admin row
--     without erroring if it already exists (UNIQUE is on
--     (user_id, role), so admin and user can coexist).
--   - The UPDATE keeps can_view_analytics in sync.
--
-- If the email isn't present in auth.users (e.g. fresh dev DB), the
-- INSERT … SELECT simply yields zero rows and the migration is a no-op.

INSERT INTO public.user_roles (user_id, role, can_view_analytics)
SELECT id, 'admin'::public.app_role, true
FROM auth.users
WHERE lower(email) = 'contact@imagick.ai'
ON CONFLICT (user_id, role) DO UPDATE
  SET can_view_analytics = true;
