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
import { Orb } from "@/components/aura/Orb";

type ViewMode = "grid" | "list";
type StatusFilter = "all" | "working" | "ready" | "error";

const WORKING_STATUSES = ["uploading", "processing", "culling", "transferring"];

const statusLed = (status: string) =>
  status === "ready" ? "var(--secondary)" : status === "error" ? "var(--destructive)" : "var(--rating)";

const statusLabel = (status: string) =>
  status === "ready" ? "Ready" : status === "error" ? "Error" : "Processing";

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
      <div className="relative w-full space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
          className="flex flex-wrap items-end justify-between gap-4"
        >
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Collections</h1>
            <p className="mt-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {counts.all} collections · {totalImages.toLocaleString()} images
            </p>
          </div>
          <Button variant="glow" asChild>
            <Link to="/dashboard/galleries/new" className="gap-2">
              <Plus className="h-4 w-4" />
              New collection
            </Link>
          </Button>
        </motion.div>

        {/* Toolbar: search + status chips + view toggle */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06, duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
          className="flex flex-col gap-3 lg:flex-row lg:items-center"
        >
          <div className="flex flex-1 items-center gap-2 rounded-full border border-border/70 bg-card/50 px-4 py-2 backdrop-blur-md transition-[border-color,box-shadow] duration-150 focus-within:border-primary/60 focus-within:shadow-[0_0_24px_-10px_hsl(var(--glow-primary)/0.6)]">
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
            {filterChips.map((chip) => {
              const active = statusFilter === chip.key;
              return (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => setStatusFilter(chip.key)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] transition-[border-color,color,background-color] duration-150",
                    active
                      ? "border-primary/60 bg-primary/10 text-foreground"
                      : "border-border/70 bg-card/40 text-muted-foreground hover:border-primary/40 hover:text-foreground",
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

            <div className="ml-auto flex items-center gap-1 rounded-full border border-border/70 bg-card/40 p-1 lg:ml-2">
              <button
                type="button"
                aria-label="Grid view"
                onClick={() => setViewMode("grid")}
                className={cn(
                  "grid h-8 w-8 place-items-center rounded-full transition-colors",
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
                  "grid h-8 w-8 place-items-center rounded-full transition-colors",
                  viewMode === "list" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Grid / list */}
        {viewMode === "grid" ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {filteredGalleries.map((gallery) => (
              <GalleryCard
                key={gallery.id}
                gallery={gallery}
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
        )}

        {/* Empty state */}
        {filteredGalleries.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-20 text-center">
            <Orb className="mx-auto h-14 w-14" />
            <h3 className="mt-6 font-display text-lg font-semibold">
              {searchQuery || statusFilter !== "all" ? "Nothing matches" : "No collections yet"}
            </h3>
            <p className="mt-1.5 text-sm text-muted-foreground">
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

function GalleryCard({ gallery, onDelete, onEdit, onShare }: GalleryItemProps) {
  const isReady = gallery.status === "ready";
  const isError = gallery.status === "error";
  const isWorking = !isReady && !isError;
  const progress = gallery.total_images > 0 ? Math.round((gallery.processed_images / gallery.total_images) * 100) : 0;
  const led = statusLed(gallery.status);

  return (
    <Link to={`/dashboard/galleries/${gallery.id}`} className="group block">
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/55 backdrop-blur-xl transition-[transform,border-color,box-shadow] duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-1 hover:border-primary/50 hover:shadow-[0_0_44px_-12px_hsl(var(--glow-primary)/0.4)]">
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          {gallery.hero_image_url ? (
            <img
              src={getThumbnailUrl(gallery.hero_image_url)}
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
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/10 to-transparent" />

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

          {isWorking && (
            <div className="absolute inset-x-0 bottom-0 h-1 bg-background/40">
              <div
                className="h-full bg-[image:var(--gradient-primary)] shadow-[0_0_10px_hsl(var(--glow-primary)/0.6)]"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>

        <div className="space-y-1 px-4 py-3.5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="truncate text-sm font-medium transition-colors group-hover:text-primary">{gallery.name}</h3>
            <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
              {(gallery.total_images || 0).toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-xs text-muted-foreground">
              {gallery.description || new Date(gallery.created_at).toLocaleDateString()}
            </p>
            {isWorking && <span className="shrink-0 font-mono text-[11px] text-primary">{progress}%</span>}
          </div>
        </div>
      </div>
    </Link>
  );
}

function GalleryRow({ gallery, last, onDelete, onEdit, onShare }: GalleryItemProps & { last: boolean }) {
  const isReady = gallery.status === "ready";
  const isError = gallery.status === "error";
  const isWorking = !isReady && !isError;
  const progress = gallery.total_images > 0 ? Math.round((gallery.processed_images / gallery.total_images) * 100) : 0;
  const led = statusLed(gallery.status);

  return (
    <Link
      to={`/dashboard/galleries/${gallery.id}`}
      className={cn(
        "group flex items-center gap-4 px-4 py-3 transition-colors hover:bg-foreground/[0.03]",
        !last && "border-b border-border/40",
      )}
    >
      <div className="h-12 w-[72px] shrink-0 overflow-hidden rounded-xl bg-muted">
        {gallery.hero_image_url ? (
          <img
            src={getThumbnailUrl(gallery.hero_image_url)}
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
          <h3 className="truncate text-sm font-medium transition-colors group-hover:text-primary">{gallery.name}</h3>
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
