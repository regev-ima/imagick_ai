import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  Sparkles,
  Heart,
  CheckCircle2,
  MinusCircle,
  PlusCircle,
  MessageSquare,
  StickyNote,
  ChevronDown,
  Users,
  Mail,
  Clock,
  ArrowLeftRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { getThumbnailUrl } from "@/lib/imageUrls";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

// ---------- Types ----------

type SummaryRow = {
  client_email: string | null;
  client_name: string | null;
  selected_count: number;
  total_notes: number;
  last_activity: string | null;
};

type Selection = {
  id: string;
  gallery_id: string;
  image_id: string;
  client_email: string | null;
  client_name: string | null;
  selected: boolean;
  note: string | null;
  created_at: string;
  updated_at: string;
};

type ImageRow = {
  id: string;
  filename: string;
  thumbnail_url: string | null;
  original_url: string | null;
  is_ai_suggested?: boolean | null;
};

const AI_SUGGESTED_EMAIL_TAG = "__ai_suggested__";

// Detect Hebrew (and Arabic) by Unicode range to RTL the note text.
function isRtlText(s: string | null | undefined) {
  if (!s) return false;
  // Hebrew block U+0590 – U+05FF, Arabic U+0600 – U+06FF
  return /[֐-ۿ]/.test(s);
}

