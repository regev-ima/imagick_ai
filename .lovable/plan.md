

## Plan: Run Two Face Search Migrations

### Migration 1: `20260325020000_improve_clustering_robustness.sql`
Updates `cluster_gallery_faces` to:
- Filter out deleted/non-ready images from clustering (JOIN on `gallery_images` with `status = 'ready'`)
- Early exit when no faces have vectors
- Initialize new clusters with `face_count = 0` (recalculated at end)

### Migration 2: `20260325030000_add_missing_face_rls_policies.sql`
Adds missing RLS policies (INSERT + DELETE) on `face_detections` and `face_clusters` so client-side face detection can write results and "Clear & Re-run" can delete old data.

### Steps

1. **Run migration 1** — Execute the clustering robustness SQL via the migration tool.
2. **Run migration 2** — Execute the RLS policies SQL via the migration tool.
3. **Reset stuck galleries** — Update any galleries stuck on `'processing'` back to `'idle'`.

### No code changes needed
Client code already matches these DB changes.

