import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  Users,
  Share2,
  CheckCircle2,
  Flame,
  KeyRound,
  AlertTriangle,
  Heart,
  Bookmark,
  Activity,
  ChevronDown,
  MapPin,
  Loader2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import { format, formatDistanceToNow, subDays } from "date-fns";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { getThumbnailUrl } from "@/lib/imageUrls";

// ---------- Types ----------
type HeatmapRow = {
  image_id: string;
  thumbnail_url: string | null;
  filename: string;
  view_count: number;
  dwell_seconds_sum: number;
  client_favorite_count: number;
  share_count: number;
  selection_count: number;
  engagement_score: number;
};

type AuditRow = {
  id: string;
  gallery_id: string;
  event_type: string;
  ip_address: string | null;
  user_agent: string | null;
  country_code: string | null;
  session_token: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type ShareEvent = {
  id: string;
  gallery_id: string;
  channel: string;
  created_at: string;
};

type Interaction = {
  id: string;
  interaction_type: string;
  ip_address: string | null;
  created_at: string;
};

type SortKey = "engagement_score" | "view_count" | "client_favorite_count" | "share_count";
const SORT_LABELS: Record<SortKey, string> = {
  engagement_score: "Engagement",
  view_count: "Views",
  client_favorite_count: "Favorites",
  share_count: "Shares",
};

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  email: "Email",
  copy: "Copy link",
  instagram: "Instagram",
  facebook: "Facebook",
  twitter: "Twitter",
  other: "Other",
};

const PINK = "hsl(330 100% 60%)";
const PINK_SOFT = "hsl(330 100% 75%)";

// ---------- Helpers ----------

function getEventIcon(eventType: string) {
  const e = eventType.toLowerCase();
  if (e.includes("view")) return Eye;
  if (e.includes("password_failure")) return KeyRound;
  if (e.includes("login") || e.includes("password_success")) return KeyRound;
  if (e.includes("share")) return Share2;
  if (e.includes("kill") || e.includes("revoke")) return AlertTriangle;
  if (e.includes("like") || e.includes("favorite")) return Heart;
  if (e.includes("selection")) return Bookmark;
  return Activity;
}

function eventDescription(row: AuditRow) {
  const t = row.event_type.toLowerCase();
  if (t === "view" || t === "gallery_view") return "Gallery viewed";
  if (t === "image_view") return "Photo opened";
  if (t === "login" || t === "password_success") return "Logged in with password";
  if (t === "password_failure") return "Password failed";
  if (t.startsWith("share")) {
    const ch = (row.metadata as any)?.channel;
    return ch ? `Shared via ${CHANNEL_LABELS[ch] ?? ch}` : "Share recorded";
  }
  if (t === "selection_submitted") return "Submitted final selection";
  if (t === "like" || t === "favorite") return "Favorited a photo";
  if (t === "kill_switch" || t === "revoked") return "Kill switch pressed";
  return row.event_type.replace(/_/g, " ");
}

// ---------- Page ----------

