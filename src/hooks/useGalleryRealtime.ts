import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Live-updates a single gallery (the editor page) over Supabase Realtime so
 * imported photos appear and status changes land instantly — no manual
 * refresh, no waiting for the 5s poll.
 *
 * During a Drive import the webhook inserts gallery_images in batches, so
 * INSERT events arrive in bursts. Image-list invalidation is debounced to
 * coalesce a burst into a single refetch instead of re-querying the (possibly
 * thousands of rows) list per inserted image. Gallery-row changes are rare and
 * cheap, so those invalidate immediately.
 *
 * Invalidation (not optimistic cache patching) keeps this correct regardless
 * of the editor's column subset, sort order and soft-delete filtering.
 */
export function useGalleryRealtime(galleryId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!galleryId) return;

    let imagesTimer: ReturnType<typeof setTimeout> | undefined;
    const invalidateImagesSoon = () => {
      if (imagesTimer) clearTimeout(imagesTimer);
      imagesTimer = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["gallery-images", galleryId] });
        queryClient.invalidateQueries({ queryKey: ["gallery-trash", galleryId] });
      }, 500);
    };

    const channel = supabase
      .channel(`gallery-rt-${galleryId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "gallery_images",
          filter: `gallery_id=eq.${galleryId}`,
        },
        invalidateImagesSoon,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "galleries",
          filter: `id=eq.${galleryId}`,
        },
        // Partial key match — covers ["gallery", id, effectiveUserId].
        () => queryClient.invalidateQueries({ queryKey: ["gallery", galleryId] }),
      )
      .subscribe();

    return () => {
      if (imagesTimer) clearTimeout(imagesTimer);
      supabase.removeChannel(channel);
    };
  }, [galleryId, queryClient]);
}

/**
 * Live-updates the galleries list for a user so status badges
 * (transferring → processing → ready) and new collections appear without a
 * refresh. The list query has no poll, so realtime is the only thing keeping
 * it live. Debounced because a finishing import can flip several rows at once.
 */
export function useGalleriesRealtime(userId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const invalidateSoon = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["galleries", userId] });
      }, 500);
    };

    const channel = supabase
      .channel(`galleries-rt-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "galleries",
          filter: `user_id=eq.${userId}`,
        },
        invalidateSoon,
      )
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
}
