import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
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
  Library,
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
import { useGalleriesRealtime } from "@/hooks/useGalleryRealtime";
import { useDominantColor } from "@/hooks/useDominantColor";
import { Orb } from "@/components/aura/Orb";

type ViewMode = "grid" | "list";
type StatusFilter = "all" | "working" | "ready" | "error";

const WORKING_STATUSES = ["uploading", "processing", "culling", "transferring"];

// LIGHTROOM motion — calm, responsive fades/slides. No bounce, no float.
const EASE: [number, number, number, number] = [0.22, 0.61, 0.36, 1];

const statusLed = (status: string) =>
  status === "ready" ? "var(--secondary)" : status === "error" ? "var(--destructive)" : "var(--rating)";

const statusLabel = (status: string) =>
  status === "ready" ? "Ready" : status === "error" ? "Error" : "Processing";

/**
 * The AI mark — a 4-point sparkle (the logo star). Royal blue by default.
 * Copied from the approved LightroomDashboard reference; tinted via
 * currentColor so it inherits text-primary / text-accent tokens.
 */
function Sparkle({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      style={{ display: "block" }}
    >
      <path
        d="M12 0 C12.9 7.2 16.8 11.1 24 12 C16.8 12.9 12.9 16.8 12 24 C11.1 16.8 7.2 12.9 0 12 C7.2 11.1 11.1 7.2 12 0 Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** A Lightroom-style tonal panel — hairline border, soft shadow. */
function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("glass-card overflow-hidden rounded-[--radius]", className)}>{children}</div>;
}

/**
 * Inline style helper: a cell's accent vars resolve to the photo's dominant
 * hue when available, otherwise the brand `--primary`. A thin per-cell accent
 * keyline then reads `hsl(var(--dynamic-primary))`.
 */
const dynamicVars = (color: string | null): CSSProperties =>
  color ? ({ "--dynamic-primary": color } as CSSProperties) : {};

