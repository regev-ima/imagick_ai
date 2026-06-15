import { lazy, Suspense, useMemo, useState, type CSSProperties } from "react";
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
  Sparkles,
  Send,
  Wand2,
  Share2,
  Palette,
  Plus,
  Layers,
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

// One orchestrated reveal: each block fades up with a short cascade.
const deck = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const EASE: [number, number, number, number] = [0.2, 0, 0, 1];
const rise = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};

const PROMPT_CHIPS = [
  { label: "New collection", icon: Plus, to: "/dashboard/galleries/new" },
  { label: "Train an AI style", icon: Wand2, to: "/dashboard/styles/new" },
  { label: "Share a gallery", icon: Share2, to: "/dashboard/galleries" },
];

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
    if (storagePercent >= 80) {
      items.push({
        key: "storage",
        text: `Storage is at ${Math.round(storagePercent)}% — worth a look before the next big shoot.`,
        to: "/dashboard/billing",
        label: "Review storage",
      });
    }
    if (!isUnlimited && editsTotal > 0 && editsRemaining / editsTotal <= 0.1) {
      items.push({
        key: "edits",
        text: `Only ${editsRemaining.toLocaleString()} edits left this cycle.`,
        to: "/dashboard/billing",
        label: "Top up",
      });
    }
    return items.slice(0, 2);
  }, [galleries, storagePercent, isUnlimited, editsRemaining, editsTotal]);

  const formatStorage = (mb: number) =>
    mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;

  return (
    <div className="relative min-h-full px-4 py-6 lg:px-8 lg:py-8">
      <OnboardingQuestionnaire
        isOpen={showQuestionnaire}
        questions={unansweredQuestions}
        onSaveAnswer={onSaveAnswer}
        onSkip={skipQuestionnaire}
        onDismiss={dismissQuestionnaire}
        isSaving={isSavingQuestionnaire}
      />

      {/* Ambient spectral wash behind the hero — pure decoration, photo-first. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] opacity-70"
        style={{
          background:
            "radial-gradient(120% 70% at 50% -20%, hsl(var(--neon-purple) / 0.10), transparent 60%)",
        }}
      />

      <motion.div variants={deck} initial="hidden" animate="show" className="relative mx-auto w-full max-w-[1400px] space-y-10">
        {/* ════ HERO COMMAND DECK ═══════════════════════════════════════
            Greeting + Aura command bar + briefing share one spectral frame,
            so the assistant reads as the hero of the whole screen. */}
        <motion.section variants={rise} className="aura-ai-border overflow-hidden rounded-[32px]">
          <div className="relative rounded-[32px] bg-card/60 px-5 py-7 backdrop-blur-2xl sm:px-8 sm:py-9">
            {/* Greeting line */}
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-mono text-[11px] tracking-[0.22em] text-muted-foreground">{todayLabel()}</p>
                <h1 className="mt-2.5 font-display text-3xl font-bold tracking-tight lg:text-[2.75rem] lg:leading-[1.05]">
                  {getGreeting()}, <span className="text-gradient-primary">{userName}</span>
                </h1>
              </div>
              {currentPlan && (
                <span className="aura-chip shrink-0" style={{ "--led": "var(--rating)" } as CSSProperties}>
                  <Zap className="h-3 w-3" style={{ color: "hsl(var(--rating))" }} /> {currentPlan.name}
                </span>
              )}
            </div>

            {/* Aura command bar — the centerpiece */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                openAuraCommand(promptText);
                setPromptText("");
              }}
              className="mt-7"
            >
              <div className="relative flex items-center gap-3 rounded-full border border-border/70 bg-background/70 px-4 py-3 shadow-[inset_0_1px_0_hsl(0_0%_100%/0.04)] backdrop-blur-xl sm:px-5 sm:py-4">
                <Orb className="h-7 w-7 shrink-0" />
                <input
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/75 sm:text-base"
                  placeholder="Ask Aura: find a collection, start one, train a style… (⌘K)"
                  aria-label="Ask Aura"
                />
                <button
                  type="submit"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[image:var(--gradient-primary)] text-white shadow-[inset_0_1px_0_hsl(0_0%_100%/0.3),0_0_22px_-6px_hsl(var(--glow-primary)/0.8)] transition-transform duration-150 [transition-timing-function:cubic-bezier(0.2,0,0,1)] active:scale-95"
                  aria-label="Send to Aura"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </form>

            {/* Quick-action chips */}
            <div className="mt-3 flex flex-wrap gap-2">
              {PROMPT_CHIPS.map((c) => (
                <Link
                  key={c.label}
                  to={c.to}
                  className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/50 px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground backdrop-blur-md transition-colors duration-150 hover:border-primary/50 hover:text-foreground"
                >
                  <c.icon className="h-3 w-3 text-primary" /> {c.label}
                </Link>
              ))}
            </div>

            {/* Aura briefing — folded into the hero as Aura's own voice */}
            {!isEmpty && briefing.length > 0 && (
              <>
                <hr className="aura-hairline my-6" />
                <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:gap-4">
                  <div className="flex shrink-0 items-center gap-2.5 sm:pt-0.5">
                    <Orb className="h-6 w-6" />
                    <span className="aura-microlabel">Aura briefing</span>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    {briefing.map((b) => (
                      <p key={b.key} className="text-sm text-muted-foreground">
                        {b.text}{" "}
                        <Link to={b.to} className="whitespace-nowrap font-medium text-primary hover:underline">
                          {b.label} →
                        </Link>
                      </p>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </motion.section>

        {galleriesLoading ? (
          <div className="flex items-center justify-center py-24">
            <Orb className="h-12 w-12" />
          </div>
        ) : isEmpty ? (
          /* ════ EMPTY — command-deck welcome ══════════════════════════ */
          <motion.div variants={rise} className="overflow-hidden rounded-[28px] border border-border/60 bg-card/50 p-8 text-center backdrop-blur-xl lg:p-14">
            <Orb className="mx-auto h-20 w-20" />
            <h2 className="mt-7 font-display text-2xl font-bold tracking-tight lg:text-3xl">
              Your studio is <span className="text-gradient-primary">ready</span>
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
              Upload a shoot and Aura culls it, retouches it in your style, and hands you a gallery
              to deliver. It starts with one collection.
            </p>
            <div className="mx-auto mt-9 grid max-w-2xl gap-3 sm:grid-cols-3">
              {[
                { icon: Images, title: "Upload", body: "Drop a full shoot — RAW or JPEG." },
                { icon: Sparkles, title: "Enhance", body: "Aura scores, culls and retouches." },
                { icon: Share2, title: "Deliver", body: "Share a gallery, no account needed." },
              ].map((s, i) => (
                <div key={s.title} className="rounded-2xl border border-border/60 bg-background/40 p-5 text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-primary">0{i + 1}</span>
                    <s.icon className="h-4 w-4 text-primary" />
                  </div>
                  <p className="mt-3 font-semibold">{s.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{s.body}</p>
                </div>
              ))}
            </div>
            <Link
              to="/dashboard/galleries/new"
              className="mt-9 inline-flex items-center gap-2 rounded-full bg-[image:var(--gradient-primary)] px-7 py-3 font-semibold text-white shadow-[inset_0_1px_0_hsl(0_0%_100%/0.3),0_0_30px_-8px_hsl(var(--glow-primary)/0.8)] transition-transform duration-150 [transition-timing-function:cubic-bezier(0.2,0,0,1)] active:scale-[0.97]"
            >
              <Plus className="h-4.5 w-4.5" /> Create your first collection
            </Link>
          </motion.div>
        ) : (
          <>
            {/* ════ TELEMETRY RAIL ════════════════════════════════════════
                Instrument strip — the 4 live stats read as one panel. */}
            <motion.section variants={rise}>
              <p className="aura-microlabel mb-3">Studio telemetry</p>
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-border/60 bg-border/40 xl:grid-cols-4">
                {/* Edits gauge */}
                <div className="relative overflow-hidden bg-card/80 p-5 backdrop-blur-xl">
                  <p className="aura-microlabel flex items-center gap-2">
                    {hasGiftCredits ? <Gift className="h-3 w-3" /> : <Zap className="h-3 w-3" />} AI edits left
                  </p>
                  <div className="mt-4 flex items-center gap-4">
                    <div className="relative h-16 w-16 shrink-0">
                      <div className="aura-gauge absolute inset-0" style={{ "--gauge": Math.round(editsPercent) } as CSSProperties} />
                      {isUnlimited && (
                        <span className="absolute inset-0 grid place-items-center font-display text-lg text-primary">∞</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-display text-2xl font-semibold leading-none">
                        {isUnlimited ? "Unlimited" : editsRemaining.toLocaleString()}
                      </p>
                      <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                        {isUnlimited ? "no cap" : `of ${editsTotal.toLocaleString()}`}
                      </p>
                      {hasGiftCredits && (
                        <span className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-[hsl(var(--rating)/0.3)] bg-[hsl(var(--rating)/0.12)] px-1.5 py-0.5 font-mono text-[10px] text-[hsl(var(--rating))]">
                          <Gift className="h-2.5 w-2.5" /> +{giftCreditsTotal.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Storage */}
                <div className="relative overflow-hidden bg-card/80 p-5 backdrop-blur-xl">
                  <p className="aura-microlabel flex items-center gap-2">
                    <HardDrive className="h-3 w-3" /> Storage
                  </p>
                  <p className="mt-4 font-display text-2xl font-semibold leading-none">
                    {formatStorage(storageUsedMb)}
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">of {maxStorageGb} GB</p>
                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-[image:var(--gradient-primary)] shadow-[0_0_10px_hsl(var(--glow-primary)/0.5)]"
                      style={{ width: `${Math.min(100, storagePercent)}%` }}
                    />
                  </div>
                </div>

                {/* Collections */}
                <Link
                  to="/dashboard/galleries"
                  className="group relative overflow-hidden bg-card/80 p-5 backdrop-blur-xl transition-colors duration-200 hover:bg-card"
                >
                  <p className="aura-microlabel flex items-center gap-2">
                    <Layers className="h-3 w-3" /> Collections
                    <ArrowUpRight className="ml-auto h-3.5 w-3.5 text-muted-foreground/0 transition-colors group-hover:text-primary" />
                  </p>
                  <p className="mt-4 font-display text-3xl font-semibold leading-none">{totalCollections}</p>
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                    {totalImages.toLocaleString()} images total
                  </p>
                </Link>

                {/* Engine */}
                <div className="relative overflow-hidden bg-card/80 p-5 backdrop-blur-xl">
                  <p className="aura-microlabel">Aura engine</p>
                  <div className="mt-4 flex items-center gap-4">
                    <Orb className="h-12 w-12 shrink-0" />
                    <div className="min-w-0">
                      {engineQueue.length > 0 ? (
                        <>
                          <p className="font-display text-lg font-semibold leading-none text-primary">
                            {engineQueue.length} {engineQueue.length === 1 ? "job" : "jobs"}
                          </p>
                          <p className="mt-1 font-mono text-[11px] text-muted-foreground">working now</p>
                        </>
                      ) : (
                        <>
                          <p className="inline-flex items-center gap-1.5 font-display text-base font-semibold leading-none">
                            <span className="aura-led aura-led-pulse" style={{ "--led": "var(--secondary)" } as CSSProperties} /> Idle
                          </p>
                          <p className="mt-1 font-mono text-[11px] text-muted-foreground">ready when you are</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.section>

            {/* ════ WORK AREA — photos left (hero), studio rail right ══════ */}
            <div className="grid gap-6 xl:grid-cols-[1.7fr,1fr] xl:items-start">
              {/* ── Left column: the engine queue + the photo wall ── */}
              <div className="space-y-6">
                {/* Engine queue (only when something is processing) */}
                {engineQueue.length > 0 && (
                  <motion.section variants={rise}>
                    <p className="aura-microlabel mb-3">Aura is working on</p>
                    <div className="overflow-hidden rounded-3xl border border-border/60 bg-card/55 backdrop-blur-xl">
                      {engineQueue.map((job, i) => (
                        <Link
                          key={job.id}
                          to={`/dashboard/galleries/${job.id}`}
                          className={cn(
                            "flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-foreground/[0.03]",
                            i !== engineQueue.length - 1 && "border-b border-border/40",
                          )}
                        >
                          <div className="h-11 w-16 shrink-0 overflow-hidden rounded-xl bg-muted">
                            {job.heroUrl ? (
                              <img src={getThumbnailUrl(job.heroUrl)} alt="" className="h-full w-full object-cover opacity-90" />
                            ) : (
                              <div className="grid h-full w-full place-items-center">
                                <Images className="h-4 w-4 text-muted-foreground/40" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{job.name}</p>
                            <p className="font-mono text-[11px] text-muted-foreground">{job.detail}</p>
                          </div>
                          <div className="hidden w-40 sm:block">
                            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-[image:var(--gradient-primary)] shadow-[0_0_10px_hsl(var(--glow-primary)/0.5)]"
                                style={{ width: `${job.pct}%` }}
                              />
                            </div>
                          </div>
                          <span className="w-11 text-right font-mono text-xs text-primary">{job.pct}%</span>
                        </Link>
                      ))}
                    </div>
                  </motion.section>
                )}

                {/* Recent collections — the photo wall is the hero */}
                <motion.section variants={rise}>
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="font-display text-lg font-semibold tracking-tight">Recent collections</h2>
                    <Link
                      to="/dashboard/galleries"
                      className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-primary"
                    >
                      View all <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>

                  <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                    {galleries.map((gallery) => {
                      const pct =
                        gallery.total_images > 0
                          ? Math.round((gallery.processed_images / gallery.total_images) * 100)
                          : 0;
                      const isReady = gallery.status === "ready";
                      const isError = gallery.status === "error";
                      const ledColor = isReady
                        ? "var(--secondary)"
                        : isError
                          ? "var(--destructive)"
                          : "var(--rating)";
                      return (
                        <Link key={gallery.id} to={`/dashboard/galleries/${gallery.id}`} className="group">
                          <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/55 backdrop-blur-xl transition-[transform,border-color,box-shadow] duration-200 [transition-timing-function:cubic-bezier(0.2,0,0,1)] hover:-translate-y-1 hover:border-primary/50 hover:shadow-[0_0_44px_-12px_hsl(var(--glow-primary)/0.4)]">
                            <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                              {gallery.hero_image_url ? (
                                <img
                                  src={getThumbnailUrl(gallery.hero_image_url)}
                                  alt={gallery.name}
                                  className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                                  onError={(e) => {
                                    const t = e.currentTarget;
                                    if (t.src !== gallery.hero_image_url) t.src = gallery.hero_image_url!;
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
                                style={{ color: `hsl(${ledColor})` }}
                              >
                                <span className="aura-led aura-led-pulse" style={{ "--led": ledColor } as CSSProperties} />
                                {isReady ? "Ready" : isError ? "Error" : "Processing"}
                              </span>
                              {!isReady && !isError && pct > 0 && (
                                <span className="absolute right-3 top-3 rounded-full bg-background/70 px-2 py-1 font-mono text-[10px] text-primary backdrop-blur-md">
                                  {pct}%
                                </span>
                              )}
                            </div>
                            <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                              <p className="truncate text-sm font-medium transition-colors group-hover:text-primary">
                                {gallery.name}
                              </p>
                              <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                                {(gallery.total_images || 0).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </motion.section>
              </div>

              {/* ── Right column: the studio rail (usage + shortcuts) ── */}
              <motion.aside variants={rise} className="space-y-6 xl:sticky xl:top-6">
                <div>
                  <p className="aura-microlabel mb-3">Usage</p>
                  <Suspense fallback={<div className="h-64 rounded-3xl border border-border/60 bg-card/50" />}>
                    <CreditsUsageChart />
                  </Suspense>
                </div>

                <div>
                  <p className="aura-microlabel mb-3">Quick actions</p>
                  <div className="space-y-3">
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
                              title: "Need more edits?",
                              body: "Upgrade for unlimited edits, more storage and priority processing.",
                            },
                          ]
                        : []),
                    ].map((card) => (
                      <Link
                        key={card.to + card.title}
                        to={card.to}
                        className="group flex items-start gap-3 rounded-2xl border border-border/60 bg-card/55 p-4 backdrop-blur-xl transition-[border-color,transform] duration-200 [transition-timing-function:cubic-bezier(0.2,0,0,1)] hover:-translate-y-0.5 hover:border-primary/50"
                      >
                        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
                          <card.icon className="h-4.5 w-4.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold transition-colors group-hover:text-primary">{card.title}</p>
                          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{card.body}</p>
                        </div>
                        <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-primary" />
                      </Link>
                    ))}
                  </div>
                </div>
              </motion.aside>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
