
-- Add auth check to increment_lifecycle_login to prevent unauthorized manipulation
CREATE OR REPLACE FUNCTION public.increment_lifecycle_login(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Ensure caller matches the target user (service role bypasses RLS naturally)
  IF auth.uid() IS NOT NULL AND auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: can only update own login count';
  END IF;

  UPDATE public.user_lifecycle_profiles
  SET login_count = login_count + 1,
      last_active_at = now(),
      updated_at = now()
  WHERE user_id = p_user_id;
END;
$function$;
