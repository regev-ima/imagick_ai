DROP FUNCTION IF EXISTS public.increment_style_transfer_completed(uuid);
CREATE OR REPLACE FUNCTION public.increment_style_transfer_completed(p_style_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE styles
  SET import_transfers_completed = COALESCE(import_transfers_completed, 0) + 1
  WHERE id = p_style_id;
$$;