export default function GalleriesPage() {
  const { effectiveUserId } = useEffectiveUser();
  // Live status badges (transferring → processing → ready) without a refresh.
  useGalleriesRealtime(effectiveUserId);
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
      <div className="flex min-h-[400px] items-center justify-center bg-background">
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
    <div className="relative min-h-full bg-background px-5 py-7 lg:px-10 lg:py-10">
      <div className="relative mx-auto w-full max-w-[1600px]">
        {/* ════ MASTHEAD — mono "LIBRARY" + count readouts + New collection ══ */}
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          <div className="flex items-center justify-between gap-4 pb-3">
            <span className="caption flex items-center gap-2">
              <Library className="h-3 w-3" />
              Library
            </span>
            <span className="caption flex flex-wrap items-center gap-x-4 gap-y-1 text-foreground">
              <span className="flex items-center gap-1.5">
                <span className="folio text-foreground">{counts.all.toLocaleString()}</span>
                <span className="text-muted-foreground">collections</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="folio text-foreground">{totalImages.toLocaleString()}</span>
                <span className="text-muted-foreground">images</span>
              </span>
              {counts.working > 0 && (
                <span className="flex items-center gap-1.5 text-[hsl(var(--rating))]">
                  <span
                    className="aura-led aura-led-pulse"
                    style={{ "--led": "var(--rating)" } as CSSProperties}
                  />
                  <span className="folio">{counts.working.toLocaleString()}</span>
                  <span>working</span>
                </span>
              )}
            </span>
          </div>

          <hr className="aura-hairline" />

          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <h1 className="text-3xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-4xl">
              Collections
            </h1>
            <Button variant="glow" asChild>
              <Link to="/dashboard/galleries/new" className="gap-2">
                <Plus className="h-4 w-4" />
                New collection
              </Link>
            </Button>
          </div>
        </motion.header>

        {/* ════ TOOLBAR — pro control strip: search · status · view ═════════ */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06, duration: 0.5, ease: EASE }}
          className="mt-6"
        >
          <Panel>
            <div className="flex flex-col gap-3 p-2.5 lg:flex-row lg:items-center">
              {/* Search */}
              <div className="flex flex-1 items-center gap-2.5 rounded-[--radius] border border-border bg-background px-3.5 py-2.5 transition-colors duration-200 [transition-timing-function:cubic-bezier(0.22,0.61,0.36,1)] focus-within:border-primary/70">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search collections…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="min-w-0 flex-1 bg-transparent font-sans text-sm text-foreground outline-none placeholder:text-muted-foreground/75"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* Status segmented control */}
                <div className="flex flex-wrap items-center gap-1 rounded-[--radius] border border-border bg-background p-1">
                  {filterChips.map((chip) => {
                    const active = statusFilter === chip.key;
                    return (
                      <button
                        key={chip.key}
                        type="button"
                        onClick={() => setStatusFilter(chip.key)}
                        className={cn(
                          "inline-flex items-center gap-2 rounded-[calc(var(--radius)-2px)] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors duration-150",
                          active
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground",
                        )}
                      >
                        {chip.led && <span className="aura-led" style={{ "--led": chip.led } as CSSProperties} />}
                        {chip.label}
                        <span
                          className={cn(
                            "font-mono",
                            active ? "text-primary-foreground/80" : "text-muted-foreground/70",
                          )}
                        >
                          {counts[chip.key]}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* View toggle */}
                <div className="ml-auto flex items-center gap-1 rounded-[--radius] border border-border bg-background p-1 lg:ml-0">
                  <button
                    type="button"
                    aria-label="Grid view"
                    onClick={() => setViewMode("grid")}
                    className={cn(
                      "grid h-8 w-8 place-items-center rounded-[calc(var(--radius)-2px)] transition-colors",
                      viewMode === "grid"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="List view"
                    onClick={() => setViewMode("list")}
                    className={cn(
                      "grid h-8 w-8 place-items-center rounded-[calc(var(--radius)-2px)] transition-colors",
                      viewMode === "list"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <List className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </Panel>
        </motion.div>

        {/* ════ CATALOG — keyline cells (grid) / pro rows (list) ════════════ */}
        {filteredGalleries.length > 0 &&
          (viewMode === "grid" ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5, ease: EASE }}
              className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
            >
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
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5, ease: EASE }}
              className="mt-6"
            >
              <Panel>
                <ul className="divide-y divide-border">
                  {filteredGalleries.map((gallery) => (
                    <GalleryRow
                      key={gallery.id}
                      gallery={gallery}
                      onEdit={() => navigate(`/dashboard/galleries/${gallery.id}`)}
                      onShare={() => share(gallery.id)}
                      onDelete={() => requestDelete(gallery)}
                    />
                  ))}
                </ul>
              </Panel>
            </motion.div>
          ))}

        {/* ════ EMPTY STATE (no-results vs no-collections) — restyled ═══════ */}
        {filteredGalleries.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="mt-6"
          >
            <Panel>
              <div className="grid place-items-center px-6 py-24 text-center">
                <Orb className="h-14 w-14" />
                <h3 className="mt-6 text-xl font-semibold tracking-tight">
                  {searchQuery || statusFilter !== "all" ? "Nothing matches" : "No collections yet"}
                </h3>
                <p className="mt-2 max-w-sm font-sans text-sm leading-relaxed text-muted-foreground">
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
              </div>
            </Panel>
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

interface GalleryItemProps {
  gallery: any;
  onDelete: () => void;
  onEdit: () => void;
  onShare: () => void;
}

function ActionsMenu({
  onEdit,
  onShare,
  onDelete,
  className,
}: Omit<GalleryItemProps, "gallery"> & { className?: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-8 w-8 rounded-[--radius]", className)}
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

/** Catalog cell — a Lightroom keyline plate: thumbnail, name, mono count, status dot. */
function GalleryCard({ gallery, index, onDelete, onEdit, onShare }: GalleryItemProps & { index: number }) {
  const isReady = gallery.status === "ready";
  const isError = gallery.status === "error";
  const isWorking = !isReady && !isError;
  const progress = gallery.total_images > 0 ? Math.round((gallery.processed_images / gallery.total_images) * 100) : 0;
  const led = statusLed(gallery.status);

  const thumb = gallery.hero_image_url ? getThumbnailUrl(gallery.hero_image_url) : null;
  // A thin per-cell accent keyline picks up the hero image's hue (falls back to brand).
  const dynamic = useDominantColor(thumb);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 12) * 0.025, duration: 0.4, ease: EASE }}
      style={dynamicVars(dynamic)}
    >
      <Link to={`/dashboard/galleries/${gallery.id}`} className="group block">
        <div className="overflow-hidden rounded-[--radius] border border-border bg-card transition-shadow duration-300 [transition-timing-function:cubic-bezier(0.22,0.61,0.36,1)] group-hover:border-[hsl(var(--dynamic-primary)/0.6)] group-hover:shadow-[var(--elevation-2)]">
          {/* Plate */}
          <div className="relative aspect-[4/3] overflow-hidden bg-muted plate-keyline">
            {thumb ? (
              <img
                src={thumb}
                alt={gallery.name}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                onError={(e) => {
                  const t = e.currentTarget;
                  if (t.src !== gallery.hero_image_url) t.src = gallery.hero_image_url;
                }}
              />
            ) : (
              <div className="grid h-full w-full place-items-center">
                <Images className="h-7 w-7 text-muted-foreground/40" />
              </div>
            )}

            {/* Status chip */}
            <span
              className="absolute left-2 top-2 inline-flex items-center gap-1.5 rounded-sm bg-background/85 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] backdrop-blur-sm"
              style={{ color: `hsl(${led})` }}
            >
              <span className={cn("aura-led", isWorking && "aura-led-pulse")} style={{ "--led": led } as CSSProperties} />
              {statusLabel(gallery.status)}
            </span>

            {/* Actions */}
            <div className="absolute right-2 top-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
              <ActionsMenu
                onEdit={onEdit}
                onShare={onShare}
                onDelete={onDelete}
                className="bg-background/80 backdrop-blur-sm"
              />
            </div>

            {/* Processing progress bar */}
            {isWorking && (
              <div className="absolute inset-x-0 bottom-0 h-1 bg-black/40">
                <div
                  className="h-full"
                  style={{ width: `${progress}%`, background: "hsl(var(--rating))" }}
                />
              </div>
            )}
          </div>

          {/* Meta footer */}
          <div className="p-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-sm font-medium tracking-tight text-foreground transition-colors group-hover:text-[hsl(var(--dynamic-primary))]">
                {gallery.name}
              </p>
              {isWorking && (
                <span className="shrink-0 font-mono text-[11px] text-[hsl(var(--rating))]">{progress}%</span>
              )}
            </div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] text-muted-foreground">
                {(gallery.total_images || 0).toLocaleString()} images
              </span>
              <span className="font-mono text-[10px] text-muted-foreground/70">
                {new Date(gallery.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

/** Catalog row — a pro list line: thumbnail, name, mono count, status dot, actions. */
function GalleryRow({ gallery, onDelete, onEdit, onShare }: GalleryItemProps) {
  const isReady = gallery.status === "ready";
  const isError = gallery.status === "error";
  const isWorking = !isReady && !isError;
  const progress = gallery.total_images > 0 ? Math.round((gallery.processed_images / gallery.total_images) * 100) : 0;
  const led = statusLed(gallery.status);

  const thumb = gallery.hero_image_url ? getThumbnailUrl(gallery.hero_image_url) : null;
  // Each row carries a thin accent keyline from its hero image's hue.
  const dynamic = useDominantColor(thumb);

  return (
    <li>
      <Link
        to={`/dashboard/galleries/${gallery.id}`}
        style={dynamicVars(dynamic)}
        className="group relative flex items-center gap-4 px-4 py-3 transition-colors hover:bg-foreground/[0.03]"
      >
        {/* Per-row accent keyline (appears on hover) */}
        <span className="pointer-events-none absolute inset-y-0 left-0 w-[2px] bg-[hsl(var(--dynamic-primary))] opacity-0 transition-opacity duration-150 group-hover:opacity-100" />

        <div className="h-12 w-16 shrink-0 overflow-hidden rounded-sm bg-muted plate-keyline">
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
            <p className="truncate text-base font-medium tracking-tight transition-colors group-hover:text-[hsl(var(--dynamic-primary))]">
              {gallery.name}
            </p>
          </div>
          <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
            {(gallery.total_images || 0).toLocaleString()} images · {new Date(gallery.created_at).toLocaleDateString()}
          </p>
        </div>

        {isWorking && (
          <div className="hidden w-40 sm:block">
            <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full"
                style={{ width: `${progress}%`, background: "hsl(var(--rating))" }}
              />
            </div>
          </div>
        )}
        {isWorking && (
          <span className="w-12 text-right font-mono text-sm text-[hsl(var(--rating))]">{progress}%</span>
        )}

        <ActionsMenu onEdit={onEdit} onShare={onShare} onDelete={onDelete} />
      </Link>
    </li>
  );
}
