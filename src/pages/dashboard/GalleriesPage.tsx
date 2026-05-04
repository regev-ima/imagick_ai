import { useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import {
  Plus,
  Search,
  Filter,
  Grid3X3,
  List,
  MoreHorizontal,
  Images,
  Calendar,
  ExternalLink,
  Trash2,
  Edit3,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

type ViewMode = "grid" | "list";

const statusConfig: Record<string, { label: string; className: string }> = {
  uploading: { label: "Uploading", className: "bg-accent text-accent-foreground" },
  processing: { label: "Processing", className: "bg-secondary text-secondary-foreground" },
  culling: { label: "AI Culling", className: "bg-secondary text-secondary-foreground" },
  ready: { label: "Ready", className: "bg-primary text-primary-foreground" },
  error: { label: "Error", className: "bg-destructive text-destructive-foreground" }
};

export default function GalleriesPage() {
  const { effectiveUserId } = useEffectiveUser();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [searchQuery, setSearchQuery] = useState("");
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
    enabled: !!effectiveUserId
  });

  const deleteGallery = useMutation({
    mutationFn: async (galleryId: string) => {
      const { error } = await supabase
        .from("galleries")
        .delete()
        .eq("id", galleryId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["galleries"] });
      toast.success("Gallery deleted");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete gallery");
    }
  });

  const [showcaseDeleteOpen, setShowcaseDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const filteredGalleries = galleries.filter(gallery => {
    return gallery.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (gallery.description?.toLowerCase() || "").includes(searchQuery.toLowerCase());
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            My <span className="text-gradient-primary">Collections</span>
          </h1>
          <p className="text-muted-foreground mt-1.5">
            Manage and organize your photo galleries
          </p>
        </div>
        <Button variant="glow" asChild>
          <Link to="/dashboard/galleries/new" className="gap-2">
            <Plus className="w-4 h-4" />
            New Collection
          </Link>
        </Button>
      </motion.div>

      {/* Filters Bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col sm:flex-row gap-4"
      >
        {/* Search */}
        <div className="flex-1 flex items-center gap-2 px-4 py-2 rounded-xl bg-muted/50 border border-border/50">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search collections..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none outline-none text-sm flex-1 placeholder:text-muted-foreground"
          />
        </div>

        {/* Filter & View Toggle */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="w-4 h-4" />
            Filter
          </Button>
          <div className="flex items-center rounded-lg border border-border/50 p-1">
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="icon"
              className="w-8 h-8"
              onClick={() => setViewMode("grid")}
            >
              <Grid3X3 className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon"
              className="w-8 h-8"
              onClick={() => setViewMode("list")}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Gallery Grid/List */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {filteredGalleries.map((gallery, index) => (
            <GalleryCard
              key={gallery.id}
              gallery={gallery}
              index={index}
              onEdit={() => navigate(`/dashboard/galleries/${gallery.id}`)}
              onShare={() => {
                navigator.clipboard.writeText(`${window.location.origin}/gallery/${gallery.id}`);
                toast.success("Gallery link copied!");
              }}
              onDelete={() => {
                if (gallery.id === SHOWCASE_GALLERY_ID) {
                  setShowcaseDeleteOpen(true);
                } else {
                  setDeleteTarget({ id: gallery.id, name: gallery.name });
                }
              }}
          />
        ))}
      </div>
    ) : (
      <div className="space-y-3">
        {filteredGalleries.map((gallery, index) => (
          <GalleryListItem
            key={gallery.id}
            gallery={gallery}
            index={index}
            onEdit={() => navigate(`/dashboard/galleries/${gallery.id}`)}
            onShare={() => {
              navigator.clipboard.writeText(`${window.location.origin}/gallery/${gallery.id}`);
              toast.success("Gallery link copied!");
            }}
            onDelete={() => {
              if (gallery.id === SHOWCASE_GALLERY_ID) {
                setShowcaseDeleteOpen(true);
              } else {
                setDeleteTarget({ id: gallery.id, name: gallery.name });
              }
            }}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {filteredGalleries.length === 0 && !isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-16"
        >
          <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
            <Images className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No collections found</h3>
          <p className="text-muted-foreground mb-6">
            {searchQuery ? "Try a different search term" : "Create your first collection to get started"}
          </p>
          {!searchQuery && (
            <Button variant="glow" asChild>
              <Link to="/dashboard/galleries/new" className="gap-2">
                <Plus className="w-4 h-4" />
                Create Collection
              </Link>
            </Button>
          )}
        </motion.div>
      )}

      {/* Delete Confirmation */}
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

      {/* Showcase Gallery Delete Warning */}
      <AlertDialog open={showcaseDeleteOpen} onOpenChange={setShowcaseDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ Warning: Showcase Gallery</AlertDialogTitle>
            <AlertDialogDescription>
              This gallery serves as the image source for all style Before/After previews (Showcase). 
              Deleting it will break the Before/After display for all styles. Are you sure you want to proceed?
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
  );
}

interface GalleryCardProps {
  gallery: any;
  index: number;
  onDelete: () => void;
  onEdit: () => void;
  onShare: () => void;
}

function GalleryCard({ gallery, index, onDelete, onEdit, onShare }: GalleryCardProps) {
  const isReady = gallery.status === "ready";
  const isError = gallery.status === "error";
  const isProcessing = gallery.status !== "ready" && gallery.status !== "error";
  const progress = gallery.total_images > 0
    ? (gallery.processed_images / gallery.total_images) * 100
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Link to={`/dashboard/galleries/${gallery.id}`}>
        <Card className={cn(
          "relative border-border/40 hover:border-primary/40 transition-all duration-300 group overflow-hidden rounded-2xl bg-card/80 backdrop-blur-sm",
          "hover:shadow-lg hover:shadow-primary/5",
          isReady && "ring-1 ring-emerald-500/10",
        )}>
          {/* Image area */}
          <div className="relative aspect-video overflow-hidden bg-muted">
            {gallery.hero_image_url ? (
              <img
                src={getThumbnailUrl(gallery.hero_image_url)}
                alt={gallery.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                onError={(e) => {
                  const target = e.currentTarget;
                  if (target.src !== gallery.hero_image_url) {
                    target.src = gallery.hero_image_url;
                  }
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Images className="w-10 h-10 text-muted-foreground/40" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent opacity-80" />

            {/* Menu — top-right on hover */}
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="glass" size="icon" className="w-8 h-8 bg-black/30 backdrop-blur-md border border-white/10" onClick={(e) => e.preventDefault()}>
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={(e) => { e.preventDefault(); onEdit(); }}>
                    <Edit3 className="w-4 h-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => { e.preventDefault(); onShare(); }}>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Share Link
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={(e) => {
                      e.preventDefault();
                      onDelete();
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Processing progress bar — bottom of image */}
            {isProcessing && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20">
                <motion.div
                  className="h-full bg-gradient-to-r from-amber-500 to-primary"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5, delay: index * 0.05 }}
                />
              </div>
            )}
          </div>

          {/* Card body */}
          <CardContent className="p-3 space-y-1">
            {/* Row 1: Status dot + Name */}
            <div className="flex items-center gap-2">
              <span className={cn(
                "w-2 h-2 rounded-full shrink-0",
                isReady && "bg-emerald-500",
                isError && "bg-red-500",
                isProcessing && "bg-amber-500 animate-pulse",
              )} />
              <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                {gallery.name}
              </h3>
            </div>

            {/* Row 2: Description */}
            <p className="text-xs text-muted-foreground truncate">
              {gallery.description || "No description"}
            </p>

            {/* Row 3: Stats inline */}
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground/70 pt-0.5">
              <span className="flex items-center gap-1">
                <Images className="w-3 h-3" />
                {gallery.total_images}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(gallery.created_at).toLocaleDateString()}
              </span>
              {isProcessing && (
                <span className="ml-auto text-amber-500 font-medium">
                  {Math.round(progress)}%
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}

function GalleryListItem({ gallery, index, onDelete, onEdit, onShare }: GalleryCardProps) {
  const isReady = gallery.status === "ready";
  const isError = gallery.status === "error";
  const isProcessing = gallery.status !== "ready" && gallery.status !== "error";
  const progress = gallery.total_images > 0
    ? (gallery.processed_images / gallery.total_images) * 100
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Link to={`/dashboard/galleries/${gallery.id}`}>
        <Card className={cn(
          "relative border-border/40 hover:border-primary/40 transition-all duration-300 group overflow-hidden rounded-xl bg-card/80 backdrop-blur-sm",
          "hover:shadow-lg hover:shadow-primary/5",
          isReady && "ring-1 ring-emerald-500/10",
        )}>
          <CardContent className="p-0">
            <div className="flex items-center gap-3">
              {/* Thumbnail */}
              <div className="relative w-28 h-20 flex-shrink-0 overflow-hidden rounded-l-xl bg-muted">
                {gallery.hero_image_url ? (
                  <img
                    src={getThumbnailUrl(gallery.hero_image_url)}
                    alt={gallery.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => {
                      const target = e.currentTarget;
                      if (target.src !== gallery.hero_image_url) {
                        target.src = gallery.hero_image_url;
                      }
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Images className="w-6 h-6 text-muted-foreground/40" />
                  </div>
                )}
                {/* Processing progress bar */}
                {isProcessing && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black/20">
                    <motion.div
                      className="h-full bg-gradient-to-r from-amber-500 to-primary"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 py-2.5 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "w-2 h-2 rounded-full shrink-0",
                    isReady && "bg-emerald-500",
                    isError && "bg-red-500",
                    isProcessing && "bg-amber-500 animate-pulse",
                  )} />
                  <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                    {gallery.name}
                  </h3>
                </div>
                <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground/70">
                  <span className="flex items-center gap-1">
                    <Images className="w-3 h-3" />
                    {gallery.total_images}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(gallery.created_at).toLocaleDateString()}
                  </span>
                  {isProcessing && (
                    <span className="text-amber-500 font-medium">{Math.round(progress)}%</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="pr-3">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="w-8 h-8" onClick={(e) => e.preventDefault()}>
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={(e) => { e.preventDefault(); onEdit(); }}>
                      <Edit3 className="w-4 h-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => { e.preventDefault(); onShare(); }}>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Share Link
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={(e) => {
                        e.preventDefault();
                        onDelete();
                      }}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}
