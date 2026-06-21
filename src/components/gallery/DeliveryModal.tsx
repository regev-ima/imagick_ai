import { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cullingScoreToStars } from "@/lib/cullingScore";
import { getThumbnailUrl } from "@/lib/imageUrls";
import { cn } from "@/lib/utils";
import { Check, Heart, Star, Sparkles, Loader2, Wand2, Images } from "lucide-react";

interface DeliveryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  galleryId: string;
  galleryName?: string;
  /** Public client link, so we can surface "view as client" after saving. */
  clientLink?: string | null;
}

interface DImage {
  id: string;
  filename: string;
  original_url: string;
  thumbnail_url: string | null;
  in_collection: boolean | null;
  is_liked: boolean | null;
  ai_rating: number | null;
  culling_score: number | null;
  edited_url: string | null;
}

// NULL in_collection is read as "in" — matches get_client_gallery_images'
// COALESCE(in_collection, true), so an uncurated gallery still shows everything.
const isIn = (img: DImage) => img.in_collection !== false;
const isKeeper = (img: DImage) =>
  img.culling_score != null ? cullingScoreToStars(img.culling_score) >= 4 : (img.ai_rating ?? 0) >= 4;
const hasEdit = (img: DImage) => !!img.edited_url && img.edited_url !== "";

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function DeliveryModal({ open, onOpenChange, galleryId, galleryName, clientLink }: DeliveryModalProps) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const { data: images = [], isLoading } = useQuery({
    queryKey: ["delivery-images", galleryId],
    enabled: open && !!galleryId,
    queryFn: async (): Promise<DImage[]> => {
      const { data, error } = await supabase
        .from("gallery_images")
        .select("id, filename, original_url, thumbnail_url, in_collection, is_liked, ai_rating, culling_score, edited_url")
        .eq("gallery_id", galleryId)
        .neq("status", "deleted")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as DImage[];
    },
  });

  // Seed the working selection from the saved state each time we (re)open.
  useEffect(() => {
    if (open && images.length) {
      setSelected(new Set(images.filter(isIn).map((i) => i.id)));
    }
  }, [open, images]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const seed = (pick: (img: DImage) => boolean) => setSelected(new Set(images.filter(pick).map((i) => i.id)));

  const counts = useMemo(
    () => ({
      keepers: images.filter(isKeeper).length,
      likes: images.filter((i) => i.is_liked).length,
      edited: images.filter(hasEdit).length,
    }),
    [images],
  );

  const inCount = selected.size;
  const total = images.length;

  const handleSave = async () => {
    setSaving(true);
    try {
      const inIds = images.filter((i) => selected.has(i.id)).map((i) => i.id);
      const outIds = images.filter((i) => !selected.has(i.id)).map((i) => i.id);

      for (const batch of chunk(inIds, 200)) {
        const { error } = await supabase.from("gallery_images").update({ in_collection: true }).in("id", batch);
        if (error) throw error;
      }
      for (const batch of chunk(outIds, 200)) {
        const { error } = await supabase.from("gallery_images").update({ in_collection: false }).in("id", batch);
        if (error) throw error;
      }
      // Mark the gallery published so the link reads as intentionally live.
      const now = new Date().toISOString();
      await supabase.from("galleries").update({ published_at: now, last_published_at: now }).eq("id", galleryId);

      toast.success(`Client collection updated — ${inCount} of ${total} photos are now live.`);
      queryClient.invalidateQueries({ queryKey: ["delivery-images", galleryId] });
      queryClient.invalidateQueries({ queryKey: ["gallery", galleryId] });
      queryClient.invalidateQueries({ queryKey: ["gallery-images", galleryId] });
      onOpenChange(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not save the collection.";
      // Most likely cause before the migration is applied: the in_collection column is missing.
      toast.error(/in_collection|column/i.test(msg) ? "The delivery columns aren't live yet (run the migration)." : msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Images className="h-5 w-5 text-primary" />
            Choose the client's photos
          </DialogTitle>
          <DialogDescription>
            {galleryName ? <span className="font-medium text-foreground">{galleryName}</span> : "This gallery"} — tap a
            photo to put it in or pull it out. Only photos that are <span className="text-foreground">in</span> reach the
            client link.
          </DialogDescription>
        </DialogHeader>

        {/* Smart-fill */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Quick fill:</span>
          <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => seed(isKeeper)} disabled={isLoading}>
            <Sparkles className="h-3.5 w-3.5" /> Keepers ({counts.keepers})
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => seed((i) => !!i.is_liked)} disabled={isLoading}>
            <Heart className="h-3.5 w-3.5" /> Likes ({counts.likes})
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => seed(hasEdit)} disabled={isLoading}>
            <Wand2 className="h-3.5 w-3.5" /> Edited ({counts.edited})
          </Button>
          <Button variant="outline" size="sm" className="h-8" onClick={() => seed(() => true)} disabled={isLoading}>
            All
          </Button>
          <Button variant="outline" size="sm" className="h-8" onClick={() => setSelected(new Set())} disabled={isLoading}>
            None
          </Button>
        </div>

        {/* Grid */}
        <div className="max-h-[52vh] overflow-y-auto rounded-lg border border-border p-2">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading photos…
            </div>
          ) : images.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground">No photos in this gallery yet.</div>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7">
              {images.map((img) => {
                const on = selected.has(img.id);
                return (
                  <button
                    key={img.id}
                    onClick={() => toggle(img.id)}
                    className={cn(
                      "group relative aspect-square overflow-hidden rounded-lg ring-2 transition-all",
                      on ? "ring-primary" : "opacity-40 ring-transparent hover:opacity-75",
                    )}
                    aria-pressed={on}
                    title={img.filename}
                  >
                    <img
                      src={img.thumbnail_url || getThumbnailUrl(img.original_url)}
                      alt={img.filename}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                    <span
                      className={cn(
                        "absolute left-1 top-1 grid h-5 w-5 place-items-center rounded-full border transition-colors",
                        on ? "border-primary bg-primary text-primary-foreground" : "border-white/70 bg-black/40 text-transparent",
                      )}
                    >
                      <Check className="h-3 w-3" />
                    </span>
                    <span className="absolute bottom-1 right-1 flex gap-1">
                      {img.is_liked && <Heart className="h-3 w-3 fill-rose-400 text-rose-400" />}
                      {isKeeper(img) && <Star className="h-3 w-3 fill-amber-300 text-amber-300" />}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm">
            <span className="font-semibold text-foreground">{inCount}</span>{" "}
            <span className="text-muted-foreground">of {total} photos will reach the client</span>
          </div>
          <div className="flex items-center gap-2">
            {clientLink && (
              <a
                href={`/gallery/${clientLink}`}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Open client link
              </a>
            )}
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || isLoading}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save & update client link
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
