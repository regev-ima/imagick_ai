import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SHOWCASE_GALLERY_ID } from "@/lib/constants";

/**
 * Maps style_id → first edited image URL from the shared showcase gallery.
 * Used to render cover thumbnails in style pickers across the app.
 *
 * Single shared queryKey so React Query dedupes the fetch across all callers.
 */
export function useShowcaseCovers(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["showcase-covers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("image_edits")
        .select("style_id, edited_url")
        .eq("gallery_id", SHOWCASE_GALLERY_ID);
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const row of data || []) {
        if (row.style_id && row.edited_url && !map[row.style_id]) {
          map[row.style_id] = row.edited_url;
        }
      }
      return map;
    },
    enabled: options.enabled ?? true,
    staleTime: 5 * 60 * 1000,
  });
}
