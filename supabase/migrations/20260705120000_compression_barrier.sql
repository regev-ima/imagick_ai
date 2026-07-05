-- Compression barrier instrumentation.
--
-- AI culling/tagging/faces must not start until every image's compressed webp
-- (compressed/{name}_reduced.webp) exists. Compression is an async step in the
-- upload/transfer infra with no callback, so the `await-compression` edge
-- function polls the objects (HEAD) and records progress here; the admin
-- pipeline timeline reads these columns (galleries is already in the
-- supabase_realtime publication, so the timeline updates live).
ALTER TABLE public.galleries
  ADD COLUMN IF NOT EXISTS compression_started_at   timestamptz,
  ADD COLUMN IF NOT EXISTS compression_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS compression_ready_count  integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS compression_total_count  integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.galleries.compression_started_at IS
  'When the compression barrier (await-compression) began polling for compressed webp derivatives.';
COMMENT ON COLUMN public.galleries.compression_completed_at IS
  'When all images were confirmed compressed (or the safety timeout elapsed) and AI culling was dispatched.';
COMMENT ON COLUMN public.galleries.compression_ready_count IS
  'Live count of images whose compressed webp exists — drives the admin timeline compression progress.';
COMMENT ON COLUMN public.galleries.compression_total_count IS
  'Total images the compression barrier is waiting on.';
