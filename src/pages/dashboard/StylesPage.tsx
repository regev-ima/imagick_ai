import { useState, type CSSProperties, type ReactNode } from "react";
import { motion } from "framer-motion";
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
import { Orb } from "@/components/aura/Orb";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import heroImage1 from "@/assets/hero-gallery-1.jpg";
import { useNavigate } from "react-router-dom";
import { getPreviewUrl } from "@/lib/imageUrls";
import { useShowcaseCovers } from "@/hooks/useShowcaseCovers";
import { useStyleQuota } from "@/hooks/useStyleQuota";
import { toast } from "sonner";

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

// LIGHTROOM motion — calm, responsive fades/slides. No bounce, no float.
const EASE: [number, number, number, number] = [0.22, 0.61, 0.36, 1];
const deck = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const rise = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};

/**
 * The AI mark — a 4-point sparkle (the logo star). Royal blue by default.
 * Copied from the approved Lightroom dashboard reference; tinted via
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
  return (
    <div className={cn("glass-card overflow-hidden rounded-[--radius]", className)}>{children}</div>
  );
}

/** Mono section header — like a Lightroom module title bar. */
function PanelHeader({
  icon,
  label,
  trailing,
  tone = "muted",
}: {
  icon?: ReactNode;
  label: string;
  trailing?: ReactNode;
  tone?: "muted" | "ai";
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 border-b border-border px-4 py-2.5",
        tone === "ai" ? "bg-primary/[0.08] text-accent" : "bg-background/40 text-muted-foreground",
      )}
    >
      <span className="aura-microlabel flex items-center gap-2" style={tone === "ai" ? { color: "inherit" } : undefined}>
        {icon}
        {label}
      </span>
      {trailing}
    </div>
  );
}

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

  // Custom-model quota — gates the "Train New Style" entry points so users
  // see their limit before landing on a form they can't submit.
  const { canCreate: canCreateStyle, used: modelsUsed, limit: modelLimit, isUnlimited, isLoading: quotaLoading } = useStyleQuota();

  const goCreateStyle = () => {
    // While the quota is still resolving, let the create page (and the DB
    // trigger) be the gate rather than blocking on a not-yet-known limit.
    if (!quotaLoading && !canCreateStyle) {
      toast.error("You've reached your plan's custom model limit.", {
        description:
          modelLimit <= 0
            ? "Custom model training isn't included on your plan. Upgrade to train your own look."
            : `You're using ${modelsUsed} of ${modelLimit}. Upgrade or remove a model to train a new one.`,
        action: { label: "View plans", onClick: () => navigate("/dashboard/billing") },
      });
      return;
    }
    navigate("/dashboard/styles/new");
  };

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
      <div className="flex min-h-[400px] items-center justify-center bg-background p-6 lg:p-8">
        <Orb className="h-12 w-12" />
      </div>
    );
  }

  return (
    <div className="relative min-h-full bg-background px-5 py-7 lg:px-10 lg:py-10">
      <motion.div
        variants={deck}
        initial="hidden"
        animate="show"
        className="relative mx-auto w-full max-w-[1320px]"
      >
        {/* ════ MASTHEAD — AI Model Studio ═══════════════════════════════ */}
        <motion.header variants={rise}>
          <div className="flex items-center justify-between gap-4 pb-3">
            <span className="caption flex items-center gap-1.5 text-accent">
              <Sparkle size={11} className="text-accent" />
              AI Model Studio
            </span>
            <span className="caption flex items-center gap-1.5">
              <span className="aura-led" style={{ "--led": "var(--primary)" } as CSSProperties} />
              {styles.length} {styles.length === 1 ? "model" : "models"}
            </span>
          </div>
          <hr className="aura-hairline" />
          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-4xl">
                AI Model <span className="text-accent">Studio</span>
              </h1>
              <p className="mt-2 max-w-lg font-sans text-base leading-relaxed text-muted-foreground">
                Your AI editing models — trained, curated, ready to transform.
              </p>
            </div>
            <div className="flex flex-col items-start gap-1.5 sm:items-end">
              <Button variant="glow" className="gap-2" onClick={goCreateStyle}>
                <Plus className="w-4 h-4" />
                Train New Style
              </Button>
              {!quotaLoading && !isUnlimited && (
                <span className="aura-microlabel text-muted-foreground">
                  {modelsUsed} / {modelLimit} custom {modelLimit === 1 ? "model" : "models"}
                </span>
              )}
            </div>
          </div>
        </motion.header>

        {/* ════ MARKETPLACE — Coming Soon (AI panel) ═════════════════════ */}
        <motion.section variants={rise} className="mt-7">
          <Panel className="border-primary/25">
            <div className="relative flex items-center gap-4 bg-primary/[0.06] p-5 sm:p-6">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[--radius] border border-primary/30 bg-background">
                <Rocket className="h-5 w-5 text-accent" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold tracking-tight">Style Marketplace</h3>
                  <span className="aura-chip" style={{ color: "hsl(var(--accent))" }}>
                    Coming Soon
                  </span>
                </div>
                <p className="mt-1 font-sans text-sm leading-relaxed text-muted-foreground">
                  Share your custom styles with the community and earn from every use. Train once, earn forever.
                </p>
              </div>
            </div>
          </Panel>
        </motion.section>

        {/* ════ SEARCH & FILTER — instrument bar ═════════════════════════ */}
        <motion.section variants={rise} className="mt-6 flex flex-col gap-3 sm:flex-row">
          <div className="flex flex-1 items-center gap-2.5 rounded-[--radius] border border-border bg-card px-3.5 py-2.5 transition-colors duration-200 focus-within:border-primary/60">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search styles…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="min-w-0 flex-1 border-none bg-transparent font-sans text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>

          <div className="flex items-center rounded-[--radius] border border-border bg-card p-1">
            {([
              { value: "all", label: "All", count: styles.length },
              { value: "public", label: "Public", count: publicCount },
              { value: "yours", label: "Yours", count: yourCount },
            ] as const).map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value as any)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-[calc(var(--radius)-2px)] px-3 py-1.5 font-sans text-sm font-medium transition-colors",
                  filter === f.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {f.label}
                <span className={cn(
                  "font-mono text-[10px] font-semibold tabular-nums",
                  filter === f.value ? "opacity-80" : "text-muted-foreground/80",
                )}>
                  {f.count}
                </span>
              </button>
            ))}
          </div>
        </motion.section>

        {/* ════ CUSTOM STYLES — your trained models ══════════════════════ */}
        {customStyles.length > 0 && (
          <motion.section variants={rise} className="mt-6">
            <Panel>
              <PanelHeader
                tone="ai"
                icon={<Lock className="h-3.5 w-3.5" />}
                label="Your Custom Styles"
                trailing={
                  <span className="caption flex items-center gap-1.5" style={{ color: "inherit" }}>
                    <Sparkle size={11} className="text-accent" />
                    {customStyles.length} trained
                  </span>
                }
              />
              <div className="grid grid-cols-1 gap-px overflow-hidden bg-border sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
            </Panel>
          </motion.section>
        )}

        {/* ════ PUBLIC STYLES — community looks ══════════════════════════ */}
        {presetStyles.length > 0 && (
          <motion.section variants={rise} className="mt-6">
            <Panel>
              <PanelHeader
                icon={<Globe className="h-3.5 w-3.5" />}
                label="Public Styles"
                trailing={<span className="caption">{presetStyles.length} looks</span>}
              />
              <div className="grid grid-cols-1 gap-px overflow-hidden bg-border sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
            </Panel>
          </motion.section>
        )}

        {/* ════ EMPTY STATE — a pro "train to begin" panel ═══════════════ */}
        {filteredStyles.length === 0 && (
          <motion.section variants={rise} className="mt-6">
            <Panel>
              <PanelHeader
                tone="ai"
                icon={<Sparkle size={12} className="text-accent" />}
                label="Model catalog — empty"
              />
              <div className="p-6 sm:p-10 text-center">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-[--radius] border border-primary/30 bg-primary/[0.06]">
                  <BrainCircuit className="h-8 w-8 text-accent" />
                </div>
                <h3 className="mt-5 text-2xl font-semibold tracking-tight">
                  {searchQuery ? "No models match your search" : "No AI models yet"}
                </h3>
                <p className="mx-auto mt-3 max-w-sm font-sans text-base leading-relaxed text-muted-foreground">
                  {searchQuery
                    ? "Try a different search term or adjust your filters."
                    : "Train your first custom AI style model and start transforming images with your unique aesthetic."}
                </p>
                {!searchQuery && (
                  <Button variant="glow" className="mt-7 gap-2" onClick={goCreateStyle}>
                    <Plus className="w-4 h-4" />
                    Train New Style
                  </Button>
                )}
              </div>
            </Panel>
          </motion.section>
        )}
      </motion.div>
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
  const statusToken = isReady
    ? "var(--secondary)"
    : isError
      ? "var(--destructive)"
      : isTraining
        ? "var(--rating)"
        : "var(--muted-foreground)";
  const statusLabel = isReady ? "Ready" : isError ? "Error" : isTraining ? "Training" : "Idle";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.5, ease: EASE }}
      className="group relative bg-card transition-colors hover:bg-foreground/[0.02]"
    >
      {/* Plate — keyline preview cell */}
      <div
        className="relative aspect-video cursor-pointer overflow-hidden bg-muted plate-keyline"
        onClick={() => onView(style.id)}
      >
        {imgError ? (
          <div className="grid h-full w-full place-items-center bg-muted">
            <ImageIcon className="h-7 w-7 text-muted-foreground/50" />
          </div>
        ) : (
          <img
            src={imgSrc}
            alt={style.name}
            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
            onError={() => setImgError(true)}
          />
        )}
        {/* Bottom legibility scrim */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-card/80 via-transparent to-transparent" />

        {/* AI-ready keyline accent */}
        {isReady && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-sm bg-background/85 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide text-accent backdrop-blur-sm">
            <Sparkle size={9} className="text-accent" />
            AI
          </span>
        )}

        {/* Action buttons — top-right on hover */}
        <div className="absolute right-2 top-2 flex gap-1.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <button
            className="grid h-8 w-8 place-items-center rounded-[--radius] border border-border bg-background/85 text-foreground/80 backdrop-blur-sm transition-colors hover:border-primary/50 hover:text-accent"
            onClick={(e) => {
              e.stopPropagation();
              onView(style.id);
            }}
            aria-label="View style"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          <button
            className="grid h-8 w-8 place-items-center rounded-[--radius] border border-border bg-background/85 text-foreground/80 backdrop-blur-sm transition-colors hover:border-primary/50 hover:text-accent"
            onClick={(e) => {
              e.stopPropagation();
              onCreateGallery(style.id);
            }}
            aria-label="Create gallery with this style"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Card body */}
      <div className="p-3">
        {/* Row 1: Status LED + Name */}
        <div className="flex items-center gap-2">
          <span
            className={cn("aura-led", isTraining && "aura-led-pulse")}
            style={{ "--led": statusToken } as CSSProperties}
          />
          <h3
            className="cursor-pointer truncate text-sm font-medium tracking-tight text-foreground transition-colors group-hover:text-accent"
            onClick={() => onView(style.id)}
          >
            {style.name}
          </h3>
        </div>

        {/* Row 2: Description */}
        <p className="mt-1 truncate font-sans text-xs text-muted-foreground">
          {style.description || "No description"}
        </p>

        {/* Row 3: mono meta — status + category */}
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="caption" style={{ color: `hsl(${statusToken})` }}>
            {statusLabel}
          </span>
          {style.category && (
            <span className="aura-chip capitalize">{style.category}</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
