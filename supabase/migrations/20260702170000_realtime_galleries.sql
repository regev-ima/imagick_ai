-- Enable Supabase Realtime for galleries + gallery_images so the gallery
-- editor and the galleries list update live (no manual refresh) — imported
-- photos appear as the Drive transfer streams them in, and status changes
-- (transferring → processing → ready) land instantly instead of waiting for
-- the 5s poll. Mirrors the existing realtime setup for user_subscriptions /
-- user_addons.

-- REPLICA IDENTITY FULL so UPDATE/DELETE events carry the old row — required
-- for the client-side `gallery_id=eq.…` filter to match DELETE events (e.g.
-- moving an image to trash) where only the old record is available.
ALTER TABLE public.galleries REPLICA IDENTITY FULL;
ALTER TABLE public.gallery_images REPLICA IDENTITY FULL;

-- Add to the realtime publication, idempotently (ADD TABLE errors if already a
-- member, which would break re-runs against an environment already patched).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'galleries'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.galleries;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'gallery_images'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.gallery_images;
  END IF;
END $$;
