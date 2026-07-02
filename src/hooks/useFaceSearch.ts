import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface FaceCluster {
  id: string;
  gallery_id: string;
  face_count: number;
  representative_bbox: { top: number; left: number; width: number; height: number } | null;
  representative_image: {
    id: string;
    original_url: string;
  } | null;
  created_at: string;
}

interface FaceDetectionWithImage {
  id: string;
  bounding_box: { top: number; left: number; width: number; height: number };
  image: {
    id: string;
    original_url: string;
    filename: string;
  } | null;
}

/**
 * Read-only face data. Faces are produced by the AI Culling pipeline (ArcFace);
 * this hook only reads the resulting clusters + a progress count. Detecting /
 * re-detecting faces is done by running AI Culling with "Recognize people".
 */
export function useFaceSearch(galleryId: string | undefined, isDetectionRunning = false) {
  // Poll detection count during processing for progress indication.
  const faceSearchProgress = useQuery({
    queryKey: ["face-search-progress", galleryId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("face_detections" as any)
        .select("id", { count: "exact", head: true })
        .eq("gallery_id", galleryId!);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!galleryId,
    refetchInterval: isDetectionRunning ? 4000 : false,
  });

  // Fetch face clusters for the gallery.
  const faceClusters = useQuery({
    queryKey: ["face-clusters", galleryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("face_clusters" as any)
        .select(`
          id, gallery_id, face_count, representative_bbox, created_at,
          representative_image:gallery_images!representative_image_id (
            id, original_url
          )
        `)
        .eq("gallery_id", galleryId!)
        .order("face_count", { ascending: false });
      if (error) throw error;
      return (data as unknown as FaceCluster[]) || [];
    },
    enabled: !!galleryId,
  });

  return { faceClusters, faceSearchProgress };
}

// Separate hook for fetching images of a specific cluster.
export function useFaceClusterImages(clusterId: string | null) {
  return useQuery({
    queryKey: ["face-cluster-images", clusterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("face_detections" as any)
        .select(`
          id, bounding_box,
          image:gallery_images!image_id (
            id, original_url, filename
          )
        `)
        .eq("cluster_id", clusterId!);
      if (error) throw error;
      return (data as unknown as FaceDetectionWithImage[]) || [];
    },
    enabled: !!clusterId,
  });
}
