import { lazy, Suspense, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Images,
  ArrowRight,
  ArrowUpRight,
  HardDrive,
  Zap,
  Gift,
  Send,
  Wand2,
  Share2,
  Palette,
  Plus,
  Layers,
  FolderTree,
  Film,
  Cpu,
  Upload,
} from "lucide-react";

const CreditsUsageChart = lazy(() => import("@/components/dashboard/CreditsUsageChart"));
import OnboardingQuestionnaire from "@/components/onboarding/OnboardingQuestionnaire";
import { Orb } from "@/components/aura/Orb";
import { openAuraCommand } from "@/components/aura/AuraCommand";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useSubscription } from "@/hooks/useSubscription";
import { useGiftCreditsCelebration } from "@/hooks/useGiftCreditsCelebration";
import { useOnboardingQuestionnaire } from "@/hooks/useOnboardingQuestionnaire";
import { useEffectiveUser } from "@/hooks/useImpersonation";
import { getThumbnailUrl } from "@/lib/imageUrls";

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

const todayLabel = () =>
  new Date()
    .toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })
    .toUpperCase();

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

const PROMPT_CHIPS = [
  { label: "New collection", icon: Plus, to: "/dashboard/galleries/new" },
  { label: "Train an AI style", icon: Wand2, to: "/dashboard/styles/new" },
];

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

