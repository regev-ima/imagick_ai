-- Store Google Drive source links on galleries for future cloning
ALTER TABLE public.galleries
ADD COLUMN source_drive_links text[] DEFAULT '{}'::text[];