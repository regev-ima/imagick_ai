-- Remove the old SQL visual clusterer. Grouping now runs exclusively through the
-- new Modal community-detection engine (with the EXIF time gate); the old
-- cluster_gallery_images fallback in process-pipeline has been removed, so this
-- function is orphaned. Dropping it guarantees no old grouping path can run.
DROP FUNCTION IF EXISTS cluster_gallery_images(uuid);
DROP FUNCTION IF EXISTS cluster_gallery_images(uuid, float);
