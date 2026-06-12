import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Search,
  Sparkles,
  Lock,
  Globe,
  Loader2,
  Eye,
  Image as ImageIcon,
  BrainCircuit,
  Rocket,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import heroImage1 from "@/assets/hero-gallery-1.jpg";
import { Link, useNavigate } from "react-router-dom";
import { getPreviewUrl } from "@/lib/imageUrls";
import { useShowcaseCovers } from "@/hooks/useShowcaseCovers";

type StyleStatus = "importing" | "training" | "ready" | "error" | "deleted";
type StyleVisibility = "private" | "public";

interface AIStyle {
  id: string;
  name: string;
  description: string | null;
  status: string;
  visibility: string;
  is_preset: boolean;
  thumbnail_url: string | null;
  category: string | null;
  user_id: string;
  associated_tags?: string[] | null;
  after_image_urls?: string[] | null;
}

const statusConfig: Record<StyleStatus, { label: string; className: string }> = {
  importing: { label: "Importing", className: "bg-accent/10 text-accent" },
  training: { label: "Training", className: "bg-secondary/10 text-secondary" },
  ready: { label: "Ready", className: "bg-primary/10 text-primary" },
  error: { label: "Error", className: "bg-destructive/10 text-destructive" },
  deleted: { label: "Deleted", className: "bg-muted text-muted-foreground" }
};

