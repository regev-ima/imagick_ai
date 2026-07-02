-- Let the photographer name each detected person (a face cluster): roles like
-- חתן / כלה / אב הכלה, or any custom family title. Persisted so it survives
-- reloads; re-running face detection rebuilds clusters, so labels are best-effort
-- per run (a future enhancement could re-attach labels by identity).
ALTER TABLE face_clusters
  ADD COLUMN IF NOT EXISTS label text;
