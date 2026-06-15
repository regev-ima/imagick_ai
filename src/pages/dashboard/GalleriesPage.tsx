import { useMemo, useState, type CSSProperties } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import {
  Plus,
  Search,
  Grid3X3,
  List,
  MoreHorizontal,
  Images,
  ExternalLink,
  Trash2,
  Edit3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { SHOWCASE_GALLERY_ID } from "@/lib/constants";
import { getThumbnailUrl } from "@/lib/imageUrls";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useEffectiveUser } from "@/hooks/useImpersonation";
import { useDominantColor } from "@/hooks/useDominantColor";
import { Orb } from "@/components/aura/Orb";

type ViewMode = "grid" | "list";
type StatusFilter = "all" | "working" | "ready" | "error";

const WORKING_STATUSES = ["uploading", "processing", "culling", "transferring"];

const EASE = [0.2, 0, 0, 1] as const;

const statusLed = (status: string) =>
  status === "ready" ? "var(--secondary)" : status === "error" ? "var(--destructive)" : "var(--rating)";

const statusLabel = (status: string) =>
  status === "ready" ? "Ready" : status === "error" ? "Error" : "Processing";

/**
 * Inline style helper: a card's accent vars resolve to the photo's dominant
 * hue when available, otherwise the brand `--primary`. Utilities then read
 * `hsl(var(--dynamic-primary))` so glow/accents pick up the image's color.
 */
const dynamicVars = (color: string | null): CSSProperties =>
  color ? ({ "--dynamic-primary": color } as CSSProperties) : {};

