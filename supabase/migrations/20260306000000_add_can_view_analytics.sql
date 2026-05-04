-- Add can_view_analytics permission to user_roles
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS can_view_analytics boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.user_roles.can_view_analytics
  IS 'When true, user can see gallery timing/analytics info panel. Admins toggle this per user.';
