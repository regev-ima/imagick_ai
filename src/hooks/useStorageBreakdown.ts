import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "./useSubscription";
import { useEffectiveUser } from "./useImpersonation";

export interface GalleryStorageInfo {
  id: string;
  name: string;
  imageCount: number;
  estimatedSizeMb: number;
  percentOfTotal: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface StorageByType {
  originals: number;
  edited: number;
  thumbnails: number;
  trash: number;
}

export function useStorageBreakdown() {
  const { effectiveUserId } = useEffectiveUser();
  const { storageUsedMb, maxStorageGb } = useSubscription();

  const { data, isLoading } = useQuery({
    queryKey: ["storage-breakdown", effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return null;

      // Fetch galleries with image counts
      const { data: galleries, error: gError } = await supabase
        .from("galleries")
        .select("id, name, status, total_images, created_at, updated_at")
        .eq("user_id", effectiveUserId)
        .order("total_images", { ascending: false });

      if (gError) {
        console.error("Error fetching galleries for storage:", gError);
        return null;
      }

      // Fetch image counts by status for storage-by-type estimation
      const { data: images, error: iError } = await supabase
        .from("gallery_images")
        .select("id, status, edited_url, thumbnail_url")
        .eq("user_id", effectiveUserId);

      if (iError) {
        console.error("Error fetching images for storage:", iError);
        return null;
      }

      const totalImages = galleries?.reduce((sum, g) => sum + (g.total_images || 0), 0) || 1;
      const totalStorageMb = storageUsedMb || 0;

      // Calculate per-gallery storage proportionally
      const galleryBreakdown: GalleryStorageInfo[] = (galleries || []).map((g) => {
        const count = g.total_images || 0;
        const estimatedSizeMb = totalImages > 0 ? (count / totalImages) * totalStorageMb : 0;
        return {
          id: g.id,
          name: g.name,
          imageCount: count,
          estimatedSizeMb,
          percentOfTotal: totalStorageMb > 0 ? (estimatedSizeMb / totalStorageMb) * 100 : 0,
          status: g.status,
          createdAt: g.created_at,
          updatedAt: g.updated_at,
        };
      });

      // Storage by type estimation
      const allImages = images || [];
      const trashCount = allImages.filter((i) => i.status === "trash").length;
      const editedCount = allImages.filter((i) => i.edited_url).length;
      const thumbCount = allImages.filter((i) => i.thumbnail_url).length;
      const originalCount = allImages.length;

      // Rough estimation: originals ~70%, edited ~20%, thumbnails ~5%, trash ~5%
      const totalParts = originalCount + editedCount * 0.3 + thumbCount * 0.05 + trashCount;
      const storageByType: StorageByType = {
        originals: totalParts > 0 ? ((originalCount - trashCount) / totalParts) * totalStorageMb : 0,
        edited: totalParts > 0 ? ((editedCount * 0.3) / totalParts) * totalStorageMb : 0,
        thumbnails: totalParts > 0 ? ((thumbCount * 0.05) / totalParts) * totalStorageMb : 0,
        trash: totalParts > 0 ? (trashCount / totalParts) * totalStorageMb : 0,
      };

      // Inactive galleries (not updated in 90+ days)
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const inactiveGalleries = galleryBreakdown.filter(
        (g) => new Date(g.updatedAt) < ninetyDaysAgo
      );

      return {
        galleries: galleryBreakdown,
        storageByType,
        totalStorageMb,
        maxStorageGb,
        trashCount,
        inactiveGalleries,
        totalImages,
      };
    },
    enabled: !!effectiveUserId,
  });

  return { data, isLoading };
}
