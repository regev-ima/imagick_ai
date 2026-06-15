import { motion } from "framer-motion";
import {
  Search,
  Sparkles,
  FolderPlus,
  Wand2,
  Share2,
  Image as ImageIcon,
  HardDrive,
  Layers,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Loader2,
  AlertCircle,
} from "lucide-react";

/**
 * STUDIO — a bright, premium, photo-first brand workspace for photographers.
 * Self-contained design-comparison prototype. No app imports, no hooks, no data.
 * All colors are explicit hex / Tailwind arbitrary values (no CSS vars or tokens),
 * so it renders identically regardless of app light/dark mode.
 */

// ---- palette (explicit hex, no tokens) ----
const C = {
  royal: "#2B50F0",
  royalHover: "#1E40DA",
  indigo: "#5B3DF0",
  navy: "#0E1A3A",
  inkDim: "#5B6478",
  canvas: "#F5F7FC",
  card: "#FFFFFF",
  border: "#E2E7F2",
  ready: "#2B50F0",
  processing: "#D98A0B",
  error: "#E0354B",
};

// ---- AI sparkle mark (4-point star) ----
function Sparkle({
  size = 16,
  className = "",
  style,
}: {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path
        d="M12 1.5c.4 4.9 1.2 6.6 2.9 8.1 1.7 1.5 3.6 2.2 7.6 2.4-4 .2-5.9.9-7.6 2.4-1.7 1.5-2.5 3.2-2.9 8.1-.4-4.9-1.2-6.6-2.9-8.1C7.4 12.9 5.5 12.2 1.5 12c4-.2 5.9-.9 7.6-2.4C10.8 8.1 11.6 6.4 12 1.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

// ---- sample data ----
const STATS = [
  {
    icon: Wand2,
    label: "AI edits",
    value: "1,240",
    sub: "/ 2,000",
    ratio: 0.62,
    ai: true,
  },
  {
    icon: HardDrive,
    label: "Storage",
    value: "48.2",
    sub: "/ 100 GB",
    ratio: 0.482,
    ai: false,
  },
  {
    icon: Layers,
    label: "Collections",
    value: "12",
    sub: "active",
    ratio: null,
    ai: false,
  },
];

const QUEUE = [
  {
    name: "Tel Aviv Editorial",
    sub: "Color grading · 84 photos",
    pct: 72,
    seed: "imgk2",
  },
  {
    name: "Bar & Bat",
    sub: "AI culling · 311 photos",
    pct: 38,
    seed: "imgk3",
  },
];

type Status = "Ready" | "Processing" | "Error";

const COLLECTIONS: {
  name: string;
  count: string;
  status: Status;
  seed: string;
}[] = [
  { name: "Cohen Wedding", count: "642 photos", status: "Ready", seed: "imgk1" },
  { name: "Tel Aviv Editorial", count: "84 photos", status: "Processing", seed: "imgk2" },
  { name: "Bar & Bat", count: "311 photos", status: "Processing", seed: "imgk3" },
  { name: "Studio Portraits", count: "128 photos", status: "Ready", seed: "imgk4" },
  { name: "Levi Family", count: "96 photos", status: "Error", seed: "imgk5" },
  { name: "Golan Landscapes", count: "203 photos", status: "Ready", seed: "imgk6" },
];

const STATUS_STYLE: Record<
  Status,
  { fg: string; bg: string; dot: string }
> = {
  Ready: { fg: C.ready, bg: "#EAEEFE", dot: C.ready },
  Processing: { fg: "#9A6206", bg: "#FBF1DD", dot: C.processing },
  Error: { fg: C.error, bg: "#FCE9EC", dot: C.error },
};

// ---- motion presets ----
const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0 },
};

