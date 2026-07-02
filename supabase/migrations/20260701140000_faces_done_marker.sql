-- Face bounding boxes are now stored in ORIGINAL-image pixel coordinates (the
-- pipeline previously stored detection-frame pixels — e.g. thumbnail ~256px —
-- which made the frontend crop the wrong region against the full-size preview).
--
-- `faces_done` marks whether an image's faces were computed in the CURRENT
-- (original-coord) scheme. Existing rows default to FALSE, so the next run with
-- faces enabled recomputes them and overwrites the stale, wrongly-scaled boxes.
ALTER TABLE image_features
  ADD COLUMN IF NOT EXISTS faces_done boolean NOT NULL DEFAULT false;
