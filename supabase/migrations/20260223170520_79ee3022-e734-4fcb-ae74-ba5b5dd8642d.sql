
ALTER TABLE galleries 
  ADD COLUMN IF NOT EXISTS import_folders_total integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS import_folders_completed integer NOT NULL DEFAULT 0;

DROP FUNCTION IF EXISTS increment_gallery_folder_completed(uuid);
CREATE OR REPLACE FUNCTION increment_gallery_folder_completed(p_gallery_id uuid)
RETURNS TABLE(import_folders_completed integer, import_folders_total integer)
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $$
  UPDATE galleries
  SET import_folders_completed = COALESCE(import_folders_completed, 0) + 1
  WHERE id = p_gallery_id
  RETURNING import_folders_completed, import_folders_total;
$$;