export default function StylesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "public" | "yours">("all");

  // Fetch styles from database with explicit user filtering for defense-in-depth
  // RLS already filters, but we add explicit filter as extra security layer
  // Exclude deleted styles from view

  const { data: styles = [], isLoading } = useQuery({
    queryKey: ["styles", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from("styles")
        .select("*")
        .or(`user_id.eq.${user.id},is_preset.eq.true,visibility.eq.public`)
        .neq("status", "deleted")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as AIStyle[];
    },
    enabled: !!user?.id
  });

  const { data: showcaseCovers = {} } = useShowcaseCovers();

  const handleViewStyle = (styleId: string) => {
    navigate(`/dashboard/styles/${styleId}`);
  };

   const handleCreateGallery = (styleId: string) => {
     navigate(`/dashboard/galleries/new?styleId=${styleId}`);
   };

  const filteredStyles = styles.filter(style => {
    const matchesSearch = style.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (style.description || "").toLowerCase().includes(searchQuery.toLowerCase());
    const isPublicStyle = style.is_preset || (style.visibility === "public" && style.user_id !== user?.id);
    const isOwnStyle = !style.is_preset && style.user_id === user?.id;
    const matchesFilter = filter === "all" ||
      (filter === "public" && isPublicStyle) ||
      (filter === "yours" && isOwnStyle);
    return matchesSearch && matchesFilter;
  });

  const presetStyles = filteredStyles.filter(s => s.is_preset || (s.visibility === "public" && s.user_id !== user?.id));
  const customStyles = filteredStyles.filter(s => !s.is_preset && s.user_id === user?.id);

  // Counts for filter labels (from unfiltered styles)
  const publicCount = styles.filter(s => s.is_preset || (s.visibility === "public" && s.user_id !== user?.id)).length;
  const yourCount = styles.filter(s => !s.is_preset && s.user_id === user?.id).length;

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Hero Header — AI Model Studio */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            AI Model <span className="text-gradient-primary">Studio</span>
          </h1>
          <p className="text-muted-foreground mt-1.5">
            Your AI editing models — trained, curated, ready to transform
          </p>
        </div>
        <Button variant="glow" className="gap-2" asChild>
          <Link to="/dashboard/styles/new">
            <Plus className="w-4 h-4" />
            Train New Style
          </Link>
        </Button>
      </motion.div>

      {/* Marketplace Banner — Coming Soon */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/15 via-violet-500/10 to-primary/5 border border-primary/20 p-5 sm:p-6">
          <div className="flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-base">Style Marketplace</h3>
                <Badge variant="secondary" className="text-[10px] uppercase tracking-wider font-semibold">
                  Coming Soon
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                Share your custom styles with the community and earn from every use. Train once, earn forever.
              </p>
            </div>
            <Rocket className="w-8 h-8 text-primary/30 shrink-0 hidden sm:block" />
          </div>
        </div>
      </motion.div>

      {/* Search & Filter */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col sm:flex-row gap-4"
      >
        <div className="flex-1 flex items-center gap-2 px-4 py-2 rounded-xl bg-muted/50 border border-border/50">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search styles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none outline-none text-sm flex-1 placeholder:text-muted-foreground"
          />
        </div>

        <div className="flex items-center rounded-lg border border-border/50 p-1">
          {([
            { value: "all", label: "All", count: styles.length },
            { value: "public", label: "Public Styles", count: publicCount },
            { value: "yours", label: "Your Styles", count: yourCount },
          ] as const).map((f) => (
            <Button
              key={f.value}
              variant={filter === f.value ? "default" : "ghost"}
              size="sm"
              className={cn(
                filter === f.value && "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
              onClick={() => setFilter(f.value as any)}
            >
              {f.label}
              <span className={cn(
                "ml-1.5 text-[10px] font-semibold tabular-nums",
                filter === f.value ? "opacity-80" : "text-muted-foreground"
              )}>
                ({f.count})
              </span>
            </Button>
          ))}
        </div>
      </motion.div>

      {/* Custom Styles Section */}
      {customStyles.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Lock className="w-4 h-4 text-primary" />
            </div>
            <h2 className="text-xl font-semibold">Your Custom Styles</h2>
            <Badge variant="secondary" className="text-xs tabular-nums">
              {customStyles.length}
            </Badge>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {customStyles.map((style, index) => (
              <StyleCard
                key={style.id}
                style={style}
                coverUrl={showcaseCovers[style.id]}
                index={index}
                onView={handleViewStyle}
                 onCreateGallery={handleCreateGallery}
              />
            ))}
          </div>
        </div>
      )}

      {/* Preset Styles Section */}
      {presetStyles.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Globe className="w-4 h-4 text-primary" />
            </div>
            <h2 className="text-xl font-semibold">Public Styles</h2>
            <Badge variant="secondary" className="text-xs tabular-nums">
              {presetStyles.length}
            </Badge>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {presetStyles.map((style, index) => (
              <StyleCard
                key={style.id}
                style={style}
                coverUrl={showcaseCovers[style.id]}
                index={index + customStyles.length}
                onView={handleViewStyle}
                 onCreateGallery={handleCreateGallery}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {filteredStyles.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-20"
        >
          <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-primary/10 to-violet-500/10 border border-primary/10 flex items-center justify-center mb-5">
            <BrainCircuit className="w-9 h-9 text-primary/60" />
          </div>
          <h3 className="text-lg font-semibold mb-2">
            {searchQuery ? "No models match your search" : "No AI models yet"}
          </h3>
          <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
            {searchQuery
              ? "Try a different search term or adjust your filters"
              : "Train your first custom AI style model and start transforming images with your unique aesthetic"}
          </p>
          {!searchQuery && (
            <Button variant="glow" className="gap-2" asChild>
              <Link to="/dashboard/styles/new">
                <Plus className="w-4 h-4" />
                Train New Style
              </Link>
            </Button>
          )}
        </motion.div>
      )}
    </div>
  );
}

interface StyleCardProps {
  style: AIStyle;
  coverUrl?: string;
  index: number;
  onView: (styleId: string) => void;
   onCreateGallery: (styleId: string) => void;
}

 function StyleCard({ style, coverUrl, index, onView, onCreateGallery }: StyleCardProps) {
  const [imgError, setImgError] = useState(false);
  const firstAfter = coverUrl || style.after_image_urls?.[0];
  const imgSrc = firstAfter ? getPreviewUrl(firstAfter) : (style.thumbnail_url ? getPreviewUrl(style.thumbnail_url) : heroImage1);
  const isReady = style.status === "ready";
  const isError = style.status === "error";
  const isTraining = style.status === "training" || style.status === "importing";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card className={cn(
        "relative border-border/40 hover:border-primary/40 transition-all duration-300 group overflow-hidden rounded-2xl bg-card/80 backdrop-blur-sm",
        "hover:shadow-lg hover:shadow-primary/5",
        isReady && "ring-1 ring-emerald-500/10",
      )}>
        {/* Image area */}
        <div
          className="relative aspect-video overflow-hidden cursor-pointer"
          onClick={() => onView(style.id)}
        >
          {imgError ? (
            <div className="w-full h-full bg-gradient-to-br from-muted to-muted/60 flex items-center justify-center">
              <div className="w-14 h-14 rounded-2xl bg-background/60 flex items-center justify-center">
                <ImageIcon className="w-7 h-7 text-muted-foreground/60" />
              </div>
            </div>
          ) : (
            <img
              src={imgSrc}
              alt={style.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
              onError={() => setImgError(true)}
            />
          )}
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent opacity-80" />

          {/* Action buttons — top-right on hover */}
          <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button
              className="w-8 h-8 rounded-lg bg-black/30 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onView(style.id);
              }}
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
            <button
              className="w-8 h-8 rounded-lg bg-black/30 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onCreateGallery(style.id);
              }}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Card body */}
        <CardContent className="p-3 space-y-1">
          {/* Row 1: Status dot + Name */}
          <div className="flex items-center gap-2">
            <span className={cn(
              "w-2 h-2 rounded-full shrink-0",
              isReady && "bg-emerald-500",
              isError && "bg-red-500",
              isTraining && "bg-amber-500 animate-pulse",
              !isReady && !isError && !isTraining && "bg-muted-foreground/40",
            )} />
            <h3
              className="font-semibold text-sm truncate group-hover:text-primary transition-colors cursor-pointer"
              onClick={() => onView(style.id)}
            >
              {style.name}
            </h3>
          </div>

          {/* Row 2: Description */}
          <p className="text-xs text-muted-foreground truncate">
            {style.description || "No description"}
          </p>

          {/* Row 3: Category badge */}
          {style.category && (
            <div className="pt-0.5">
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-muted text-muted-foreground capitalize">
                {style.category}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
