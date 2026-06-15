import { useEffect } from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  ArrowUpRight,
  FolderPlus,
  Wand2,
  Share2,
  Disc3,
  ChevronRight,
  Aperture,
  Film,
  Zap,
  AlertTriangle,
} from "lucide-react";

/**
 * DARKROOM — a photographer's editing-suite dashboard.
 * Warm analog cinema. Self-contained. No app imports, no CSS vars, no tokens.
 * All colors explicit. Roboto Mono for instrument readouts, Archivo for headlines.
 */

// ---- palette (explicit hex, no tokens) ----
const C = {
  canvas: "#14100B",
  canvas2: "#191309",
  surface: "#211A12",
  border: "#3A2E1F",
  ink: "#ECE3D2",
  inkDim: "#9A8B72",
  amber: "#E9A23B",
  red: "#D2422A",
};

const MONO = "'Roboto Mono', ui-monospace, SFMono-Regular, Menlo, monospace";
const DISPLAY = "'Archivo', 'Inter', system-ui, sans-serif";

// ---- sample data (hardcoded) ----
const STATS = [
  { label: "AI EDITS LEFT", value: "1,240", sub: "/ 2,000", pct: 0.62 },
  { label: "STORAGE", value: "48.2", sub: "/ 100 GB", pct: 0.482 },
  { label: "COLLECTIONS", value: "12", sub: "TOTAL", pct: 1 },
  { label: "AURA ENGINE", value: "WORKING", sub: "● REC", rec: true },
];

const QUEUE = [
  {
    seed: "imgk5",
    name: "Lior & Maya — Engagement",
    pct: 68,
    done: 612,
    total: 900,
  },
  {
    seed: "imgk6",
    name: "Jaffa Port — Brand Story",
    pct: 31,
    done: 142,
    total: 460,
  },
];

type Status = "READY" | "DEVELOPING" | "ERROR";
const SHEET: {
  seed: string;
  frame: string;
  name: string;
  count: string;
  status: Status;
  meta: string;
}[] = [
  { seed: "imgk1", frame: "FRAME 01", name: "Cohen Wedding", count: "842 FRAMES", status: "READY", meta: "ISO 400 · ƒ/2.8 · 1/250" },
  { seed: "imgk2", frame: "FRAME 02", name: "Tel Aviv Editorial", count: "318 FRAMES", status: "READY", meta: "ISO 200 · ƒ/4.0 · 1/500" },
  { seed: "imgk3", frame: "FRAME 03", name: "Lior & Maya", count: "612 FRAMES", status: "DEVELOPING", meta: "ISO 800 · ƒ/1.8 · 1/125" },
  { seed: "imgk4", frame: "FRAME 04", name: "Desert Sessions", count: "204 FRAMES", status: "READY", meta: "ISO 100 · ƒ/8.0 · 1/200" },
  { seed: "imgk5", frame: "FRAME 05", name: "Jaffa Port Story", count: "460 FRAMES", status: "DEVELOPING", meta: "ISO 640 · ƒ/2.0 · 1/320" },
  { seed: "imgk6", frame: "FRAME 06", name: "Studio Headshots", count: "96 FRAMES", status: "ERROR", meta: "ISO 320 · ƒ/5.6 · 1/160" },
];

const QUICK = [
  { icon: FolderPlus, label: "New collection" },
  { icon: Wand2, label: "Train an AI style" },
  { icon: Share2, label: "Share a gallery" },
];

// ---- small parts ----
function StatusChip({ status }: { status: Status }) {
  if (status === "READY")
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-[10px] tracking-[0.18em]"
        style={{ fontFamily: MONO, color: C.amber, background: "rgba(233,162,59,0.10)", border: `1px solid rgba(233,162,59,0.35)` }}
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: C.amber }} />
        READY
      </span>
    );
  if (status === "DEVELOPING")
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-[10px] tracking-[0.18em]"
        style={{ fontFamily: MONO, color: C.red, background: "rgba(210,66,42,0.12)", border: `1px solid rgba(210,66,42,0.40)` }}
      >
        <motion.span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: C.red }}
          animate={{ opacity: [1, 0.25, 1] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        />
        DEVELOPING
      </span>
    );
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-[10px] tracking-[0.18em]"
      style={{ fontFamily: MONO, color: "#E07A5F", background: "rgba(210,66,42,0.08)", border: `1px solid rgba(210,66,42,0.30)` }}
    >
      <AlertTriangle className="h-3 w-3" />
      ERROR
    </span>
  );
}