function initials(name: string | null | undefined, email: string | null | undefined) {
  const src = name?.trim() || email?.trim() || "?";
  const parts = src.split(/[\s@.]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

// ---------- Page ----------

export default function GallerySelectionsPage() {
  const { id } = useParams<{ id: string }>();
  const [expandedClient, setExpandedClient] = useState<string | null>(null);

  // ----- Gallery meta -----
  const { data: gallery } = useQuery({
    queryKey: ["gallery-selections-meta", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("galleries")
        .select("id, name, total_images, selection_mode_enabled, selection_target_count" as any)
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!id,
  });

  // ----- Per-client summary -----
  const { data: summary = [], isLoading: summaryLoading } = useQuery<SummaryRow[]>({
    queryKey: ["gallery-selections-summary", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_gallery_selections_summary", {
        p_gallery_id: id!,
      });
      if (error) throw error;
      return (data || []) as SummaryRow[];
    },
    enabled: !!id,
  });

  // ----- All selections (used for compare + notes + inline expand) -----
  const { data: selections = [], isLoading: selectionsLoading } = useQuery<Selection[]>({
    queryKey: ["gallery-selections-rows", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("gallery_selections")
        .select("*")
        .eq("gallery_id", id!)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Selection[];
    },
    enabled: !!id,
  });

  // ----- AI-suggested images -----
  const { data: aiSuggested = [], isLoading: aiLoading } = useQuery<ImageRow[]>({
    queryKey: ["gallery-selections-ai", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("gallery_images")
        .select("id, filename, thumbnail_url, original_url, is_ai_suggested")
        .eq("gallery_id", id!)
        .eq("is_ai_suggested", true)
        .neq("status", "deleted");
      if (error) throw error;
      return (data || []) as ImageRow[];
    },
    enabled: !!id,
  });

  // ----- Image lookup for any image referenced in selections (for compare/notes thumbnails) -----
  const referencedImageIds = useMemo(() => {
    const set = new Set<string>();
    selections.forEach(s => set.add(s.image_id));
    aiSuggested.forEach(i => set.add(i.id));
    return Array.from(set);
  }, [selections, aiSuggested]);

  const { data: imagesById = {} } = useQuery<Record<string, ImageRow>>({
    queryKey: ["gallery-selections-images-map", id, referencedImageIds.length],
    queryFn: async () => {
      if (referencedImageIds.length === 0) return {};
      // Chunked SELECT in case there are many
      const CHUNK = 500;
      const all: ImageRow[] = [];
      for (let i = 0; i < referencedImageIds.length; i += CHUNK) {
        const chunk = referencedImageIds.slice(i, i + CHUNK);
        const { data, error } = await (supabase as any)
          .from("gallery_images")
          .select("id, filename, thumbnail_url, original_url, is_ai_suggested")
          .in("id", chunk);
        if (error) throw error;
        all.push(...((data || []) as ImageRow[]));
      }
      return Object.fromEntries(all.map(img => [img.id, img]));
    },
    enabled: !!id && referencedImageIds.length > 0,
  });

  // ----- Couple's choices (filter out AI's own suggestion row) -----
  const coupleSelections = useMemo(
    () =>
      selections.filter(
        s => s.selected && (s.client_email ?? "") !== AI_SUGGESTED_EMAIL_TAG,
      ),
    [selections],
  );

  const coupleImageIds = useMemo(() => {
    const set = new Set<string>();
    coupleSelections.forEach(s => set.add(s.image_id));
    return set;
  }, [coupleSelections]);

  const aiImageIds = useMemo(() => {
    const set = new Set<string>();
    aiSuggested.forEach(i => set.add(i.id));
    return set;
  }, [aiSuggested]);

  // ----- Overlap math -----
  const overlap = useMemo(() => {
    let kept = 0;
    let dropped = 0;
    aiImageIds.forEach(id => {
      if (coupleImageIds.has(id)) kept++;
      else dropped++;
    });
    let added = 0;
    coupleImageIds.forEach(id => {
      if (!aiImageIds.has(id)) added++;
    });
    return { kept, dropped, added };
  }, [aiImageIds, coupleImageIds]);

  // ----- Notes -----
  const notesRows = useMemo(
    () =>
      selections.filter(
        s =>
          s.note &&
          s.note.trim().length > 0 &&
          (s.client_email ?? "") !== AI_SUGGESTED_EMAIL_TAG,
      ),
    [selections],
  );

  // ----- Header counts -----
  const totalSelected = useMemo(() => {
    const set = new Set<string>();
    coupleSelections.forEach(s => set.add(s.image_id));
    return set.size;
  }, [coupleSelections]);

  const totalClients = summary.length;

  // ----- Export CSV (Lightroom-friendly filename list) -----
  function exportCsv() {
    const rows: string[] = ["filename,selected_by,note"];
    coupleSelections.forEach(s => {
      const img = imagesById[s.image_id];
      const fname = img?.filename ?? s.image_id;
      const by = s.client_name || s.client_email || "anonymous";
      const note = (s.note ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ");
      rows.push(`"${fname}","${by}","${note}"`);
    });
    const csv = rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(gallery?.name || "gallery").replace(/\s+/g, "_")}-selections.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  }

  return (
    <div className="relative min-h-screen pb-24">
      {/* Subtle backdrop — calmer than insights, photographer is here to commit. */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-48 right-0 w-[520px] h-[520px] rounded-full bg-[hsl(330_100%_60%/0.08)] blur-3xl" />
        <div className="absolute bottom-0 -left-32 w-[480px] h-[480px] rounded-full bg-[hsl(270_100%_65%/0.06)] blur-3xl" />
      </div>

      {/* Header */}
      <div className="px-6 lg:px-10 pt-8">
        <Link
          to={`/dashboard/galleries/${id}`}
          className="inline-flex items-center gap-2 text-xs font-medium tracking-wider uppercase text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span className="truncate max-w-[280px]">{gallery?.name || "Gallery"}</span>
        </Link>

        <div className="mt-4 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div>
            <p className="text-[11px] tracking-[0.3em] uppercase text-primary/80 font-semibold">
              Album Selection
            </p>
            <h1
              className="mt-2 text-4xl lg:text-5xl font-normal leading-[1.05] tracking-tight"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              <span className="text-gradient-primary">
                {totalSelected}
              </span>{" "}
              <span className="text-foreground/85">
                of {gallery?.selection_target_count ?? gallery?.total_images ?? "?"} photos
              </span>
              <span
                className="block mt-1 text-base lg:text-lg text-muted-foreground font-normal"
                style={{ fontFamily: "'Inter', sans-serif" }}
              >
                selected by {totalClients} client{totalClients === 1 ? "" : "s"} — ready to build
                the album.
              </span>
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={`/dashboard/galleries/${id}/insights`}
              className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1"
            >
              View insights <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Button onClick={exportCsv} variant="default" className="gap-2">
              <Download className="w-4 h-4" />
              Export Lightroom selection
            </Button>
          </div>
        </div>
      </div>

      {/* SECTION 1 — Per-client summary */}
      <section className="px-6 lg:px-10 mt-12">
        <SectionHeading
          icon={<Users className="w-4 h-4" />}
          title="Who chose what"
          subtitle="Each row is one client. Click to expand the photos they kept."
        />

        {summaryLoading ? (
          <div className="mt-6 space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : summary.length === 0 ? (
          <Card className="glass-card mt-6 p-12 text-center border-border/40">
            <Users className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No clients have submitted selections yet.
            </p>
          </Card>
        ) : (
          <div className="mt-6 space-y-2">
            {summary.map(row => {
              const key = row.client_email ?? "anon";
              const expanded = expandedClient === key;
              const rowSelections = selections.filter(
                s => s.client_email === row.client_email && s.selected,
              );
              return (
                <Card
                  key={key}
                  className={cn(
                    "glass-card border-border/40 transition-colors hover:border-primary/30 overflow-hidden",
                    expanded && "border-primary/40",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedClient(expanded ? null : key)}
                    className="w-full text-left p-4 flex items-center gap-4"
                  >
                    <Avatar className="w-11 h-11 shrink-0">
                      <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground text-sm font-semibold">
                        {initials(row.client_name, row.client_email)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">
                        {row.client_name || row.client_email || "Anonymous"}
                      </p>
                      <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5 truncate">
                        <Mail className="w-3 h-3 shrink-0" />
                        <span className="truncate">{row.client_email || "—"}</span>
                      </p>
                    </div>

                    <div className="hidden md:flex items-center gap-5 text-xs text-muted-foreground shrink-0">
                      <span className="inline-flex items-center gap-1.5">
                        <Heart className="w-3.5 h-3.5 text-primary/70" />
                        <span className="tabular-nums text-foreground font-medium">
                          {row.selected_count}
                        </span>{" "}
                        selected
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <StickyNote className="w-3.5 h-3.5" />
                        <span className="tabular-nums text-foreground font-medium">
                          {row.total_notes}
                        </span>{" "}
                        note{row.total_notes === 1 ? "" : "s"}
                      </span>
                      {row.last_activity && (
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          {formatDistanceToNow(new Date(row.last_activity), { addSuffix: true })}
                        </span>
                      )}
                    </div>

                    <ChevronDown
                      className={cn(
                        "w-4 h-4 text-muted-foreground transition-transform shrink-0",
                        expanded && "rotate-180",
                      )}
                    />
                  </button>

                  <AnimatePresence initial={false}>
                    {expanded && (
                      <motion.div
                        key="content"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 pt-1">
                          {/* Mobile stats summary */}
                          <div className="md:hidden flex items-center gap-4 text-xs text-muted-foreground mb-3">
                            <span>{row.selected_count} selected</span>
                            <span>{row.total_notes} notes</span>
                            {row.last_activity && (
                              <span>
                                {formatDistanceToNow(new Date(row.last_activity), {
                                  addSuffix: true,
                                })}
                              </span>
                            )}
                          </div>

                          {rowSelections.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-4">
                              This client hasn't selected any photos yet.
                            </p>
                          ) : (
                            <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-8 gap-2">
                              {rowSelections.map(s => {
                                const img = imagesById[s.image_id];
                                const thumb = img?.thumbnail_url
                                  ? getThumbnailUrl(img.thumbnail_url)
                                  : img?.original_url
                                    ? getThumbnailUrl(img.original_url)
                                    : null;
                                return (
                                  <div
                                    key={s.id}
                                    className="group relative aspect-square overflow-hidden rounded-md border border-border/40 bg-muted"
                                    title={img?.filename ?? s.image_id}
                                  >
                                    {thumb ? (
                                      <img
                                        src={thumb}
                                        alt={img?.filename ?? ""}
                                        loading="lazy"
                                        className="absolute inset-0 w-full h-full object-cover"
                                      />
                                    ) : (
                                      <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/40">
                                        ?
                                      </div>
                                    )}
                                    {s.note && (
                                      <div
                                        className="absolute bottom-0 inset-x-0 px-1.5 py-1 text-[10px] text-white bg-black/70 truncate"
                                        dir={isRtlText(s.note) ? "rtl" : "ltr"}
                                      >
                                        <MessageSquare className="inline w-2.5 h-2.5 mr-1 -mt-0.5" />
                                        {s.note}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* SECTION 2 — Side-by-side compare */}
      <section className="px-6 lg:px-10 mt-14">
        <SectionHeading
          icon={<ArrowLeftRight className="w-4 h-4" />}
          title="AI suggestions vs. couple's choices"
          subtitle="Did they pick close to your AI cut? Kept means both agree, dropped means the couple swapped it out, added means they pulled in a photo your AI didn't suggest."
        />

        {(aiLoading || selectionsLoading) ? (
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Skeleton className="h-72 rounded-xl" />
            <Skeleton className="h-72 rounded-xl" />
          </div>
        ) : (
          <>
            {/* Overlap pill row */}
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="gap-1.5 border-emerald-500/30 text-emerald-500">
                <CheckCircle2 className="w-3 h-3" />
                {overlap.kept} kept
              </Badge>
              <Badge variant="outline" className="gap-1.5 border-muted-foreground/30 text-muted-foreground">
                <MinusCircle className="w-3 h-3" />
                {overlap.dropped} AI-only
              </Badge>
              <Badge variant="outline" className="gap-1.5 border-primary/40 text-primary">
                <PlusCircle className="w-3 h-3" />
                {overlap.added} added by couple
              </Badge>
              {aiSuggested.length === 0 && (
                <span className="text-xs text-muted-foreground ml-2">
                  No AI suggestions on this gallery yet.
                </span>
              )}
            </div>

            <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Left: AI suggestions */}
              <Card className="glass-card p-5 border-border/40">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-medium inline-flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    Your AI suggestions
                  </p>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {aiSuggested.length}
                  </span>
                </div>

                {aiSuggested.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    No AI-suggested photos yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {aiSuggested.map(img => {
                      const kept = coupleImageIds.has(img.id);
                      const thumb = img.thumbnail_url
                        ? getThumbnailUrl(img.thumbnail_url)
                        : img.original_url
                          ? getThumbnailUrl(img.original_url)
                          : null;
                      return (
                        <CompareTile
                          key={img.id}
                          src={thumb}
                          alt={img.filename}
                          status={kept ? "kept" : "dropped"}
                        />
                      );
                    })}
                  </div>
                )}
              </Card>

              {/* Right: Couple's choices */}
              <Card className="glass-card p-5 border-border/40">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-medium inline-flex items-center gap-2">
                    <Heart className="w-3.5 h-3.5 text-primary" />
                    Your couple's choices
                  </p>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {coupleImageIds.size}
                  </span>
                </div>

                {coupleImageIds.size === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    The couple hasn't selected any photos yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {Array.from(coupleImageIds).map(imgId => {
                      const img = imagesById[imgId];
                      const inAi = aiImageIds.has(imgId);
                      const thumb = img?.thumbnail_url
                        ? getThumbnailUrl(img.thumbnail_url)
                        : img?.original_url
                          ? getThumbnailUrl(img.original_url)
                          : null;
                      return (
                        <CompareTile
                          key={imgId}
                          src={thumb}
                          alt={img?.filename ?? ""}
                          status={inAi ? "kept" : "added"}
                        />
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>
          </>
        )}
      </section>

      {/* SECTION 3 — Client notes */}
      <section className="px-6 lg:px-10 mt-14">
        <SectionHeading
          icon={<MessageSquare className="w-4 h-4" />}
          title="Notes from your couple"
          subtitle="Quick context the couple left on individual photos. Hebrew notes appear right-to-left."
        />

        {selectionsLoading ? (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        ) : notesRows.length === 0 ? (
          <Card className="glass-card mt-6 p-12 text-center border-border/40">
            <MessageSquare className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No notes yet. When clients leave a comment on a photo, it appears here.
            </p>
          </Card>
        ) : (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {notesRows.map(s => {
              const img = imagesById[s.image_id];
              const thumb = img?.thumbnail_url
                ? getThumbnailUrl(img.thumbnail_url)
                : img?.original_url
                  ? getThumbnailUrl(img.original_url)
                  : null;
              const rtl = isRtlText(s.note);
              return (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card className="glass-card overflow-hidden border-border/40 hover:border-primary/40 transition-colors h-full flex flex-col">
                    <div className="relative aspect-video bg-muted">
                      {thumb ? (
                        <img
                          src={thumb}
                          alt={img?.filename ?? ""}
                          loading="lazy"
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/40">
                          ?
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
                      <div className="absolute bottom-2 left-2 right-2 text-[11px] text-white/80 truncate">
                        {img?.filename ?? s.image_id}
                      </div>
                    </div>

                    <div className="p-4 flex-1 flex flex-col">
                      <p
                        dir={rtl ? "rtl" : "ltr"}
                        className={cn(
                          "text-sm leading-relaxed text-foreground/90 flex-1",
                          rtl && "text-right",
                        )}
                      >
                        <span className="inline-block text-primary/70 mr-1 align-top">
                          {rtl ? <span style={{ unicodeBidi: "bidi-override" }}>”</span> : "“"}
                        </span>
                        {s.note}
                        <span className="inline-block text-primary/70 ml-1 align-bottom">
                          {rtl ? "“" : "”"}
                        </span>
                      </p>

                      <div className="mt-4 flex items-center gap-2 pt-3 border-t border-border/40">
                        <Avatar className="w-6 h-6">
                          <AvatarFallback className="text-[10px] bg-muted text-muted-foreground font-medium">
                            {initials(s.client_name, s.client_email)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">
                            {s.client_name || s.client_email || "Anonymous"}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {formatDistanceToNow(new Date(s.updated_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

// ---------- Sub-components ----------

function SectionHeading({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div>
      <h2
        className="relative inline-block text-[22px] font-normal leading-tight tracking-tight pb-2"
        style={{ fontFamily: "'Playfair Display', serif" }}
      >
        <span className="inline-flex items-center gap-2.5">
          <span className="text-primary/80">{icon}</span>
          {title}
        </span>
        <span
          className="absolute left-0 bottom-0 h-px w-full bg-gradient-to-r from-primary/80 via-primary/30 to-transparent"
          aria-hidden
        />
      </h2>
      {subtitle && (
        <p className="mt-1 text-sm text-muted-foreground max-w-2xl">{subtitle}</p>
      )}
    </div>
  );
}

function CompareTile({
  src,
  alt,
  status,
}: {
  src: string | null;
  alt: string;
  status: "kept" | "dropped" | "added";
}) {
  const ring = {
    kept: "ring-1 ring-emerald-500/40",
    dropped: "ring-1 ring-border opacity-50 grayscale",
    added: "ring-2 ring-primary/70 shadow-[0_0_18px_hsl(330_100%_60%/0.25)]",
  }[status];

  const StatusIcon = {
    kept: CheckCircle2,
    dropped: MinusCircle,
    added: PlusCircle,
  }[status];

  const statusTint = {
    kept: "bg-emerald-500/90 text-white",
    dropped: "bg-black/70 text-white/85",
    added: "bg-primary text-primary-foreground",
  }[status];

  return (
    <div
      className={cn(
        "relative aspect-square overflow-hidden rounded-md bg-muted transition-all",
        ring,
      )}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/40">
          ?
        </div>
      )}
      <div
        className={cn(
          "absolute top-1.5 right-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full",
          statusTint,
        )}
        title={status}
      >
        <StatusIcon className="w-3 h-3" />
      </div>
    </div>
  );
}