export default function GalleriesPage() {
  const { effectiveUserId } = useEffectiveUser();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const queryClient = useQueryClient();

  const { data: galleries = [], isLoading } = useQuery({
    queryKey: ["galleries", effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return [];
      const { data, error } = await supabase
        .from("galleries")
        .select("*")
        .eq("user_id", effectiveUserId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!effectiveUserId,
  });

  const deleteGallery = useMutation({
    mutationFn: async (galleryId: string) => {
      const { error } = await supabase.from("galleries").delete().eq("id", galleryId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["galleries"] });
      toast.success("Gallery deleted");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete gallery");
    },
  });

  const [showcaseDeleteOpen, setShowcaseDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const counts = useMemo(
    () => ({
      all: galleries.length,
      working: galleries.filter((g) => WORKING_STATUSES.includes(g.status)).length,
      ready: galleries.filter((g) => g.status === "ready").length,
      error: galleries.filter((g) => g.status === "error").length,
    }),
    [galleries],
  );

  const filteredGalleries = useMemo(
    () =>
      galleries.filter((gallery) => {
        const q = searchQuery.toLowerCase();
        const matchesQuery =
          gallery.name.toLowerCase().includes(q) || (gallery.description?.toLowerCase() || "").includes(q);
        const matchesStatus =
          statusFilter === "all"
            ? true
            : statusFilter === "working"
              ? WORKING_STATUSES.includes(gallery.status)
              : gallery.status === statusFilter;
        return matchesQuery && matchesStatus;
      }),
    [galleries, searchQuery, statusFilter],
  );

  const totalImages = useMemo(() => galleries.reduce((sum, g) => sum + (g.total_images || 0), 0), [galleries]);

  const share = (galleryId: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/gallery/${galleryId}`);
    toast.success("Gallery link copied!");
  };

  const requestDelete = (gallery: { id: string; name: string }) => {
    if (gallery.id === SHOWCASE_GALLERY_ID) setShowcaseDeleteOpen(true);
    else setDeleteTarget({ id: gallery.id, name: gallery.name });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Orb className="h-12 w-12" />
      </div>
    );
  }

  const filterChips: { key: StatusFilter; label: string; led?: string }[] = [
    { key: "all", label: "All" },
    { key: "working", label: "Processing", led: "var(--rating)" },
    { key: "ready", label: "Ready", led: "var(--secondary)" },
    ...(counts.error > 0 ? [{ key: "error" as const, label: "Errors", led: "var(--destructive)" }] : []),
  ];

  return (
    <div className="relative min-h-full px-4 py-6 lg:px-8 lg:py-8">
      {/* Ambient spectral wash behind the masthead — an AI moment, kept faint */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-64 opacity-[0.5]"
        style={{ background: "radial-gradient(80% 100% at 18% 0%, hsl(var(--accent) / 0.10), transparent 70%)" }}
      />

      <div className="relative mx-auto w-full max-w-[1600px] space-y-8">
        {/* ── Masthead: engine mark + title + live telemetry + CTA ───────── */}
        <motion.header
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: EASE }}
          className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-4">
            <Orb className="hidden h-11 w-11 shrink-0 sm:block" />
            <div className="min-w-0">
              <p className="aura-microlabel">Library</p>
              <h1 className="font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
                Collections
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Live telemetry strip */}
            <div className="hidden items-stretch gap-2 md:flex">
              <Stat label="Collections" value={counts.all.toLocaleString()} />
              <Stat label="Images" value={totalImages.toLocaleString()} />
              {counts.working > 0 && (
                <Stat label="Processing" value={counts.working.toLocaleString()} led="var(--rating)" pulse />
              )}
            </div>
            <Button variant="glow" asChild>
              <Link to="/dashboard/galleries/new" className="gap-2">
                <Plus className="h-4 w-4" />
                New collection
              </Link>
            </Button>
          </div>
        </motion.header>

        <hr className="aura-hairline" />

        {/* ── Toolbar: search · status chips · view toggle ───────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06, duration: 0.45, ease: EASE }}
          className="flex flex-col gap-3 lg:flex-row lg:items-center"
        >
          <div className="flex flex-1 items-center gap-2 rounded-2xl border border-border/70 bg-card/60 px-4 py-2.5 backdrop-blur-md transition-[border-color,box-shadow] duration-150 focus-within:border-primary/60 focus-within:shadow-[0_0_24px_-10px_hsl(var(--glow-primary)/0.6)]">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search collections…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/75"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-border/60 bg-card/40 p-1 backdrop-blur-md">
              {filterChips.map((chip) => {
                const active = statusFilter === chip.key;
                return (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={() => setStatusFilter(chip.key)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-xl px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] transition-[color,background-color] duration-150",
                      active
                        ? "bg-primary/15 text-foreground"
                        : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground",
                    )}
                  >
                    {chip.led && <span className="aura-led" style={{ "--led": chip.led } as CSSProperties} />}
                    {chip.label}
                    <span className={cn("font-mono", active ? "text-primary" : "text-muted-foreground/70")}>
                      {counts[chip.key]}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="ml-auto flex items-center gap-1 rounded-2xl border border-border/60 bg-card/40 p-1 backdrop-blur-md lg:ml-1">
              <button
                type="button"
                aria-label="Grid view"
                onClick={() => setViewMode("grid")}
                className={cn(
                  "grid h-8 w-8 place-items-center rounded-xl transition-colors",
                  viewMode === "grid" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Grid3X3 className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="List view"
                onClick={() => setViewMode("list")}
                className={cn(
                  "grid h-8 w-8 place-items-center rounded-xl transition-colors",
                  viewMode === "list" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.div>

        {/* ── Grid / list ────────────────────────────────────────────────── */}
        {filteredGalleries.length > 0 &&
          (viewMode === "grid" ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {filteredGalleries.map((gallery, i) => (
                <GalleryCard
                  key={gallery.id}
                  gallery={gallery}
                  index={i}
                  onEdit={() => navigate(`/dashboard/galleries/${gallery.id}`)}
                  onShare={() => share(gallery.id)}
                  onDelete={() => requestDelete(gallery)}
                />
              ))}
            </div>
          ) : (
            <div className="overflow-hidden rounded-3xl border border-border/60 bg-card/55 backdrop-blur-xl">
              {filteredGalleries.map((gallery, i) => (
                <GalleryRow
                  key={gallery.id}
                  gallery={gallery}
                  last={i === filteredGalleries.length - 1}
                  onEdit={() => navigate(`/dashboard/galleries/${gallery.id}`)}
                  onShare={() => share(gallery.id)}
                  onDelete={() => requestDelete(gallery)}
                />
              ))}
            </div>
          ))}

        {/* ── Empty state (no-results vs no-collections) ─────────────────── */}
        {filteredGalleries.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="grid place-items-center rounded-3xl border border-border/60 bg-card/40 px-6 py-24 text-center backdrop-blur-md"
          >
            <Orb className="h-14 w-14" />
            <h3 className="mt-6 font-display text-lg font-semibold">
              {searchQuery || statusFilter !== "all" ? "Nothing matches" : "No collections yet"}
            </h3>
            <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
              {searchQuery || statusFilter !== "all"
                ? "Try a different search or filter."
                : "Hand me a shoot and I'll take it from there."}
            </p>
            {!searchQuery && statusFilter === "all" && (
              <Button variant="glow" asChild className="mt-6">
                <Link to="/dashboard/galleries/new" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create your first collection
                </Link>
              </Button>
            )}
          </motion.div>
        )}

        {/* Delete confirmation */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent className="max-w-sm">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete collection?</AlertDialogTitle>
              <AlertDialogDescription>
                <span className="font-medium text-foreground">{deleteTarget?.name}</span> will be permanently deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  if (deleteTarget) deleteGallery.mutate(deleteTarget.id);
                  setDeleteTarget(null);
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Showcase gallery delete warning */}
        <AlertDialog open={showcaseDeleteOpen} onOpenChange={setShowcaseDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Warning: Showcase Gallery</AlertDialogTitle>
              <AlertDialogDescription>
                This gallery serves as the image source for all style Before/After previews (Showcase). Deleting it
                will break the Before/After display for all styles. Are you sure you want to proceed?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deleteGallery.mutate(SHOWCASE_GALLERY_ID)}
              >
                Delete Anyway
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

/** Compact masthead telemetry tile (Roboto Mono labels, semantic LED). */
function Stat({ label, value, led, pulse }: { label: string; value: string; led?: string; pulse?: boolean }) {
  return (
    <div className="flex flex-col justify-center rounded-2xl border border-border/60 bg-card/45 px-3.5 py-1.5 backdrop-blur-md">
      <span className="flex items-center gap-1.5 font-display text-lg font-bold leading-none tabular-nums">
        {led && <span className={cn("aura-led", pulse && "aura-led-pulse")} style={{ "--led": led } as CSSProperties} />}
        {value}
      </span>
      <span className="aura-microlabel mt-1 leading-none">{label}</span>
    </div>
  );
}

interface GalleryItemProps {
  gallery: any;
  onDelete: () => void;
  onEdit: () => void;
  onShare: () => void;
}

function ActionsMenu({ onEdit, onShare, onDelete, className }: Omit<GalleryItemProps, "gallery"> & { className?: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-8 w-8 rounded-full", className)}
          onClick={(e) => e.preventDefault()}
          aria-label="Collection actions"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={(e) => { e.preventDefault(); onEdit(); }}>
          <Edit3 className="mr-2 h-4 w-4" />
          Open
        </DropdownMenuItem>
        <DropdownMenuItem onClick={(e) => { e.preventDefault(); onShare(); }}>
          <ExternalLink className="mr-2 h-4 w-4" />
          Copy share link
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive" onClick={(e) => { e.preventDefault(); onDelete(); }}>
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function GalleryCard({ gallery, index, onDelete, onEdit, onShare }: GalleryItemProps & { index: number }) {
  const isReady = gallery.status === "ready";
  const isError = gallery.status === "error";
  const isWorking = !isReady && !isError;
  const progress = gallery.total_images > 0 ? Math.round((gallery.processed_images / gallery.total_images) * 100) : 0;
  const led = statusLed(gallery.status);

  const thumb = gallery.hero_image_url ? getThumbnailUrl(gallery.hero_image_url) : null;
  // Material You: tint this card from its own hero image (falls back to brand).
  const dynamic = useDominantColor(thumb);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 12) * 0.025, duration: 0.4, ease: EASE }}
      style={dynamicVars(dynamic)}
    >
      <Link to={`/dashboard/galleries/${gallery.id}`} className="group block">
        <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/55 backdrop-blur-xl transition-[transform,border-color,box-shadow] duration-200 [transition-timing-function:cubic-bezier(0.2,0,0,1)] hover:-translate-y-1 hover:border-[hsl(var(--dynamic-primary)/0.55)] hover:shadow-[0_18px_50px_-18px_hsl(var(--dynamic-primary)/0.55)]">
          <div className="relative aspect-[4/5] overflow-hidden bg-muted">
            {thumb ? (
              <img
                src={thumb}
                alt={gallery.name}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                onError={(e) => {
                  const t = e.currentTarget;
                  if (t.src !== gallery.hero_image_url) t.src = gallery.hero_image_url;
                }}
              />
            ) : (
              <div className="grid h-full w-full place-items-center">
                <Images className="h-8 w-8 text-muted-foreground/40" />
              </div>
            )}

            {/* Legibility scrim grading into the card */}
            <div className="absolute inset-0 bg-gradient-to-t from-card via-card/35 to-transparent" />
            {/* Dynamic-color hover wash, sourced from the photo's own hue */}
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_120%,hsl(var(--dynamic-primary)/0.22),transparent_60%)] opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

            <span
              className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-background/70 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] backdrop-blur-md"
              style={{ color: `hsl(${led})` }}
            >
              <span className={cn("aura-led", isWorking && "aura-led-pulse")} style={{ "--led": led } as CSSProperties} />
              {statusLabel(gallery.status)}
            </span>

            <div className="absolute right-2 top-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
              <ActionsMenu onEdit={onEdit} onShare={onShare} onDelete={onDelete} className="bg-background/60 backdrop-blur-md" />
            </div>

            {/* Title + meta sit over the image foot */}
            <div className="absolute inset-x-0 bottom-0 space-y-1 p-4">
              <div className="flex items-end justify-between gap-3">
                <h3 className="truncate text-sm font-medium text-foreground drop-shadow-sm transition-colors group-hover:text-[hsl(var(--dynamic-primary))]">
                  {gallery.name}
                </h3>
                <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                  {(gallery.total_images || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-xs text-muted-foreground">
                  {gallery.description || new Date(gallery.created_at).toLocaleDateString()}
                </p>
                {isWorking && (
                  <span className="shrink-0 font-mono text-[11px] text-[hsl(var(--dynamic-primary))]">{progress}%</span>
                )}
              </div>
            </div>

            {isWorking && (
              <div className="absolute inset-x-0 bottom-0 h-1 bg-background/40">
                <div
                  className="h-full bg-[image:var(--gradient-primary)] shadow-[0_0_10px_hsl(var(--glow-primary)/0.6)]"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function GalleryRow({ gallery, last, onDelete, onEdit, onShare }: GalleryItemProps & { last: boolean }) {
  const isReady = gallery.status === "ready";
  const isError = gallery.status === "error";
  const isWorking = !isReady && !isError;
  const progress = gallery.total_images > 0 ? Math.round((gallery.processed_images / gallery.total_images) * 100) : 0;
  const led = statusLed(gallery.status);

  const thumb = gallery.hero_image_url ? getThumbnailUrl(gallery.hero_image_url) : null;
  // Material You: each row picks up its hero image's hue too.
  const dynamic = useDominantColor(thumb);

  return (
    <Link
      to={`/dashboard/galleries/${gallery.id}`}
      style={dynamicVars(dynamic)}
      className={cn(
        "group relative flex items-center gap-4 px-4 py-3 transition-colors hover:bg-[hsl(var(--dynamic-primary)/0.06)]",
        !last && "border-b border-border/40",
      )}
    >
      {/* Dynamic-color accent bar (appears on hover) */}
      <span className="pointer-events-none absolute inset-y-2 left-0 w-[3px] rounded-full bg-[hsl(var(--dynamic-primary))] opacity-0 transition-opacity duration-150 group-hover:opacity-100" />

      <div className="h-12 w-[72px] shrink-0 overflow-hidden rounded-xl bg-muted">
        {thumb ? (
          <img
            src={thumb}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
            onError={(e) => {
              const t = e.currentTarget;
              if (t.src !== gallery.hero_image_url) t.src = gallery.hero_image_url;
            }}
          />
        ) : (
          <div className="grid h-full w-full place-items-center">
            <Images className="h-5 w-5 text-muted-foreground/40" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cn("aura-led", isWorking && "aura-led-pulse")} style={{ "--led": led } as CSSProperties} />
          <h3 className="truncate text-sm font-medium transition-colors group-hover:text-[hsl(var(--dynamic-primary))]">
            {gallery.name}
          </h3>
        </div>
        <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
          {(gallery.total_images || 0).toLocaleString()} images · {new Date(gallery.created_at).toLocaleDateString()}
        </p>
      </div>

      {isWorking && (
        <div className="hidden w-36 sm:block">
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-[image:var(--gradient-primary)] shadow-[0_0_10px_hsl(var(--glow-primary)/0.5)]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
      {isWorking && <span className="w-10 text-right font-mono text-xs text-primary">{progress}%</span>}

      <ActionsMenu onEdit={onEdit} onShare={onShare} onDelete={onDelete} />
    </Link>
  );
}
