-- Face clustering (and future heavy finalize work) runs through PostgREST with
-- the service key. The default API statement timeout (~8s) silently cancelled
-- cluster_gallery_faces_arcface on a 211-photo gallery, rolling back to zero
-- clusters. The function is now fast (~5s there), but bigger weddings scale
-- O(detections × people), so give backend-only calls real headroom.
-- Only service_role is changed — anon/authenticated keep the tight default.
ALTER ROLE service_role SET statement_timeout = '120s';