export default function StudioDashboard() {
  return (
    <div
      className="min-h-screen w-full font-sans antialiased"
      style={{ backgroundColor: C.canvas, color: C.navy }}
    >
      {/* ============ TOP BAR ============ */}
      <header
        className="sticky top-0 z-30 w-full border-b backdrop-blur-md"
        style={{ borderColor: C.border, backgroundColor: "rgba(245,247,252,0.82)" }}
      >
        <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-4 px-5 sm:px-8">
          {/* logo */}
          <div className="flex items-center gap-2.5">
            <div
              className="relative flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-sm"
              style={{ background: `linear-gradient(135deg, ${C.royal}, ${C.indigo})` }}
            >
              <span className="text-[15px] font-bold leading-none tracking-tight">Ai</span>
              <Sparkle size={11} className="absolute -right-1 -top-1 text-white drop-shadow" />
            </div>
            <span className="text-[19px] font-bold tracking-tight" style={{ color: C.navy }}>
              STUDIO
            </span>
          </div>

          {/* search */}
          <div className="ml-2 hidden flex-1 md:block">
            <div
              className="flex h-10 max-w-md items-center gap-2.5 rounded-xl border px-3.5"
              style={{ borderColor: C.border, backgroundColor: C.card }}
            >
              <Search size={16} style={{ color: C.inkDim }} />
              <span className="text-[13.5px]" style={{ color: C.inkDim }}>
                Search collections, clients, styles…
              </span>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-3">
            {/* Ask Aura pill */}
            <button
              className="group flex h-10 items-center gap-2 rounded-full px-4 text-[13.5px] font-semibold text-white shadow-sm transition-all hover:shadow-md"
              style={{ background: `linear-gradient(135deg, ${C.royal}, ${C.indigo})` }}
            >
              <Sparkle size={14} className="text-white" />
              Ask Aura
            </button>

            {/* avatar */}
            <div className="flex items-center gap-2.5">
              <div className="hidden text-right leading-tight sm:block">
                <div className="text-[13px] font-semibold" style={{ color: C.navy }}>
                  Nate
                </div>
                <div className="text-[11px]" style={{ color: C.inkDim }}>
                  Studio plan
                </div>
              </div>
              <div
                className="flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-bold text-white ring-2"
                style={{ background: `linear-gradient(135deg, ${C.navy}, ${C.royal})`, borderColor: C.card }}
              >
                N
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ============ MAIN ============ */}
      <main className="mx-auto max-w-[1280px] px-5 pb-24 pt-10 sm:px-8">
        {/* ---- Hero greeting ---- */}
        <motion.section
          initial="hidden"
          animate="show"
          variants={fadeUp}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <p
            className="mb-2 text-[13px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: C.royal }}
          >
            Sunday · June 15, 2026
          </p>
          <h1
            className="text-[34px] font-bold leading-[1.08] tracking-tight sm:text-[46px]"
            style={{ color: C.navy }}
          >
            Good evening, Nate
          </h1>
          <p className="mt-3 max-w-xl text-[15px]" style={{ color: C.inkDim }}>
            Your studio is humming. Aura finished one collection and is working on two more.
          </p>

          {/* Aura command bar */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: "easeOut", delay: 0.1 }}
            className="mt-7 rounded-3xl border p-2.5 shadow-[0_12px_40px_-18px_rgba(43,80,240,0.45)]"
            style={{ borderColor: C.border, backgroundColor: C.card }}
          >
            <div className="flex items-center gap-3 rounded-2xl px-4 py-3.5" style={{ backgroundColor: "#F8FAFF" }}>
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white"
                style={{ background: `linear-gradient(135deg, ${C.royal}, ${C.indigo})` }}
              >
                <Sparkle size={16} className="text-white" />
              </span>
              <span className="flex-1 text-[15px]" style={{ color: C.inkDim }}>
                Ask Aura to build a collection, train a style, or share a gallery…
              </span>
              <button
                className="hidden h-9 items-center gap-1.5 rounded-xl px-4 text-[13.5px] font-semibold text-white transition-colors sm:flex"
                style={{ backgroundColor: C.royal }}
              >
                Send
                <ArrowRight size={15} />
              </button>
            </div>

            {/* quick-action pills */}
            <div className="flex flex-wrap gap-2 px-2 pb-1 pt-3">
              {[
                { icon: FolderPlus, label: "New collection" },
                { icon: Wand2, label: "Train an AI style", ai: true },
                { icon: Share2, label: "Share a gallery" },
              ].map((p) => (
                <button
                  key={p.label}
                  className="flex items-center gap-2 rounded-full border px-3.5 py-2 text-[13px] font-medium transition-colors hover:border-[#C9D3F2]"
                  style={{ borderColor: C.border, color: C.navy, backgroundColor: C.card }}
                >
                  {p.ai ? (
                    <Sparkle size={13} style={{ color: C.royal }} />
                  ) : (
                    <p.icon size={14} style={{ color: C.royal }} />
                  )}
                  {p.label}
                </button>
              ))}
            </div>
          </motion.div>
        </motion.section>

        {/* ---- Stat row ---- */}
        <motion.section
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.07, delayChildren: 0.2 } } }}
          className="mt-7 grid grid-cols-2 gap-4 lg:grid-cols-4"
        >
          {STATS.map((s) => (
            <motion.div
              key={s.label}
              variants={fadeUp}
              transition={{ duration: 0.45, ease: "easeOut" }}
              className="rounded-2xl border p-5 shadow-[0_4px_18px_-12px_rgba(14,26,58,0.35)]"
              style={{ borderColor: C.border, backgroundColor: C.card }}
            >
              <div className="flex items-center justify-between">
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-xl"
                  style={{ backgroundColor: "#EAEEFE" }}
                >
                  <s.icon size={17} style={{ color: C.royal }} />
                </span>
                {s.ai && <Sparkle size={14} style={{ color: C.royal }} />}
              </div>
              <div className="mt-4 text-[13px] font-medium" style={{ color: C.inkDim }}>
                {s.label}
              </div>
              <div className="mt-0.5 flex items-baseline gap-1.5">
                <span className="text-[26px] font-bold tracking-tight" style={{ color: C.navy }}>
                  {s.value}
                </span>
                <span className="text-[13px] font-medium" style={{ color: C.inkDim }}>
                  {s.sub}
                </span>
              </div>
              {s.ratio !== null && (
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: "#EAEEFE" }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${s.ratio * 100}%` }}
                    transition={{ duration: 0.9, ease: "easeOut", delay: 0.35 }}
                    className="h-full rounded-full"
                    style={{ background: `linear-gradient(90deg, ${C.royal}, ${C.indigo})` }}
                  />
                </div>
              )}
            </motion.div>
          ))}

          {/* Aura engine status card */}
          <motion.div
            variants={fadeUp}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="rounded-2xl border p-5 shadow-[0_4px_18px_-12px_rgba(14,26,58,0.35)]"
            style={{ borderColor: C.border, backgroundColor: C.card }}
          >
            <div className="flex items-center justify-between">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={{ backgroundColor: "#EAEEFE" }}
              >
                <Sparkle size={16} style={{ color: C.royal }} />
              </span>
            </div>
            <div className="mt-4 text-[13px] font-medium" style={{ color: C.inkDim }}>
              Aura engine
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <motion.span
                  animate={{ opacity: [0.4, 1, 0.4], scale: [1, 1.5, 1] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute inline-flex h-full w-full rounded-full"
                  style={{ backgroundColor: C.royal }}
                />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ backgroundColor: C.royal }} />
              </span>
              <span className="text-[20px] font-bold tracking-tight" style={{ color: C.navy }}>
                Working
              </span>
            </div>
            <div className="mt-3 text-[12px]" style={{ color: C.inkDim }}>
              Processing 2 collections
            </div>
          </motion.div>
        </motion.section>

        {/* ---- AI briefing + Engine queue ---- */}
        <section className="mt-7 grid grid-cols-1 gap-5 lg:grid-cols-5">
          {/* AI briefing card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.25 }}
            className="relative overflow-hidden rounded-3xl border p-7 lg:col-span-3"
            style={{
              borderColor: "#CED9FB",
              background: "linear-gradient(135deg, #F4F7FF 0%, #EEF1FF 100%)",
            }}
          >
            <div
              className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full opacity-40 blur-2xl"
              style={{ background: `radial-gradient(circle, ${C.royal}, transparent 70%)` }}
            />
            <div className="relative">
              <div className="flex items-center gap-2">
                <Sparkle size={16} style={{ color: C.royal }} />
                <span
                  className="text-[12px] font-semibold uppercase tracking-[0.14em]"
                  style={{ color: C.royal }}
                >
                  Aura briefing
                </span>
              </div>
              <h2
                className="mt-4 max-w-md text-[24px] font-bold leading-snug tracking-tight"
                style={{ color: C.navy }}
              >
                Cohen Wedding is finished and ready to deliver.
              </h2>
              <p className="mt-2.5 max-w-sm text-[14px]" style={{ color: C.inkDim }}>
                642 photos culled, graded, and exported. I&apos;m working on 2 collections right
                now and will ping you the moment they&apos;re done.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  className="flex h-11 items-center gap-2 rounded-xl px-5 text-[14px] font-semibold text-white shadow-sm transition-colors"
                  style={{ backgroundColor: C.royal }}
                >
                  Open it
                  <ArrowRight size={16} />
                </button>
                <button
                  className="flex h-11 items-center gap-2 rounded-xl border bg-white px-5 text-[14px] font-semibold transition-colors"
                  style={{ borderColor: C.border, color: C.navy }}
                >
                  Review highlights
                </button>
              </div>
            </div>
          </motion.div>

          {/* Engine queue */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.3 }}
            className="rounded-3xl border p-6 lg:col-span-2"
            style={{ borderColor: C.border, backgroundColor: C.card }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-bold tracking-tight" style={{ color: C.navy }}>
                Engine queue
              </h3>
              <span className="flex items-center gap-1.5 text-[12px] font-medium" style={{ color: C.royal }}>
                <Sparkle size={12} style={{ color: C.royal }} />
                Live
              </span>
            </div>

            <div className="mt-5 space-y-5">
              {QUEUE.map((q) => (
                <div key={q.name} className="flex items-center gap-3.5">
                  <img
                    src={`https://picsum.photos/seed/${q.seed}/120/120`}
                    alt={q.name}
                    className="h-12 w-12 shrink-0 rounded-xl object-cover"
                    style={{ border: `1px solid ${C.border}` }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[13.5px] font-semibold" style={{ color: C.navy }}>
                        {q.name}
                      </span>
                      <span className="text-[12px] font-bold tabular-nums" style={{ color: C.royal }}>
                        {q.pct}%
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-[11.5px]" style={{ color: C.inkDim }}>
                      {q.sub}
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: "#EAEEFE" }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${q.pct}%` }}
                        transition={{ duration: 1, ease: "easeOut", delay: 0.45 }}
                        className="h-full rounded-full"
                        style={{ background: `linear-gradient(90deg, ${C.royal}, ${C.indigo})` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* ---- Recent collections ---- */}
        <section className="mt-12">
          <div className="mb-5 flex items-end justify-between">
            <div>
              <h2 className="text-[22px] font-bold tracking-tight" style={{ color: C.navy }}>
                Recent collections
              </h2>
              <p className="mt-1 text-[13.5px]" style={{ color: C.inkDim }}>
                Your latest galleries and shoots
              </p>
            </div>
            <button
              className="flex items-center gap-1 text-[13.5px] font-semibold transition-colors"
              style={{ color: C.royal }}
            >
              View all
              <ArrowUpRight size={16} />
            </button>
          </div>

          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            variants={{ show: { transition: { staggerChildren: 0.06 } } }}
            className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
          >
            {COLLECTIONS.map((col) => {
              const st = STATUS_STYLE[col.status];
              const StatusIcon =
                col.status === "Ready"
                  ? CheckCircle2
                  : col.status === "Processing"
                  ? Loader2
                  : AlertCircle;
              return (
                <motion.article
                  key={col.name}
                  variants={fadeUp}
                  transition={{ duration: 0.45, ease: "easeOut" }}
                  whileHover={{ y: -6 }}
                  className="group cursor-pointer overflow-hidden rounded-2xl border transition-shadow hover:shadow-[0_22px_50px_-22px_rgba(14,26,58,0.4)]"
                  style={{ borderColor: C.border, backgroundColor: C.card }}
                >
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <img
                      src={`https://picsum.photos/seed/${col.seed}/600/450`}
                      alt={col.name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                    />
                    <div
                      className="absolute inset-0"
                      style={{ background: "linear-gradient(to top, rgba(14,26,58,0.28), transparent 55%)" }}
                    />
                    {/* status pill */}
                    <span
                      className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold backdrop-blur"
                      style={{ backgroundColor: st.bg, color: st.fg }}
                    >
                      <StatusIcon
                        size={12}
                        className={col.status === "Processing" ? "animate-spin" : ""}
                        style={{ color: st.dot }}
                      />
                      {col.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 p-4">
                    <div className="min-w-0">
                      <h3 className="truncate text-[15px] font-bold tracking-tight" style={{ color: C.navy }}>
                        {col.name}
                      </h3>
                      <p className="mt-0.5 flex items-center gap-1.5 text-[12.5px]" style={{ color: C.inkDim }}>
                        <ImageIcon size={13} style={{ color: C.inkDim }} />
                        {col.count}
                      </p>
                    </div>
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors group-hover:bg-[#EAEEFE]"
                      style={{ color: C.royal }}
                    >
                      <ArrowUpRight size={17} />
                    </span>
                  </div>
                </motion.article>
              );
            })}
          </motion.div>
        </section>
      </main>
    </div>
  );
}