export default function GalleryInsightsPage() {
  const { id } = useParams<{ id: string }>();
  const [sortKey, setSortKey] = useState<SortKey>("engagement_score");
  const [heatmapLimit, setHeatmapLimit] = useState(50);

  // ----- Gallery meta -----
  const { data: gallery } = useQuery({
    queryKey: ["gallery-insights-meta", id],
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

  // ----- Interactions (views, unique IPs) -----
  const { data: interactions = [] } = useQuery<Interaction[]>({
    queryKey: ["gallery-insights-interactions", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_interactions")
        .select("id, interaction_type, ip_address, created_at")
        .eq("gallery_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Interaction[];
    },
    enabled: !!id,
  });

  // ----- Share events -----
  const { data: shareEvents = [] } = useQuery<ShareEvent[]>({
    queryKey: ["gallery-insights-share-events", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("gallery_share_events")
        .select("id, gallery_id, channel, created_at")
        .eq("gallery_id", id!)
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data || []) as ShareEvent[];
    },
    enabled: !!id,
  });

  // ----- Selections (completion stat) -----
  const { data: selections = [] } = useQuery<{ client_email: string | null; selected: boolean }[]>({
    queryKey: ["gallery-insights-selections", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("gallery_selections")
        .select("client_email, selected")
        .eq("gallery_id", id!);
      if (error) throw error;
      return (data || []) as { client_email: string | null; selected: boolean }[];
    },
    enabled: !!id,
  });

  // ----- Heatmap RPC -----
  const { data: heatmapRaw = [], isLoading: heatmapLoading } = useQuery<HeatmapRow[]>({
    queryKey: ["gallery-insights-heatmap", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_gallery_heatmap", {
        p_gallery_id: id!,
      });
      if (error) throw error;
      return (data || []) as HeatmapRow[];
    },
    enabled: !!id,
  });

  // ----- Audit log -----
  const { data: auditLog = [], isLoading: auditLoading } = useQuery<AuditRow[]>({
    queryKey: ["gallery-insights-audit", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("gallery_audit_log")
        .select("*")
        .eq("gallery_id", id!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as AuditRow[];
    },
    enabled: !!id,
  });

  // ----- Headline metrics -----
  const totalViews = useMemo(
    () => interactions.filter(i => i.interaction_type === "view").length,
    [interactions],
  );
  const uniqueVisitors = useMemo(() => {
    const ips = new Set(interactions.filter(i => i.ip_address).map(i => i.ip_address));
    return ips.size;
  }, [interactions]);
  const totalShares = shareEvents.length;

  const selectionStats = useMemo(() => {
    const selected = selections.filter(s => s.selected).length;
    const clients = new Set(selections.map(s => s.client_email).filter(Boolean));
    return { selected, clients: clients.size };
  }, [selections]);

  // ----- Sorted heatmap -----
  const heatmap = useMemo(() => {
    const sorted = [...heatmapRaw].sort((a, b) => {
      const av = Number((a as any)[sortKey] ?? 0);
      const bv = Number((b as any)[sortKey] ?? 0);
      return bv - av;
    });
    return sorted;
  }, [heatmapRaw, sortKey]);

  const heatMax = useMemo(() => {
    if (heatmap.length === 0) return 0;
    return Math.max(1, ...heatmap.map(h => Number((h as any)[sortKey] ?? 0)));
  }, [heatmap, sortKey]);

  // ----- Channel breakdown (last 30 days) -----
  const channelData = useMemo(() => {
    const cutoff = subDays(new Date(), 30);
    const counts: Record<string, number> = {};
    shareEvents.forEach(ev => {
      if (new Date(ev.created_at) < cutoff) return;
      const key = ev.channel || "other";
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([channel, count]) => ({
        channel: CHANNEL_LABELS[channel] || channel,
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }, [shareEvents]);

  // ----- Daily shares (last 30 days) -----
  const dailyShares = useMemo(() => {
    const map: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const key = format(d, "yyyy-MM-dd");
      map[key] = 0;
    }
    shareEvents.forEach(ev => {
      const key = format(new Date(ev.created_at), "yyyy-MM-dd");
      if (key in map) map[key]++;
    });
    return Object.entries(map).map(([date, count]) => ({
      date,
      label: format(new Date(date), "MMM d"),
      count,
    }));
  }, [shareEvents]);

  // ----- Brute-force flag for audit log -----
  // >5 password_failure events from same IP within 1 hour
  const flaggedAuditIds = useMemo(() => {
    const failuresByIp: Record<string, string[]> = {};
    auditLog.forEach(row => {
      if (row.event_type === "password_failure" && row.ip_address) {
        (failuresByIp[row.ip_address] ||= []).push(row.created_at);
      }
    });
    const flagged = new Set<string>();
    auditLog.forEach(row => {
      if (row.event_type !== "password_failure" || !row.ip_address) return;
      const all = failuresByIp[row.ip_address] || [];
      const t = new Date(row.created_at).getTime();
      const within = all.filter(d => {
        const td = new Date(d).getTime();
        return Math.abs(td - t) <= 60 * 60 * 1000;
      });
      if (within.length > 5) flagged.add(row.id);
    });
    return flagged;
  }, [auditLog]);

  const visibleHeatmap = heatmap.slice(0, heatmapLimit);

  return (
    <div className="relative min-h-screen pb-24">
      {/* Atmospheric backdrop */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 -left-24 w-[440px] h-[440px] rounded-full bg-[hsl(330_100%_60%/0.15)] blur-3xl" />
        <div className="absolute top-72 -right-24 w-[520px] h-[520px] rounded-full bg-[hsl(270_100%_65%/0.12)] blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(hsl(var(--border)/0.4)_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.18]" />
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

        <div className="mt-4 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <p className="text-[11px] tracking-[0.3em] uppercase text-primary/80 font-semibold">
              Photographer Insights
            </p>
            <h1
              className="mt-2 text-4xl lg:text-5xl font-normal leading-[1.05] tracking-tight"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              The pulse of{" "}
              <em className="text-gradient-primary not-italic">
                {gallery?.name || "this gallery"}
              </em>
            </h1>
            <p className="mt-3 text-sm text-muted-foreground max-w-xl">
              Who looked, what stayed with them, who passed it along — and every event in the
              gallery's history, audit-grade.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={`/dashboard/galleries/${id}/selections`}
              className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1"
            >
              View selections <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* SECTION 1 — Headline metrics */}
      <section className="px-6 lg:px-10 mt-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            icon={<Eye className="w-4 h-4" />}
            label="Total views"
            value={totalViews}
            sub="All time"
          />
          <MetricCard
            icon={<Users className="w-4 h-4" />}
            label="Unique visitors"
            value={uniqueVisitors}
            sub="By IP address"
          />
          <MetricCard
            icon={<Share2 className="w-4 h-4" />}
            label="Total shares"
            value={totalShares}
            sub={channelData[0] ? `Top: ${channelData[0].channel}` : "No shares yet"}
          />
          <MetricCard
            icon={<CheckCircle2 className="w-4 h-4" />}
            label="Selection"
            value={
              gallery?.selection_mode_enabled
                ? `${selectionStats.selected}/${gallery?.selection_target_count ?? "?"}`
                : "Off"
            }
            sub={
              gallery?.selection_mode_enabled
                ? `selected by ${selectionStats.clients} client${
                    selectionStats.clients === 1 ? "" : "s"
                  }`
                : "Selection mode is disabled"
            }
            accent={!!gallery?.selection_mode_enabled}
          />
        </div>
      </section>

      {/* SECTION 2 — Heatmap */}
      <section className="px-6 lg:px-10 mt-14">
        <SectionHeading
          icon={<Flame className="w-4 h-4" />}
          title="Most-loved photos"
          subtitle="Sorted by the engagement signal — views, dwell time, favorites, shares and selections, weighted."
          right={
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 h-8 text-xs">
                  Sort: {SORT_LABELS[sortKey]}
                  <ChevronDown className="w-3.5 h-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {(Object.keys(SORT_LABELS) as SortKey[]).map(k => (
                  <DropdownMenuItem key={k} onClick={() => setSortKey(k)}>
                    {SORT_LABELS[k]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          }
        />

        {heatmapLoading ? (
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {[...Array(12)].map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))}
          </div>
        ) : heatmap.length === 0 ? (
          <Card className="glass-card mt-6 p-12 text-center border-border/40">
            <Flame className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No engagement yet — once clients view this gallery, the heatmap fills in.
            </p>
          </Card>
        ) : (
          <>
            <TooltipProvider delayDuration={120}>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4 }}
                className="mt-6 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3"
              >
                {visibleHeatmap.map((tile, i) => (
                  <HeatmapTile
                    key={tile.image_id}
                    tile={tile}
                    rank={i + 1}
                    sortKey={sortKey}
                    heatMax={heatMax}
                  />
                ))}
              </motion.div>
            </TooltipProvider>

            {heatmap.length > heatmapLimit && (
              <div className="mt-6 flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setHeatmapLimit(l => l + 50)}
                >
                  View all {heatmap.length} photos
                </Button>
              </div>
            )}
          </>
        )}
      </section>

      {/* SECTION 3 — Share-channel breakdown */}
      <section className="px-6 lg:px-10 mt-14">
        <SectionHeading
          icon={<Share2 className="w-4 h-4" />}
          title="How they shared"
          subtitle="Channel mix and daily rhythm over the last 30 days."
        />

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Channel breakdown */}
          <Card className="glass-card p-5 border-border/40">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-4">
              By channel
            </p>
            {channelData.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No shares yet in the last 30 days
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={channelData}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
                >
                  <CartesianGrid
                    stroke="hsl(var(--border))"
                    strokeOpacity={0.35}
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="channel"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    width={80}
                  />
                  <RechartsTooltip
                    cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="count" fill={PINK} radius={[0, 6, 6, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Daily line chart */}
          <Card className="glass-card p-5 border-border/40">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-4">
              Last 30 days
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={dailyShares} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.3} vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <RechartsTooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke={PINK}
                  strokeWidth={2}
                  dot={{ r: 2, fill: PINK }}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </div>
      </section>

      {/* SECTION 4 — Audit log */}
      <section className="px-6 lg:px-10 mt-14">
        <SectionHeading
          icon={<Activity className="w-4 h-4" />}
          title="Audit timeline"
          subtitle="Every meaningful event on this gallery, latest first. Brute-force attempts are flagged in red."
        />

        {auditLoading ? (
          <div className="mt-6 space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : auditLog.length === 0 ? (
          <Card className="glass-card mt-6 p-12 text-center border-border/40">
            <Activity className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No events recorded yet. The audit log fills in as clients open and share the gallery.
            </p>
          </Card>
        ) : (
          <ol className="relative mt-6 border-l border-border/50 ml-4">
            {auditLog.map((row, idx) => {
              const Icon = getEventIcon(row.event_type);
              const flagged = flaggedAuditIds.has(row.id);
              return (
                <motion.li
                  key={row.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, delay: Math.min(idx * 0.015, 0.4) }}
                  className="relative pl-6 pb-4"
                >
                  <span
                    className={cn(
                      "absolute -left-[18px] top-1.5 flex items-center justify-center w-8 h-8 rounded-full ring-4 ring-background",
                      flagged
                        ? "bg-destructive/15 text-destructive"
                        : "bg-primary/10 text-primary",
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </span>

                  <Card
                    className={cn(
                      "glass-card border-border/40 p-3.5 flex flex-col sm:flex-row sm:items-center gap-3",
                      flagged && "border-destructive/60 bg-destructive/[0.08]",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-snug">
                        {eventDescription(row)}
                        {flagged && (
                          <Badge
                            variant="destructive"
                            className="ml-2 align-middle text-[10px] tracking-wider uppercase"
                          >
                            Brute force
                          </Badge>
                        )}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                        <span>
                          {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}
                        </span>
                        {row.ip_address && (
                          <span className="font-mono">{row.ip_address}</span>
                        )}
                        {row.country_code && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {row.country_code}
                          </span>
                        )}
                        <span className="text-muted-foreground/60">
                          {format(new Date(row.created_at), "MMM d, HH:mm")}
                        </span>
                      </p>
                    </div>

                    {flagged && (
                      <Button
                        variant="destructive"
                        size="sm"
                        className="shrink-0"
                        title="Rotate the share secret to invalidate the leaked link"
                      >
                        Kill switch
                      </Button>
                    )}
                  </Card>
                </motion.li>
              );
            })}
          </ol>
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
  right,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4 flex-wrap">
      <div className="min-w-0">
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
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  sub,
  accent,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
  loading?: boolean;
}) {
  return (
    <Card
      className={cn(
        "glass-card relative overflow-hidden p-5 border-border/40 transition-colors hover:border-primary/40",
        accent && "border-primary/40",
      )}
    >
      {accent && (
        <div className="pointer-events-none absolute -right-10 -top-10 w-32 h-32 rounded-full bg-primary/10 blur-2xl" />
      )}
      <div className="flex items-center justify-between">
        <div className="p-2 rounded-md bg-primary/10 text-primary">{icon}</div>
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      </div>
      <div className="mt-4">
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        ) : (
          <p
            className="text-3xl font-semibold tabular-nums leading-none"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            {value}
          </p>
        )}
        {sub && <p className="mt-1.5 text-xs text-muted-foreground">{sub}</p>}
      </div>
    </Card>
  );
}

function HeatmapTile({
  tile,
  rank,
  sortKey,
  heatMax,
}: {
  tile: HeatmapRow;
  rank: number;
  sortKey: SortKey;
  heatMax: number;
}) {
  const v = Number((tile as any)[sortKey] ?? 0);
  const pct = heatMax > 0 ? Math.max(0.02, v / heatMax) : 0;
  const hot = pct > 0.4;

  const thumb = tile.thumbnail_url ? getThumbnailUrl(tile.thumbnail_url) : null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "group relative aspect-square overflow-hidden rounded-lg border border-border/40 bg-muted",
            "transition-transform duration-300 hover:scale-[1.02] hover:border-primary/60",
          )}
        >
          {thumb ? (
            <img
              src={thumb}
              alt={tile.filename}
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
              <Eye className="w-5 h-5 opacity-30" />
            </div>
          )}

          {/* rank badge */}
          <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[10px] font-mono bg-black/60 text-white backdrop-blur-sm">
            #{rank}
          </div>

          {/* gradient veil */}
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />

          {/* heat bar */}
          <div className="absolute bottom-0 left-0 right-0 px-2 pb-1.5">
            <div className="flex items-center justify-between text-[10px] font-medium text-white/95">
              <span className="inline-flex items-center gap-1">
                <Flame
                  className={cn(
                    "w-3 h-3",
                    hot ? "text-[hsl(330_100%_75%)]" : "text-white/60",
                  )}
                />
                <span className="tabular-nums">{v}</span>
              </span>
              <span className="text-white/70">{SORT_LABELS[sortKey]}</span>
            </div>
            <div className="mt-1 h-1.5 w-full rounded-full bg-white/15 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, pct * 100)}%`,
                  background: hot
                    ? `linear-gradient(90deg, ${PINK}, ${PINK_SOFT})`
                    : `linear-gradient(90deg, hsl(240 5% 55%), hsl(240 5% 75%))`,
                  boxShadow: hot ? `0 0 12px ${PINK}80` : undefined,
                }}
              />
            </div>
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs leading-relaxed">
        <p className="font-medium mb-1 max-w-[200px] truncate">{tile.filename}</p>
        <p>Viewed {tile.view_count}×</p>
        <p>Liked by {tile.client_favorite_count}</p>
        <p>Shared {tile.share_count}×</p>
        <p>Selected by {tile.selection_count}</p>
        <p className="text-muted-foreground">
          Dwell {tile.dwell_seconds_sum}s · score {Math.round(Number(tile.engagement_score))}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
