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

// ATELIER motion — calm fades only, like turning a page. No bounce, no float.
const EASE: [number, number, number, number] = [0.22, 0.61, 0.36, 1];
const deck = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};
const rise = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
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
    <div className="relative min-h-full bg-background px-5 py-8 lg:px-12 lg:py-12">
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
        className="relative mx-auto w-full max-w-[1280px]"
      >
        {/* ════ 1 · MASTHEAD ══════════════════════════════════════════════
            A magazine cover head: a tracked-mono dateline + plan on one
            hairline row, then a very large Fraunces greeting, then a rule. */}
        <motion.header variants={rise}>
          <div className="flex items-baseline justify-between gap-4 pb-3">
            <span className="caption">{todayLabel()}</span>
            {currentPlan && (
              <span className="caption flex items-center gap-1.5 text-foreground">
                <Zap className="h-3 w-3 text-accent" />
                {currentPlan.name}
              </span>
            )}
          </div>
          <hr className="aura-hairline" />
          <h1 className="mt-7 font-display text-4xl font-semibold leading-[1.02] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            {getGreeting()},{" "}
            <span className="italic text-accent">{userName}</span>
          </h1>
          <hr className="aura-hairline mt-7" />
        </motion.header>

        {/* ════ 2 · THE EDITOR'S DESK (Aura command bar) ═════════════════
            A quiet full-width input on a hairline, the Orb seal on the
            left, a vermilion focus underline, quick actions as links. */}
        <motion.section variants={rise} className="mt-7">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              openAuraCommand(promptText);
              setPromptText("");
            }}
            className="group/desk relative"
          >
            <div className="flex items-center gap-4 pb-3">
              <Orb className="h-7 w-7 shrink-0" />
              <input
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                className="min-w-0 flex-1 bg-transparent font-sans text-base text-foreground outline-none placeholder:text-muted-foreground/80 sm:text-lg"
                placeholder="Ask the editor — find a collection, start one, train a style…   (⌘K)"
                aria-label="Ask Aura"
              />
              <button
                type="submit"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-[--radius] bg-primary text-primary-foreground transition-opacity duration-200 [transition-timing-function:cubic-bezier(0.22,0.61,0.36,1)] hover:opacity-90 active:opacity-100"
                aria-label="Send to Aura"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            {/* Hairline with a vermilion focus underline */}
            <div className="relative h-px w-full bg-border">
              <span className="absolute inset-y-0 left-0 w-0 bg-accent transition-[width] duration-300 [transition-timing-function:cubic-bezier(0.22,0.61,0.36,1)] group-focus-within/desk:w-full" />
            </div>
          </form>

          {/* Quick actions — small underlined editorial links, not chips */}
          <div className="mt-4 flex flex-wrap items-center gap-x-7 gap-y-2">
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
        </motion.section>

        {galleriesLoading ? (
          <div className="flex items-center justify-center py-32">
            <Orb className="h-12 w-12" />
          </div>
        ) : isEmpty ? (
          /* ════ 7 · EMPTY STATE — an editorial title page ════════════════ */
          <motion.div variants={rise} className="mt-16">
            <span className="folio block text-6xl text-accent sm:text-7xl">01</span>
            <h2 className="mt-4 max-w-2xl font-display text-3xl font-semibold leading-[1.05] tracking-tight sm:text-4xl">
              Your studio is set. The first <span className="italic text-accent">plate</span> is yours to print.
            </h2>
            <p className="mt-5 max-w-lg font-sans text-base leading-relaxed text-muted-foreground">
              Upload a shoot and the editor culls it, retouches it in your style, and hands you a
              gallery to deliver. It starts with one collection.
            </p>

            <hr className="aura-hairline mt-10" />
            <ol className="grid gap-px overflow-hidden border-x border-b border-border sm:grid-cols-3">
              {[
                { icon: Images, title: "Upload", body: "Drop a full shoot — RAW or JPEG." },
                { icon: Sparkles, title: "Enhance", body: "Aura scores, culls and retouches." },
                { icon: Share2, title: "Deliver", body: "Share a gallery, no account needed." },
              ].map((s, i) => (
                <li key={s.title} className="bg-card p-6">
                  <div className="flex items-baseline gap-3">
                    <span className="folio text-2xl text-accent">0{i + 1}</span>
                    <s.icon className="h-4 w-4 text-foreground/70" />
                  </div>
                  <p className="mt-4 font-display text-xl font-semibold tracking-tight">{s.title}</p>
                  <p className="mt-1.5 font-sans text-sm leading-relaxed text-muted-foreground">
                    {s.body}
                  </p>
                </li>
              ))}
            </ol>

            <Link
              to="/dashboard/galleries/new"
              className="mt-10 inline-flex items-center gap-2 rounded-[--radius] bg-primary px-7 py-3.5 font-sans text-sm font-semibold text-primary-foreground transition-opacity duration-200 [transition-timing-function:cubic-bezier(0.22,0.61,0.36,1)] hover:opacity-90"
            >
              <Plus className="h-4 w-4" /> Create your first collection
            </Link>
          </motion.div>
        ) : (
          <>
            {/* ════ 3 · THE LEDGER (telemetry) ════════════════════════════
                A single horizontal row of editorial stats, separated by
                hairline dividers. Big Fraunces numerals over caption labels.
                Not glowing cards. */}
            <motion.section variants={rise} className="mt-14">
              <div className="flex items-baseline justify-between pb-4">
                <span className="aura-microlabel">The ledger</span>
                <span className="caption">Studio telemetry</span>
              </div>
              <hr className="aura-hairline" />
              <div className="grid grid-cols-2 divide-border md:grid-cols-4 md:divide-x">
                {/* AI edits remaining */}
                <div className="border-b border-border py-7 pr-6 md:border-b-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-display text-4xl font-semibold leading-none tracking-tight sm:text-5xl">
                        {isUnlimited ? "∞" : editsRemaining.toLocaleString()}
                      </p>
                      <p className="caption mt-3 flex items-center gap-1.5">
                        {hasGiftCredits ? <Gift className="h-3 w-3" /> : <Zap className="h-3 w-3" />}
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
                </div>

                {/* Storage */}
                <div className="border-b border-border py-7 md:border-b-0 md:px-6">
                  <p className="font-display text-4xl font-semibold leading-none tracking-tight sm:text-5xl">
                    {formatStorage(storageUsedMb)}
                  </p>
                  <p className="caption mt-3 flex items-center gap-1.5">
                    <HardDrive className="h-3 w-3" /> Storage
                  </p>
                  <p className="mt-1.5 font-mono text-[11px] text-muted-foreground">
                    of {maxStorageGb} GB
                  </p>
                  <div className="mt-3 h-px w-full bg-border">
                    <div
                      className="h-px bg-accent"
                      style={{ width: `${Math.min(100, storagePercent)}%` }}
                    />
                  </div>
                </div>

                {/* Collections */}
                <Link
                  to="/dashboard/galleries"
                  className="group py-7 pr-6 md:px-6"
                >
                  <p className="flex items-baseline gap-2 font-display text-4xl font-semibold leading-none tracking-tight sm:text-5xl">
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
                <div className="py-7 md:px-6">
                  {engineQueue.length > 0 ? (
                    <p className="font-display text-4xl font-semibold leading-none tracking-tight text-accent sm:text-5xl">
                      {engineQueue.length}
                    </p>
                  ) : (
                    <p className="font-display text-4xl font-semibold leading-none tracking-tight sm:text-5xl">
                      Idle
                    </p>
                  )}
                  <p className="caption mt-3 flex items-center gap-1.5">
                    <span
                      className="aura-led aura-led-pulse"
                      style={
                        {
                          "--led": engineQueue.length > 0 ? "var(--accent)" : "var(--secondary)",
                        } as CSSProperties
                      }
                    />
                    Aura engine
                  </p>
                  <p className="mt-1.5 font-mono text-[11px] text-muted-foreground">
                    {engineQueue.length > 0
                      ? `${engineQueue.length === 1 ? "job" : "jobs"} working now`
                      : "ready when you are"}
                  </p>
                </div>
              </div>
              <hr className="aura-hairline" />
            </motion.section>

            {/* ════ 4 · STUDIO NOTES (Aura briefing) ══════════════════════
                Up to two italic-Fraunces notes, each prefixed by a small
                vermilion tick, with its action link. */}
            {briefing.length > 0 && (
              <motion.section variants={rise} className="mt-12">
                <div className="flex items-center gap-2.5 pb-5">
                  <Orb className="h-5 w-5" />
                  <span className="aura-microlabel">Studio notes — from the editor</span>
                </div>
                <div className="space-y-5">
                  {briefing.map((b) => (
                    <div key={b.key} className="flex items-start gap-4">
                      <span className="mt-2.5 h-2 w-2 shrink-0 bg-accent" aria-hidden="true" />
                      <p className="font-display text-xl italic leading-snug text-foreground sm:text-2xl">
                        {b.text}{" "}
                        <Link
                          to={b.to}
                          className="whitespace-nowrap font-sans text-sm not-italic text-accent underline decoration-accent/40 underline-offset-4 transition-colors hover:decoration-accent"
                        >
                          {b.label} →
                        </Link>
                      </p>
                    </div>
                  ))}
                </div>
              </motion.section>
            )}

            {/* ════ 5 · IN THE PRESS (engine queue) ═══════════════════════
                A tight list of in-progress galleries. */}
            {engineQueue.length > 0 && (
              <motion.section variants={rise} className="mt-14">
                <div className="flex items-baseline justify-between pb-4">
                  <span className="aura-microlabel">In the press</span>
                  <span className="caption">Aura is working on</span>
                </div>
                <hr className="aura-hairline" />
                <ul className="divide-y divide-border">
                  {engineQueue.map((job) => (
                    <li key={job.id}>
                      <Link
                        to={`/dashboard/galleries/${job.id}`}
                        className="group flex items-center gap-4 py-4 transition-colors hover:bg-foreground/[0.02]"
                      >
                        <div className="h-12 w-16 shrink-0 overflow-hidden bg-muted plate-keyline">
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
                          <p className="truncate font-display text-lg font-medium tracking-tight transition-colors group-hover:text-accent">
                            {job.name}
                          </p>
                          <p className="font-mono text-[11px] text-muted-foreground">{job.detail}</p>
                        </div>
                        <div className="hidden w-40 sm:block">
                          <div className="h-px w-full bg-border">
                            <div className="h-px bg-accent" style={{ width: `${job.pct}%` }} />
                          </div>
                        </div>
                        <span className="w-12 text-right font-mono text-sm text-accent">
                          {job.pct}%
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <hr className="aura-hairline" />
              </motion.section>
            )}

            {/* ════ 6 · RECENT COLLECTIONS — the photo wall ═══════════════
                A section folio + an editorial grid of matted PLATE cards. */}
            <motion.section variants={rise} className="mt-14">
              <div className="flex items-end justify-between pb-5">
                <div className="flex items-baseline gap-4">
                  <span className="folio text-3xl text-accent">01</span>
                  <span className="aura-microlabel">Collections</span>
                </div>
                <Link
                  to="/dashboard/galleries"
                  className="group inline-flex items-center gap-1.5 font-sans text-sm text-foreground/80 transition-colors hover:text-accent"
                >
                  <span className="underline decoration-border underline-offset-4 transition-colors group-hover:decoration-accent">
                    View all
                  </span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <hr className="aura-hairline mb-10" />

              <div className="grid grid-cols-1 gap-x-10 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
                {galleries.map((gallery, idx) => {
                  const pct =
                    gallery.total_images > 0
                      ? Math.round((gallery.processed_images / gallery.total_images) * 100)
                      : 0;
                  const isReady = gallery.status === "ready";
                  const isError = gallery.status === "error";
                  const statusLabel = isReady ? "Ready" : isError ? "Error" : "Processing";
                  // ready = botanical ink/secondary, error = destructive, processing = vermilion
                  const statusToken = isReady
                    ? "var(--secondary)"
                    : isError
                      ? "var(--destructive)"
                      : "var(--accent)";
                  return (
                    <Link key={gallery.id} to={`/dashboard/galleries/${gallery.id}`} className="group block">
                      {/* Matted plate */}
                      <div className="plate p-3 transition-shadow duration-300 [transition-timing-function:cubic-bezier(0.22,0.61,0.36,1)] group-hover:shadow-[var(--elevation-3)]">
                        <div className="relative aspect-[4/3] overflow-hidden bg-muted plate-keyline">
                          {gallery.hero_image_url ? (
                            <img
                              src={getThumbnailUrl(gallery.hero_image_url)}
                              alt={gallery.name}
                              className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
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
                          {!isReady && !isError && pct > 0 && (
                            <span className="absolute right-2 top-2 bg-background/85 px-1.5 py-0.5 font-mono text-[10px] text-accent backdrop-blur-sm">
                              {pct}%
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Gallery plate caption */}
                      <div className="mt-3.5 flex items-baseline justify-between gap-3 pl-0.5">
                        <span className="caption">Plate {String(idx + 1).padStart(2, "0")}</span>
                        <span
                          className="caption flex items-center gap-1.5"
                          style={{ color: `hsl(${statusToken})` }}
                        >
                          <span
                            className="aura-led"
                            style={{ "--led": statusToken } as CSSProperties}
                          />
                          {statusLabel}
                        </span>
                      </div>
                      <p className="mt-1 truncate font-display text-xl font-medium tracking-tight transition-colors group-hover:text-accent">
                        {gallery.name}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                        {(gallery.total_images || 0).toLocaleString()} images
                      </p>
                    </Link>
                  );
                })}
              </div>
            </motion.section>

            {/* ════ APPENDIX — usage chart + quick actions ════════════════
                Kept (restyled context): editorial appendix below the wall. */}
            <motion.section variants={rise} className="mt-16 grid gap-12 lg:grid-cols-[1.4fr,1fr] lg:items-start">
              <div>
                <div className="flex items-baseline gap-4 pb-5">
                  <span className="folio text-3xl text-accent">02</span>
                  <span className="aura-microlabel">Usage</span>
                </div>
                <hr className="aura-hairline mb-6" />
                <Suspense
                  fallback={<div className="h-64 border border-border bg-card" />}
                >
                  <CreditsUsageChart />
                </Suspense>
              </div>

              <div>
                <div className="flex items-baseline gap-4 pb-5">
                  <span className="folio text-3xl text-accent">03</span>
                  <span className="aura-microlabel">In the studio</span>
                </div>
                <hr className="aura-hairline" />
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
                            title: "Need more edits?",
                            body: "Upgrade for unlimited edits, more storage and priority processing.",
                          },
                        ]
                      : []),
                  ].map((card) => (
                    <li key={card.to + card.title}>
                      <Link
                        to={card.to}
                        className="group flex items-start gap-4 py-5 transition-colors hover:bg-foreground/[0.02]"
                      >
                        <card.icon className="mt-1 h-4 w-4 shrink-0 text-foreground/70 transition-colors group-hover:text-accent" />
                        <div className="min-w-0 flex-1">
                          <p className="font-display text-lg font-medium tracking-tight transition-colors group-hover:text-accent">
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
                <hr className="aura-hairline" />
              </div>
            </motion.section>
          </>
        )}
      </motion.div>
    </div>
  );
}