export default function DashboardHome() {
  const navigate = useNavigate();
  const [promptText, setPromptText] = useState("");
  const { effectiveUserId, effectiveDisplayName } = useEffectiveUser();
  const userName = effectiveDisplayName?.split(" ")[0] || "there";
  const {
    shouldShow: showQuestionnaire,
    unansweredQuestions,
    onSaveAnswer,
    onSkip: skipQuestionnaire,
    isSaving: isSavingQuestionnaire,
    dismiss: dismissQuestionnaire,
  } = useOnboardingQuestionnaire();
  const {
    currentPlan,
    editsTotal,
    editsRemaining,
    isUnlimited,
    storageUsedMb,
    maxStorageGb,
    creditGrants,
    giftCreditsTotal,
  } = useSubscription();

  useGiftCreditsCelebration(creditGrants);
  const hasGiftCredits = giftCreditsTotal > 0 && !isUnlimited;

  const storagePercent = maxStorageGb > 0 ? (storageUsedMb / (maxStorageGb * 1024)) * 100 : 0;
  const editsPercent = isUnlimited ? 100 : editsTotal > 0 ? (editsRemaining / editsTotal) * 100 : 0;

  const { data: galleryTotals } = useQuery({
    queryKey: ["dashboard-gallery-totals", effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return { count: 0, images: 0 };
      const { data, error } = await supabase
        .from("galleries")
        .select("id, total_images")
        .eq("user_id", effectiveUserId);
      if (error) throw error;
      return {
        count: data.length,
        images: data.reduce((sum, g) => sum + (g.total_images || 0), 0),
      };
    },
    enabled: !!effectiveUserId,
  });

  const { data: galleries = [], isLoading: galleriesLoading } = useQuery({
    queryKey: ["dashboard-galleries", effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return [];
      const { data, error } = await supabase
        .from("galleries")
        .select("*")
        .eq("user_id", effectiveUserId)
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data;
    },
    enabled: !!effectiveUserId,
  });

  const totalCollections = galleryTotals?.count ?? 0;
  const totalImages = galleryTotals?.images ?? 0;

  // Live engine queue — galleries the system is still processing.
  const engineQueue = useMemo(
    () =>
      galleries
        .filter((g) => g.status === "processing" || g.status === "uploading")
        .map((g) => ({
          id: g.id,
          name: g.name,
          heroUrl: g.hero_image_url as string | null,
          pct: g.total_images > 0 ? Math.round((g.processed_images / g.total_images) * 100) : 0,
          detail: `${g.processed_images || 0} / ${g.total_images || 0} images`,
        })),
    [galleries],
  );

  const isEmpty = galleries.length === 0 && !galleriesLoading;

  // Aura briefing — up to two genuinely useful observations, derived
  // from live data. Renders nothing when there is nothing worth saying.
  const briefing = useMemo(() => {
    const items: { key: string; text: string; to: string; label: string }[] = [];
    const working = galleries.filter((g) => g.status === "processing" || g.status === "uploading");
    if (working.length > 0) {
      items.push({
        key: "working",
        text:
          working.length === 1
            ? `I'm working through ${working[0].name} right now.`
            : `I'm working through ${working.length} collections right now.`,
        to: `/dashboard/galleries/${working[0].id}`,
        label: "Watch progress",
      });
    }
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const readyRecent = galleries.find(
      (g) => g.status === "ready" && new Date(g.updated_at) >= sevenDaysAgo,
    );
    if (readyRecent) {
      items.push({
        key: "ready",
        text: `${readyRecent.name} is finished and ready to deliver.`,
        to: `/dashboard/galleries/${readyRecent.id}`,
        label: "Open it",
      });
    }
    // Storage and edits are reported once each in the ledger cells below —
    // they are intentionally not duplicated here.
    return items.slice(0, 2);
  }, [galleries]);

  const formatStorage = (mb: number) =>
    mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;

  const engineWorking = engineQueue.length > 0;

  return (
    <div className="relative min-h-full bg-background px-5 py-7 lg:px-10 lg:py-10">
      <OnboardingQuestionnaire
        isOpen={showQuestionnaire}
        questions={unansweredQuestions}
        onSaveAnswer={onSaveAnswer}
        onSkip={skipQuestionnaire}
        onDismiss={dismissQuestionnaire}
        isSaving={isSavingQuestionnaire}
      />

      <motion.div
        variants={deck}
        initial="hidden"
        animate="show"
        className="relative mx-auto w-full max-w-[1320px]"
      >
        {/* ════ 1 · MASTHEAD ══════════════════════════════════════════════
            A restrained pro masthead: a mono dateline + plan readout on a
            hairline row, then the greeting. */}
        <motion.header variants={rise}>
          <div className="flex items-center justify-between gap-4 pb-3">
            <span className="caption">{todayLabel()}</span>
            {currentPlan && (
              <span className="caption flex items-center gap-1.5 text-foreground">
                <Zap className="h-3 w-3 text-accent" />
                {currentPlan.name}
              </span>
            )}
          </div>
          <hr className="aura-hairline" />
          <h1 className="mt-6 text-3xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-4xl">
            {getGreeting()}, <span className="text-accent">{userName}</span>
          </h1>
        </motion.header>

        {/* ════ 2 · AURA AI — the command bar panel ═══════════════════════
            The "our AI" surface: sparkle-headed panel with the command
            input, quick actions, and the live briefing notes inside it. */}
        <motion.section variants={rise} className="mt-7">
          <Panel>
            <PanelHeader
              tone="ai"
              icon={<Sparkle size={12} className="text-accent" />}
              label="Aura AI"
              trailing={
                <span className="caption flex items-center gap-1.5" style={{ color: "inherit" }}>
                  <span
                    className="aura-led aura-led-pulse"
                    style={{ "--led": engineWorking ? "var(--accent)" : "var(--secondary)" } as CSSProperties}
                  />
                  {engineWorking ? "Working" : "Ready"}
                </span>
              }
            />

            <div className="p-4 sm:p-5">
              {/* command input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  openAuraCommand(promptText);
                  setPromptText("");
                }}
                className="group/desk"
              >
                <div className="flex items-center gap-3 rounded-[--radius] border border-primary/35 bg-background px-3.5 py-2.5 transition-colors duration-200 [transition-timing-function:cubic-bezier(0.22,0.61,0.36,1)] focus-within:border-primary/70">
                  <Orb className="h-6 w-6 shrink-0" />
                  <input
                    value={promptText}
                    onChange={(e) => setPromptText(e.target.value)}
                    className="min-w-0 flex-1 bg-transparent font-sans text-sm text-foreground outline-none placeholder:text-muted-foreground/80 sm:text-base"
                    placeholder="Search or jump to…   (⌘K)"
                    aria-label="Search or jump to"
                  />
                  <button
                    type="submit"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-[--radius] bg-primary text-primary-foreground transition-opacity duration-200 [transition-timing-function:cubic-bezier(0.22,0.61,0.36,1)] hover:opacity-90 active:opacity-100"
                    aria-label="Send to Aura"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </form>

              {/* quick actions */}
              <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
                <span className="aura-microlabel">Quick marks</span>
                {PROMPT_CHIPS.map((c) => (
                  <Link
                    key={c.label}
                    to={c.to}
                    className="group/link inline-flex items-center gap-1.5 font-sans text-sm text-foreground/80 transition-colors hover:text-accent"
                  >
                    <c.icon className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover/link:text-accent" />
                    <span className="underline decoration-border underline-offset-4 transition-colors group-hover/link:decoration-accent">
                      {c.label}
                    </span>
                  </Link>
                ))}
              </div>

              {/* briefing notes — live, inside the AI panel */}
              {briefing.length > 0 && (
                <div className="mt-5 space-y-2.5 border-t border-border pt-4">
                  {briefing.map((b) => (
                    <Link
                      key={b.key}
                      to={b.to}
                      className="group/note flex items-start gap-3 rounded-[--radius] border border-primary/25 bg-primary/[0.06] px-3.5 py-3 transition-colors hover:border-primary/50"
                    >
                      <Sparkle size={13} className="mt-0.5 shrink-0 text-accent" />
                      <p className="min-w-0 flex-1 font-sans text-sm leading-snug text-foreground">
                        {b.text}
                      </p>
                      <span className="shrink-0 whitespace-nowrap font-mono text-[11px] text-accent transition-transform group-hover/note:translate-x-0.5">
                        {b.label} →
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </Panel>
        </motion.section>

        {galleriesLoading ? (
          <div className="flex items-center justify-center py-32">
            <Orb className="h-12 w-12" />
          </div>
        ) : isEmpty ? (
          /* ════ EMPTY STATE — a pro "import to begin" panel ══════════════ */
          <motion.section variants={rise} className="mt-7">
            <Panel>
              <PanelHeader icon={<FolderTree className="h-3.5 w-3.5" />} label="Library — empty catalog" />
              <div className="p-6 sm:p-8">
                <span className="folio block text-5xl text-accent sm:text-6xl">01</span>
                <h2 className="mt-4 max-w-2xl text-2xl font-semibold leading-[1.1] tracking-tight sm:text-3xl">
                  Your studio is set. The first <span className="text-accent">plate</span> is yours to print.
                </h2>
                <p className="mt-4 max-w-lg font-sans text-base leading-relaxed text-muted-foreground">
                  Upload a shoot and Aura culls it, retouches it in your style, and hands you a
                  gallery to deliver. It starts with one collection.
                </p>

                <div className="mt-8 grid gap-px overflow-hidden rounded-[--radius] border border-border bg-border sm:grid-cols-3">
                  {[
                    { icon: Upload, title: "Upload", body: "Drop a full shoot — RAW or JPEG." },
                    { icon: Sparkle, title: "Enhance", body: "Aura scores, culls and retouches." },
                    { icon: Share2, title: "Deliver", body: "Share a gallery, no account needed." },
                  ].map((s, i) => (
                    <div key={s.title} className="bg-card p-5">
                      <div className="flex items-baseline gap-3">
                        <span className="folio text-2xl text-accent">0{i + 1}</span>
                        <s.icon size={16} className="h-4 w-4 text-foreground/70" />
                      </div>
                      <p className="mt-3.5 text-lg font-semibold tracking-tight">{s.title}</p>
                      <p className="mt-1.5 font-sans text-sm leading-relaxed text-muted-foreground">
                        {s.body}
                      </p>
                    </div>
                  ))}
                </div>

                <Link
                  to="/dashboard/galleries/new"
                  className="mt-8 inline-flex items-center gap-2 rounded-[--radius] bg-primary px-6 py-3 font-sans text-sm font-semibold text-primary-foreground transition-opacity duration-200 [transition-timing-function:cubic-bezier(0.22,0.61,0.36,1)] hover:opacity-90"
                >
                  <Plus className="h-4 w-4" /> Create your first collection
                </Link>
              </div>
            </Panel>
          </motion.section>
        ) : (
          <>
            {/* ════ 3 · THE LEDGER (telemetry) — a Lightroom info panel ════
                Mono readout rows / stat cells across a panel. Big tabular
                numerals, gauge ring, gift credits, engine LED. */}
            <motion.section variants={rise} className="mt-7">
              <Panel>
                <PanelHeader icon={<Cpu className="h-3.5 w-3.5" />} label="Library — catalog info" trailing={<span className="caption">Studio telemetry</span>} />
                <div className="grid grid-cols-2 divide-border md:grid-cols-4 md:divide-x">
                  {/* AI edits remaining → billing */}
                  <Link
                    to="/dashboard/billing"
                    className="group border-b border-border p-5 transition-colors hover:bg-foreground/[0.03] md:border-b-0"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="folio flex items-baseline gap-2 text-4xl leading-none text-foreground sm:text-[2.75rem]">
                          {isUnlimited ? "∞" : editsRemaining.toLocaleString()}
                          <ArrowUpRight className="h-4 w-4 self-start text-muted-foreground/0 transition-colors group-hover:text-accent" />
                        </p>
                        <p className="caption mt-3 flex items-center gap-1.5 transition-colors group-hover:text-accent">
                          {hasGiftCredits ? <Gift className="h-3 w-3" /> : <Sparkle size={11} className="text-accent" />}
                          AI edits left
                        </p>
                        <p className="mt-1.5 font-mono text-[11px] text-muted-foreground">
                          {isUnlimited ? "no cap" : `of ${editsTotal.toLocaleString()}`}
                        </p>
                        {hasGiftCredits && (
                          <p className="mt-1 inline-flex items-center gap-1 font-mono text-[11px] text-accent">
                            <Gift className="h-2.5 w-2.5" /> +{giftCreditsTotal.toLocaleString()} gift
                          </p>
                        )}
                      </div>
                      <div className="relative h-11 w-11 shrink-0">
                        <div
                          className="aura-gauge absolute inset-0"
                          style={{ "--gauge": Math.round(editsPercent) } as CSSProperties}
                        />
                      </div>
                    </div>
                  </Link>

                  {/* Storage → billing */}
                  <Link
                    to="/dashboard/billing"
                    className="group border-b border-border p-5 transition-colors hover:bg-foreground/[0.03] md:border-b-0"
                  >
                    <p className="folio flex items-baseline gap-2 text-4xl leading-none text-foreground sm:text-[2.75rem]">
                      {formatStorage(storageUsedMb)}
                      <ArrowUpRight className="h-4 w-4 self-start text-muted-foreground/0 transition-colors group-hover:text-accent" />
                    </p>
                    <p className="caption mt-3 flex items-center gap-1.5 transition-colors group-hover:text-accent">
                      <HardDrive className="h-3 w-3" /> Storage
                    </p>
                    <p className="mt-1.5 font-mono text-[11px] text-muted-foreground">of {maxStorageGb} GB</p>
                    <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${Math.min(100, storagePercent)}%` }}
                      />
                    </div>
                  </Link>

                  {/* Collections → galleries */}
                  <Link
                    to="/dashboard/galleries"
                    className="group p-5 transition-colors hover:bg-foreground/[0.03]"
                  >
                    <p className="folio flex items-baseline gap-2 text-4xl leading-none text-foreground sm:text-[2.75rem]">
                      {totalCollections}
                      <ArrowUpRight className="h-4 w-4 self-start text-muted-foreground/0 transition-colors group-hover:text-accent" />
                    </p>
                    <p className="caption mt-3 flex items-center gap-1.5 transition-colors group-hover:text-accent">
                      <Layers className="h-3 w-3" /> Collections
                    </p>
                    <p className="mt-1.5 font-mono text-[11px] text-muted-foreground">
                      {totalImages.toLocaleString()} images total
                    </p>
                  </Link>

                  {/* Aura engine */}
                  <div className="p-5">
                    <p
                      className={cn(
                        "folio text-4xl leading-none sm:text-[2.75rem]",
                        engineWorking ? "text-accent" : "text-foreground",
                      )}
                    >
                      {engineWorking ? engineQueue.length : "Idle"}
                    </p>
                    <p className="caption mt-3 flex items-center gap-1.5">
                      <span
                        className="aura-led aura-led-pulse"
                        style={
                          { "--led": engineWorking ? "var(--accent)" : "var(--secondary)" } as CSSProperties
                        }
                      />
                      Aura engine
                    </p>
                    <p className="mt-1.5 font-mono text-[11px] text-muted-foreground">
                      {engineWorking
                        ? `${engineQueue.length === 1 ? "job" : "jobs"} working now`
                        : "ready when you are"}
                    </p>
                  </div>
                </div>
              </Panel>
            </motion.section>

            {/* ════ 4 · PROCESSING — the engine queue ═════════════════════
                A tight list: thumbnail + name + mono progress. */}
            {engineQueue.length > 0 && (
              <motion.section variants={rise} className="mt-6">
                <Panel>
                  <PanelHeader
                    tone="ai"
                    icon={<Sparkle size={12} className="text-accent" />}
                    label="Processing"
                    trailing={<span className="caption" style={{ color: "inherit" }}>Aura is working on</span>}
                  />
                  <ul className="divide-y divide-border">
                    {engineQueue.map((job) => (
                      <li key={job.id}>
                        <Link
                          to={`/dashboard/galleries/${job.id}`}
                          className="group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-foreground/[0.03]"
                        >
                          <div className="h-12 w-16 shrink-0 overflow-hidden rounded-sm bg-muted plate-keyline">
                            {job.heroUrl ? (
                              <img
                                src={getThumbnailUrl(job.heroUrl)}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="grid h-full w-full place-items-center">
                                <Images className="h-4 w-4 text-muted-foreground/40" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-base font-medium tracking-tight transition-colors group-hover:text-accent">
                              {job.name}
                            </p>
                            <p className="font-mono text-[11px] text-muted-foreground">{job.detail}</p>
                          </div>
                          <div className="hidden w-40 sm:block">
                            <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                              <motion.div
                                className="h-full rounded-full bg-accent"
                                initial={{ width: 0 }}
                                animate={{ width: `${job.pct}%` }}
                                transition={{ duration: 0.8, ease: EASE }}
                              />
                            </div>
                          </div>
                          <span className="w-12 text-right font-mono text-sm text-accent">{job.pct}%</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Panel>
              </motion.section>
            )}

            {/* ════ 5 · COLLECTIONS — the recents filmstrip ═══════════════
                Signature Lightroom element: a horizontal filmstrip of recent
                collection thumbnails (keyline cells, status dots). A single
                "View all" leads to the full Collections page. */}
            <motion.section variants={rise} className="mt-6">
              <Panel>
                <PanelHeader
                  icon={<Film className="h-3.5 w-3.5" />}
                  label="Filmstrip — recent collections"
                  trailing={
                    <Link
                      to="/dashboard/galleries"
                      className="group inline-flex items-center gap-1.5 font-sans text-sm text-foreground/80 transition-colors hover:text-accent"
                    >
                      <span className="underline decoration-border underline-offset-4 transition-colors group-hover:decoration-accent">
                        View all
                      </span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  }
                />

                {/* Status legend row */}
                <div className="flex items-center gap-3 border-b border-border bg-background/40 px-4 py-2">
                  <span className="caption flex items-center gap-1.5">
                    <span className="aura-led" style={{ "--led": "var(--secondary)" } as CSSProperties} /> Ready
                  </span>
                  <span className="caption flex items-center gap-1.5">
                    <span className="aura-led" style={{ "--led": "var(--rating)" } as CSSProperties} /> Proc
                  </span>
                  <span className="caption flex items-center gap-1.5">
                    <span className="aura-led" style={{ "--led": "var(--destructive)" } as CSSProperties} /> Error
                  </span>
                </div>

                {/* FILMSTRIP */}
                <div className="flex items-stretch gap-2.5 overflow-x-auto p-3">
                  {galleries.map((gallery, idx) => {
                    const pct =
                      gallery.total_images > 0
                        ? Math.round((gallery.processed_images / gallery.total_images) * 100)
                        : 0;
                    const isReady = gallery.status === "ready";
                    const isError = gallery.status === "error";
                    const isProcessing = !isReady && !isError;
                    const statusToken = isReady
                      ? "var(--secondary)"
                      : isError
                        ? "var(--destructive)"
                        : "var(--rating)";
                    // The newest collection gets a quiet "Latest" tag — not a
                    // full selection ring (there is no selection to make here).
                    const isLatest = idx === 0;
                    return (
                      <Link
                        key={gallery.id}
                        to={`/dashboard/galleries/${gallery.id}`}
                        className="group relative w-[140px] shrink-0 overflow-hidden rounded-sm border border-border bg-popover transition-colors hover:border-muted-foreground/40"
                      >
                        <div className="relative">
                          <div className="aspect-[5/4] w-full overflow-hidden bg-muted plate-keyline">
                            {gallery.hero_image_url ? (
                              <img
                                src={getThumbnailUrl(gallery.hero_image_url)}
                                alt={gallery.name}
                                className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                                onError={(e) => {
                                  const t = e.currentTarget;
                                  if (t.src !== gallery.hero_image_url) t.src = gallery.hero_image_url!;
                                }}
                              />
                            ) : (
                              <div className="grid h-full w-full place-items-center">
                                <Images className="h-5 w-5 text-muted-foreground/40" />
                              </div>
                            )}
                          </div>
                          {isProcessing && pct > 0 && (
                            <div className="absolute inset-x-0 bottom-0 h-1 bg-black/40">
                              <motion.div
                                className="h-full bg-rating"
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.8, ease: EASE }}
                              />
                            </div>
                          )}
                          {isLatest && (
                            <span className="absolute right-1.5 top-1.5 rounded-sm border border-border bg-background/85 px-1.5 py-0.5 font-mono text-[9px] font-medium uppercase tracking-wide text-muted-foreground backdrop-blur-sm">
                              Latest
                            </span>
                          )}
                        </div>
                        <div className="px-2 py-1.5">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={cn("aura-led", isProcessing && "aura-led-pulse")}
                              style={{ "--led": statusToken } as CSSProperties}
                            />
                            <span className="truncate text-[11px] font-medium text-foreground">
                              {gallery.name}
                            </span>
                          </div>
                          <div className="mt-0.5 flex items-center justify-between font-mono text-[9px] text-muted-foreground">
                            <span>{(gallery.total_images || 0).toLocaleString()} IMG</span>
                            <span>{isProcessing ? `${pct}%` : isError ? "ERROR" : "READY"}</span>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </Panel>
            </motion.section>

            {/* ════ 6 · DEVELOP / USAGE + IN THE STUDIO ═══════════════════ */}
            <motion.section
              variants={rise}
              className="mt-6 grid gap-6 lg:grid-cols-[1.4fr,1fr] lg:items-start"
            >
              <Panel>
                <PanelHeader icon={<Zap className="h-3.5 w-3.5" />} label="Develop — usage" />
                <div className="p-2">
                  <Suspense fallback={<div className="h-64 rounded-[--radius] border border-border bg-card" />}>
                    <CreditsUsageChart />
                  </Suspense>
                </div>
              </Panel>

              <Panel>
                <PanelHeader icon={<FolderTree className="h-3.5 w-3.5" />} label="In the studio" />
                <ul className="divide-y divide-border">
                  {[
                    {
                      to: "/dashboard/styles",
                      icon: Palette,
                      title: "Train an AI style",
                      body: "Teach Aura your editing look, then apply it to a whole collection.",
                    },
                    {
                      to: "/dashboard/galleries",
                      icon: Share2,
                      title: "Share with clients",
                      body: "Send a gallery link. Clients view, favorite and download, no account.",
                    },
                    ...(!isUnlimited
                      ? [
                          {
                            to: "/dashboard/billing",
                            icon: Zap,
                            title: "Upgrade your plan",
                            body: "Move up for unlimited edits, more storage and priority processing.",
                          },
                        ]
                      : []),
                  ].map((card) => (
                    <li key={card.to + card.title}>
                      <Link
                        to={card.to}
                        className="group flex items-start gap-4 px-4 py-4 transition-colors hover:bg-foreground/[0.03]"
                      >
                        <card.icon className="mt-1 h-4 w-4 shrink-0 text-foreground/70 transition-colors group-hover:text-accent" />
                        <div className="min-w-0 flex-1">
                          <p className="text-base font-medium tracking-tight transition-colors group-hover:text-accent">
                            {card.title}
                          </p>
                          <p className="mt-1 font-sans text-sm leading-relaxed text-muted-foreground">
                            {card.body}
                          </p>
                        </div>
                        <ArrowUpRight className="mt-1.5 h-4 w-4 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-accent" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </Panel>
            </motion.section>
          </>
        )}
      </motion.div>
    </div>
  );
}
