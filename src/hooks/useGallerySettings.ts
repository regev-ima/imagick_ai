import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// The new columns added by migration 20260511120000_share_gallery_foundation.sql
// are not yet present in the auto-generated Database types. This local type
// captures them so the rest of the share UI can stay typed.
export interface GalleryBrandSettings {
  brand_logo_url: string | null;
  brand_primary_color: string | null;
  brand_accent_color: string | null;
  brand_font_pair: string | null;
  intro_mode: "none" | "cinema";
  selection_mode_enabled: boolean;
  selection_target_count: number;
  email_gate_enabled: boolean;
  expiry_date: string | null;
  revoked_at: string | null;
  share_secret: string | null;
}

export interface SavedBrandAsset {
  id: string;
  user_id: string;
  name: string;
  logo_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
  font_pair: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Hook for reading the new brand/privacy/selection columns from the galleries
 * table. Returns sensible defaults when the row hasn't been migrated yet or
 * fields are null.
 */
export function useGalleryBrandData(galleryId: string, enabled = true) {
  return useQuery({
    queryKey: ["gallery-brand", galleryId],
    enabled: enabled && !!galleryId,
    queryFn: async (): Promise<Partial<GalleryBrandSettings>> => {
      const { data, error } = await (supabase
        .from("galleries") as any)
        .select(
          "brand_logo_url, brand_primary_color, brand_accent_color, brand_font_pair, intro_mode, selection_mode_enabled, selection_target_count, email_gate_enabled, expiry_date, revoked_at, share_secret",
        )
        .eq("id", galleryId)
        .maybeSingle();
      if (error) throw error;
      return (data ?? {}) as Partial<GalleryBrandSettings>;
    },
  });
}

/** Reads the photographer's saved brand presets for the dropdown. */
export function useSavedBrandAssets(userId: string | undefined) {
  return useQuery({
    queryKey: ["brand-assets", userId],
    enabled: !!userId,
    queryFn: async (): Promise<SavedBrandAsset[]> => {
      const { data, error } = await (supabase as any)
        .from("gallery_brand_assets")
        .select("*")
        .eq("user_id", userId)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SavedBrandAsset[];
    },
  });
}

/** Saves the current brand block as a reusable preset on `gallery_brand_assets`. */
export function useSaveBrandPreset(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (preset: {
      name?: string;
      logo_url: string | null;
      primary_color: string | null;
      accent_color: string | null;
      font_pair: string | null;
    }) => {
      if (!userId) throw new Error("Not signed in");
      const { error } = await (supabase as any)
        .from("gallery_brand_assets")
        .insert({
          user_id: userId,
          name: preset.name || "Default brand",
          logo_url: preset.logo_url,
          primary_color: preset.primary_color,
          accent_color: preset.accent_color,
          font_pair: preset.font_pair,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brand-assets", userId] });
      toast.success("Brand preset saved");
    },
    onError: (e: any) => toast.error(e?.message || "Could not save brand preset"),
  });
}

/** Active gallery sessions count (where expires_at > now). */
export function useActiveGallerySessionsCount(galleryId: string, enabled = true) {
  return useQuery({
    queryKey: ["gallery-active-sessions", galleryId],
    enabled: enabled && !!galleryId,
    queryFn: async (): Promise<number> => {
      const { count, error } = await (supabase
        .from("gallery_sessions") as any)
        .select("*", { count: "exact", head: true })
        .eq("gallery_id", galleryId)
        .gt("expires_at", new Date().toISOString());
      if (error) {
        // Table may not exist on older deploys — fail soft.
        return 0;
      }
      return count ?? 0;
    },
  });
}
