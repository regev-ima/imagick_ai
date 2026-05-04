CREATE OR REPLACE FUNCTION get_edits_per_user()
RETURNS TABLE(user_id uuid, edits_count bigint)
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT user_id, COUNT(*)::bigint as edits_count
  FROM image_edits
  GROUP BY user_id;
$$;