// sprocket-holed film strip edge
function Sprockets({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`} aria-hidden>
      {Array.from({ length: 14 }).map((_, i) => (
        <span
          key={i}
          className="h-2.5 w-3.5 rounded-[2px] shrink-0"
          style={{ background: C.canvas, border: `1px solid ${C.border}` }}
        />
      ))}
    </div>
  );
}

export default function DarkroomDashboard() {
  // inject Archivo + Roboto Mono at runtime so the page is self-contained
  useEffect(() => {
    const id = "darkroom-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800;900&family=Roboto+Mono:wght@400;500;600&display=swap";
    document.head.appendChild(link);
  }, []);

  return (
    <div
      className="relative min-h-screen w-full overflow-x-hidden"
      style={{
        background: `radial-gradient(1200px 700px at 78% -8%, rgba(233,162,59,0.10), transparent 60%), radial-gradient(900px 600px at 12% 8%, rgba(210,66,42,0.06), transparent 55%), linear-gradient(${C.canvas}, ${C.canvas2})`,
        color: C.ink,
        fontFamily: DISPLAY,
      }}
    >
      {/* film grain overlay — fixed, full page, low opacity */}
      <div
        className="pointer-events-none fixed inset-0 z-50 mix-blend-overlay"
        style={{
          opacity: 0.10,
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>\")",
        }}
      />
      {/* vignette */}
      <div
        className="pointer-events-none fixed inset-0 z-40"
        style={{ boxShadow: "inset 0 0 240px 60px rgba(0,0,0,0.55)" }}
      />

      <div className="relative z-10 mx-auto w-full max-w-[1180px] px-5 py-7 sm:px-8 sm:py-10">
        {/* ===== Masthead ===== */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div
              className="flex items-center gap-3 text-[11px] tracking-[0.28em]"
              style={{ fontFamily: MONO, color: C.inkDim }}
            >
              <span>MON 15 JUN 2026 · STUDIO</span>
              <span
                className="rounded-sm px-2 py-0.5"
                style={{ color: C.amber, border: `1px solid rgba(233,162,59,0.35)` }}
              >
                STUDIO PLAN
              </span>
            </div>
            <div className="mt-3 flex items-center gap-2.5">
              <Aperture className="h-5 w-5" style={{ color: C.amber }} />
              <span
                className="text-[15px] font-semibold tracking-tight"
                style={{ color: C.ink }}
              >
                imagick<span style={{ color: C.amber }}>.ai</span>
              </span>
            </div>
            <h1
              className="mt-5 text-[40px] font-extrabold leading-[0.95] tracking-[-0.02em] sm:text-[56px]"
              style={{ fontFamily: DISPLAY, color: C.ink }}
            >
              Good evening, <span style={{ color: C.amber }}>Nate</span>.
            </h1>
          </div>

          {/* little light-meter dial */}
          <div
            className="hidden items-center gap-3 rounded-md px-4 py-3 sm:flex"
            style={{ background: C.surface, border: `1px solid ${C.border}` }}
          >
            <div className="relative h-12 w-12">
              <svg viewBox="0 0 48 48" className="h-12 w-12 -rotate-90">
                <circle cx="24" cy="24" r="20" fill="none" stroke={C.border} strokeWidth="3" />
                <motion.circle
                  cx="24" cy="24" r="20" fill="none" stroke={C.amber} strokeWidth="3"
                  strokeDasharray={2 * Math.PI * 20} strokeLinecap="round"
                  initial={{ strokeDashoffset: 2 * Math.PI * 20 }}
                  animate={{ strokeDashoffset: 2 * Math.PI * 20 * (1 - 0.62) }}
                  transition={{ duration: 1.2, ease: "easeOut" }}
                />
              </svg>
              <Zap className="absolute inset-0 m-auto h-4 w-4" style={{ color: C.amber }} />
            </div>
            <div style={{ fontFamily: MONO }}>
              <div className="text-[10px] tracking-[0.2em]" style={{ color: C.inkDim }}>
                EXPOSURE
              </div>
              <div className="text-[13px]" style={{ color: C.ink }}>
                EV +0.7 · ƒ/2.8
              </div>
            </div>
          </div>
        </header>

        {/* ===== Aura command bar ===== */}
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="mt-8 rounded-xl p-4 sm:p-5"
          style={{
            background: `linear-gradient(${C.surface}, ${C.canvas2})`,
            border: `1px solid ${C.border}`,
            boxShadow: "0 24px 60px -30px rgba(0,0,0,0.8)",
          }}
        >
          <div
            className="flex items-center gap-3 rounded-lg px-4 py-3"
            style={{ background: C.canvas, border: `1px solid ${C.border}` }}
          >
            <span
              className="grid h-8 w-8 shrink-0 place-items-center rounded-md"
              style={{ background: "rgba(233,162,59,0.12)", border: `1px solid rgba(233,162,59,0.4)` }}
            >
              <Sparkles className="h-4 w-4" style={{ color: C.amber }} />
            </span>
            <span className="flex-1 text-[15px]" style={{ color: C.inkDim }}>
              Ask Aura to cull, edit, or prep a shoot…
            </span>
            <span
              className="grid h-9 w-9 place-items-center rounded-md"
              style={{ background: C.amber, color: C.canvas }}
            >
              <ArrowUpRight className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {QUICK.map((q) => (
              <button
                key={q.label}
                className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-[12px] transition-colors"
                style={{
                  fontFamily: MONO,
                  color: C.ink,
                  background: C.canvas,
                  border: `1px solid ${C.border}`,
                }}
              >
                <q.icon className="h-3.5 w-3.5" style={{ color: C.amber }} />
                {q.label}
              </button>
            ))}
          </div>
        </motion.section>

        {/* ===== Light-meter ledger (stats) ===== */}
        <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {STATS.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 * i, ease: "easeOut" }}
              className="relative overflow-hidden rounded-lg p-4"
              style={{ background: C.surface, border: `1px solid ${C.border}` }}
            >
              <div className="flex items-center justify-between">
                <span
                  className="text-[10px] tracking-[0.2em]"
                  style={{ fontFamily: MONO, color: C.inkDim }}
                >
                  {s.label}
                </span>
                {s.rec && (
                  <motion.span
                    className="h-2 w-2 rounded-full"
                    style={{ background: C.red, boxShadow: `0 0 10px ${C.red}` }}
                    animate={{ opacity: [1, 0.2, 1] }}
                    transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
                  />
                )}
              </div>
              <div className="mt-3 flex items-baseline gap-1.5">
                <span
                  className="text-[30px] font-bold leading-none"
                  style={{ fontFamily: MONO, color: s.rec ? C.red : C.ink }}
                >
                  {s.value}
                </span>
                <span
                  className="text-[12px]"
                  style={{ fontFamily: MONO, color: C.inkDim }}
                >
                  {s.sub}
                </span>
              </div>
              {typeof s.pct === "number" && !s.rec && (
                <div
                  className="mt-3 h-1 w-full overflow-hidden rounded-full"
                  style={{ background: C.canvas }}
                >
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: C.amber }}
                    initial={{ width: 0 }}
                    animate={{ width: `${s.pct * 100}%` }}
                    transition={{ duration: 1, delay: 0.1 * i, ease: "easeOut" }}
                  />
                </div>
              )}
            </motion.div>
          ))}
        </section>

        {/* ===== AI briefing note ===== */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-6 flex flex-col gap-4 rounded-xl p-5 sm:flex-row sm:items-center sm:justify-between"
          style={{
            background: "rgba(233,162,59,0.05)",
            border: `1px solid rgba(233,162,59,0.25)`,
          }}
        >
          <div className="flex items-start gap-3">
            <span
              className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full"
              style={{ background: "rgba(233,162,59,0.12)", border: `1px solid rgba(233,162,59,0.4)` }}
            >
              <Sparkles className="h-4 w-4" style={{ color: C.amber }} />
            </span>
            <div>
              <p className="text-[15px] leading-snug" style={{ color: C.ink }}>
                <span style={{ color: C.amber }}>Cohen Wedding</span> is finished and
                ready to deliver.{" "}
                <a
                  href="#"
                  className="underline underline-offset-4"
                  style={{ color: C.amber }}
                >
                  Open it
                </a>
                .
              </p>
              <p
                className="mt-1 text-[12px] tracking-[0.08em]"
                style={{ fontFamily: MONO, color: C.inkDim }}
              >
                I&apos;m developing 2 collections right now.
              </p>
            </div>
          </div>
          <span
            className="inline-flex items-center gap-2 self-start rounded-md px-3 py-1.5 text-[11px] tracking-[0.18em] sm:self-auto"
            style={{ fontFamily: MONO, color: C.amber, border: `1px solid rgba(233,162,59,0.35)` }}
          >
            AURA BRIEFING
          </span>
        </motion.section>

        {/* ===== Engine queue — ON THE DRUM ===== */}
        <section className="mt-9">
          <div className="flex items-center justify-between">
            <h2
              className="flex items-center gap-2 text-[13px] tracking-[0.28em]"
              style={{ fontFamily: MONO, color: C.inkDim }}
            >
              <Disc3 className="h-4 w-4" style={{ color: C.red }} />
              ON THE DRUM
            </h2>
            <span
              className="inline-flex items-center gap-1.5 text-[11px] tracking-[0.2em]"
              style={{ fontFamily: MONO, color: C.red }}
            >
              <motion.span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: C.red }}
                animate={{ opacity: [1, 0.2, 1] }}
                transition={{ duration: 1.1, repeat: Infinity }}
              />
              PROCESSING
            </span>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {QUEUE.map((q, i) => (
              <motion.div
                key={q.seed}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.45, delay: 0.08 * i, ease: "easeOut" }}
                className="flex items-center gap-4 rounded-xl p-3"
                style={{ background: C.surface, border: `1px solid ${C.border}` }}
              >
                <div
                  className="relative h-[72px] w-[88px] shrink-0 overflow-hidden rounded-md"
                  style={{ border: `1px solid ${C.border}` }}
                >
                  <img
                    src={`https://picsum.photos/seed/${q.seed}/600/750`}
                    alt={q.name}
                    className="h-full w-full object-cover"
                    style={{ filter: "saturate(1.05) brightness(0.92)" }}
                  />
                  <div
                    className="absolute inset-0"
                    style={{ background: "linear-gradient(rgba(210,66,42,0.18), transparent)" }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-semibold" style={{ color: C.ink }}>
                    {q.name}
                  </div>
                  <div
                    className="mt-1 text-[11px] tracking-[0.12em]"
                    style={{ fontFamily: MONO, color: C.inkDim }}
                  >
                    {q.pct}% · {q.done}/{q.total} FRAMES
                  </div>
                  <div
                    className="mt-2 h-1.5 w-full overflow-hidden rounded-full"
                    style={{ background: C.canvas }}
                  >
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: `linear-gradient(90deg, ${C.red}, ${C.amber})` }}
                      initial={{ width: 0 }}
                      animate={{ width: `${q.pct}%` }}
                      transition={{ duration: 1.1, delay: 0.1 * i, ease: "easeOut" }}
                    />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ===== Contact sheet ===== */}
        <section className="mt-10">
          <div className="flex items-center justify-between">
            <h2
              className="flex items-center gap-2 text-[13px] tracking-[0.28em]"
              style={{ fontFamily: MONO, color: C.inkDim }}
            >
              <Film className="h-4 w-4" style={{ color: C.amber }} />
              CONTACT SHEET · RECENT
            </h2>
            <a
              href="#"
              className="inline-flex items-center gap-1 text-[11px] tracking-[0.2em]"
              style={{ fontFamily: MONO, color: C.amber }}
            >
              VIEW ALL <ChevronRight className="h-3.5 w-3.5" />
            </a>
          </div>

          {/* film strip top edge */}
          <div
            className="mt-4 rounded-t-lg px-3 pt-2"
            style={{ background: C.canvas2, borderTop: `1px solid ${C.border}`, borderLeft: `1px solid ${C.border}`, borderRight: `1px solid ${C.border}` }}
          >
            <Sprockets />
          </div>

          <div
            className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3"
            style={{
              background: C.canvas2,
              borderLeft: `1px solid ${C.border}`,
              borderRight: `1px solid ${C.border}`,
            }}
          >
            {SHEET.map((f, i) => (
              <motion.figure
                key={f.seed}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.04 * i, ease: "easeOut" }}
                className="group relative overflow-hidden rounded-md p-2"
                style={{ background: C.surface, border: `1px solid ${C.border}` }}
              >
                {/* light-table glow behind thumb */}
                <div
                  className="pointer-events-none absolute inset-x-2 top-2 z-0 h-[68%] rounded"
                  style={{ boxShadow: "0 0 60px 6px rgba(233,162,59,0.18)" }}
                />
                <div
                  className="relative z-10 overflow-hidden rounded"
                  style={{ border: `1px solid ${C.border}` }}
                >
                  <img
                    src={`https://picsum.photos/seed/${f.seed}/600/750`}
                    alt={f.name}
                    className="aspect-[4/5] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    style={{ filter: "saturate(1.08) contrast(1.02) brightness(0.95)" }}
                  />
                  {/* tick marks corner */}
                  <div className="absolute left-1.5 top-1.5 flex gap-0.5" aria-hidden>
                    {Array.from({ length: 4 }).map((_, t) => (
                      <span key={t} className="h-2 w-px" style={{ background: "rgba(236,227,210,0.6)" }} />
                    ))}
                  </div>
                  <div
                    className="absolute left-1.5 bottom-1.5 rounded-sm px-1.5 py-0.5 text-[9px] tracking-[0.16em]"
                    style={{ fontFamily: MONO, color: C.amber, background: "rgba(20,16,11,0.78)" }}
                  >
                    {f.frame}
                  </div>
                </div>

                <figcaption className="relative z-10 mt-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-semibold" style={{ color: C.ink }}>
                        {f.name}
                      </div>
                      <div
                        className="mt-0.5 text-[10px] tracking-[0.12em]"
                        style={{ fontFamily: MONO, color: C.inkDim }}
                      >
                        {f.count}
                      </div>
                    </div>
                    <StatusChip status={f.status} />
                  </div>
                  <div
                    className="mt-2 text-[10px] tracking-[0.1em]"
                    style={{ fontFamily: MONO, color: C.inkDim }}
                  >
                    {f.meta}
                  </div>
                </figcaption>
              </motion.figure>
            ))}
          </div>

          {/* film strip bottom edge */}
          <div
            className="rounded-b-lg px-3 pb-2 pt-1"
            style={{ background: C.canvas2, borderBottom: `1px solid ${C.border}`, borderLeft: `1px solid ${C.border}`, borderRight: `1px solid ${C.border}` }}
          >
            <Sprockets />
          </div>
        </section>

        {/* ===== footer readout ===== */}
        <footer
          className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t pt-5 text-[10px] tracking-[0.2em]"
          style={{ fontFamily: MONO, color: C.inkDim, borderColor: C.border }}
        >
          <span>DARKROOM · IMAGICK.AI EDITING SUITE</span>
          <span>TC 00:18:42:11 · SAFELIGHT ON</span>
        </footer>
      </div>
    </div>
  );
}
