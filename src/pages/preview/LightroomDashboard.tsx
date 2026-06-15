import { useEffect } from "react";
import { motion } from "framer-motion";
import {
  ChevronRight,
  ChevronDown,
  Search,
  HardDrive,
  Layers,
  FolderTree,
  Send,
  Star,
  Settings2,
  Maximize2,
  Sun,
} from "lucide-react";

/**
 * LIGHTROOM — a photographer's pro develop workspace, mocked.
 * Dark, precise, dense — Adobe Lightroom / Capture One feel.
 * Fully self-contained: no app imports, no hooks/data-fetching, no CSS vars/tokens.
 * Every color is an explicit hex. Identical regardless of app light/dark.
 */

// ---- palette (explicit hex only, Lightroom-like neutrals + royal blue) ----
const C = {
  blue: "#2B50F0", // primary / selection / AI
  blueGlow: "#3A63FF", // glow / hover on dark
  navy: "#0E1A3A",
  canvas: "#16171A",
  panel: "#1F2024",
  raised: "#26272C",
  border: "#33343A",
  ink: "#E8E9ED",
  dim: "#8A8C94",
  green: "#3FB46B",
  amber: "#E0A24B",
  red: "#E0564B",
};

const MONO = "'Roboto Mono', ui-monospace, SFMono-Regular, Menlo, monospace";
const SANS = "'Inter', system-ui, -apple-system, sans-serif";

// ---- The AI mark: a 4-point sparkle (the logo star) in royal blue ----
function Sparkle({
  size = 16,
  color = C.blue,
  className = "",
}: {
  size?: number;
  color?: string;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      style={{ display: "block" }}
    >
      {/* 4-point star: concave diamond */}
      <path
        d="M12 0 C12.9 7.2 16.8 11.1 24 12 C16.8 12.9 12.9 16.8 12 24 C11.1 16.8 7.2 12.9 0 12 C7.2 11.1 11.1 7.2 12 0 Z"
        fill={color}
      />
    </svg>
  );
}

// ---- sample data (hardcoded — mirrors the real dashboard) ----
const SLIDERS: { label: string; value: number; pos: number }[] = [
  { label: "Exposure", value: 0.35, pos: 0.62 },
  { label: "Contrast", value: 12, pos: 0.56 },
  { label: "Highlights", value: -28, pos: 0.36 },
  { label: "Shadows", value: 44, pos: 0.72 },
  { label: "Temp", value: 5500, pos: 0.5 },
];

type Status = "READY" | "PROCESSING" | "ERROR";
const FILMSTRIP: {
  seed: string;
  name: string;
  frames: string;
  status: Status;
  pct?: number;
}[] = [
  { seed: "imgk1", name: "Cohen Wedding", frames: "842", status: "READY" },
  { seed: "imgk2", name: "Tel Aviv Editorial", frames: "318", status: "PROCESSING", pct: 68 },
  { seed: "imgk3", name: "Bar & Bat", frames: "504", status: "READY" },
  { seed: "imgk4", name: "Studio Portraits", frames: "96", status: "PROCESSING", pct: 31 },
  { seed: "imgk5", name: "Levi Family", frames: "212", status: "READY" },
  { seed: "imgk6", name: "Golan Landscapes", frames: "188", status: "ERROR" },
];

const TREE: { label: string; depth: number; count?: string; active?: boolean; open?: boolean }[] = [
  { label: "Catalog", depth: 0, open: true },
  { label: "2026", depth: 1, open: true },
  { label: "Cohen Wedding", depth: 2, count: "842", active: true },
  { label: "Tel Aviv Editorial", depth: 2, count: "318" },
  { label: "Bar & Bat", depth: 2, count: "504" },
  { label: "2025", depth: 1 },
  { label: "Smart Collections", depth: 0 },
];

const STATUS_COLOR: Record<Status, string> = {
  READY: C.green,
  PROCESSING: C.amber,
  ERROR: C.red,
};

// ---- small parts ----
function ModuleTab({ label, active }: { label: string; active?: boolean }) {
  return (
    <button
      className="px-2.5 py-1 text-[11px] tracking-[0.22em] transition-colors"
      style={{
        fontFamily: MONO,
        color: active ? C.blueGlow : C.dim,
        fontWeight: active ? 600 : 500,
        borderBottom: active ? `2px solid ${C.blue}` : "2px solid transparent",
      }}
    >
      {label}
    </button>
  );
}

function PanelHeader({ icon, label }: { icon?: React.ReactNode; label: string }) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-2 text-[10px] tracking-[0.26em]"
      style={{
        fontFamily: MONO,
        color: C.dim,
        background: C.canvas,
        borderBottom: `1px solid ${C.border}`,
      }}
    >
      {icon}
      {label}
    </div>
  );
}

// fake RGB histogram drawn with SVG
function Histogram() {
  const W = 260;
  const H = 56;
  // three smooth-ish bell curves (R,G,B) as filled areas
  const curve = (peak: number, spread: number, amp: number) => {
    const pts: string[] = [`M 0 ${H}`];
    for (let x = 0; x <= W; x += 4) {
      const t = (x - peak) / spread;
      const y = H - amp * Math.exp(-t * t) * H;
      pts.push(`L ${x} ${y.toFixed(1)}`);
    }
    pts.push(`L ${W} ${H} Z`);
    return pts.join(" ");
  };
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      {/* faint grid */}
      {[0.25, 0.5, 0.75].map((g) => (
        <line key={g} x1={W * g} y1={0} x2={W * g} y2={H} stroke={C.border} strokeWidth="1" />
      ))}
      <path d={curve(70, 60, 0.85)} fill="rgba(224,86,75,0.30)" stroke="rgba(224,86,75,0.7)" strokeWidth="1" />
      <path d={curve(130, 70, 0.95)} fill="rgba(63,180,107,0.30)" stroke="rgba(63,180,107,0.7)" strokeWidth="1" />
      <path d={curve(180, 55, 0.78)} fill="rgba(43,80,240,0.34)" stroke="rgba(58,99,255,0.85)" strokeWidth="1" />
    </svg>
  );
}

function StatusDot({ status }: { status: Status }) {
  const col = STATUS_COLOR[status];
  if (status === "PROCESSING")
    return (
      <motion.span
        className="h-1.5 w-1.5 rounded-full shrink-0"
        style={{ background: col, boxShadow: `0 0 6px ${col}` }}
        animate={{ opacity: [1, 0.25, 1] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
      />
    );
  return (
    <span
      className="h-1.5 w-1.5 rounded-full shrink-0"
      style={{ background: col, boxShadow: `0 0 5px ${col}` }}
    />
  );
}

// a static develop slider row
function SliderRow({ label, value, pos, delay }: { label: string; value: number; pos: number; delay: number }) {
  return (
    <div className="px-3 py-2">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[12px]" style={{ color: C.ink }}>
          {label}
        </span>
        <span className="text-[11px]" style={{ fontFamily: MONO, color: C.dim }}>
          {value > 0 && label !== "Temp" ? "+" : ""}
          {value}
        </span>
      </div>
      <div className="relative h-[3px] w-full rounded-full" style={{ background: C.raised }}>
        {/* center tick */}
        <span className="absolute left-1/2 top-1/2 h-[7px] w-px -translate-x-1/2 -translate-y-1/2" style={{ background: C.border }} />
        <motion.span
          className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full"
          style={{
            left: `${pos * 100}%`,
            marginLeft: -6,
            background: C.blue,
            border: `2px solid ${C.canvas}`,
            boxShadow: `0 0 8px rgba(58,99,255,0.6)`,
          }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, delay, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

export default function LightroomDashboard() {
  // inject Inter + Roboto Mono at runtime so the page is fully self-contained
  useEffect(() => {
    const id = "lightroom-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Roboto+Mono:wght@400;500;600&display=swap";
    document.head.appendChild(link);
  }, []);

  return (
    <div
      className="flex h-screen w-screen flex-col overflow-hidden"
      style={{ background: C.canvas, color: C.ink, fontFamily: SANS }}
    >
      {/* ============================= TOP MODULE BAR ============================= */}
      <header
        className="flex h-12 shrink-0 items-center justify-between px-4"
        style={{ background: C.panel, borderBottom: `1px solid ${C.border}` }}
      >
        <div className="flex items-center gap-5">
          {/* app mark */}
          <div className="flex items-center gap-2">
            <Sparkle size={18} color={C.blue} />
            <span className="text-[13px] font-semibold tracking-tight" style={{ color: C.ink }}>
              imagick<span style={{ color: C.blueGlow }}>.ai</span>
            </span>
          </div>
          {/* module tabs */}
          <nav className="flex items-center">
            <ModuleTab label="LIBRARY" active />
            <span style={{ color: C.border }}>·</span>
            <ModuleTab label="DEVELOP" />
            <span style={{ color: C.border }}>·</span>
            <ModuleTab label="MAP" />
            <span style={{ color: C.border }}>·</span>
            <ModuleTab label="PRINT" />
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {/* Ask Aura control */}
          <button
            className="flex items-center gap-2 rounded-md px-3 py-1.5 text-[12px] transition-colors"
            style={{
              background: "rgba(43,80,240,0.12)",
              border: `1px solid rgba(58,99,255,0.4)`,
              color: C.blueGlow,
            }}
          >
            <Sparkle size={13} color={C.blueGlow} />
            <span style={{ fontFamily: MONO, letterSpacing: "0.04em" }}>Ask Aura</span>
          </button>
          <Settings2 className="h-4 w-4" style={{ color: C.dim }} />
          {/* avatar */}
          <div
            className="grid h-7 w-7 place-items-center rounded-full text-[11px] font-semibold"
            style={{ background: C.blue, color: "#fff" }}
          >
            N
          </div>
        </div>
      </header>

      {/* ============================= WORKSPACE (3 columns) ============================= */}
      <div className="flex min-h-0 flex-1">
        {/* ----------------------- LEFT PANEL ----------------------- */}
        <motion.aside
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="flex w-[252px] shrink-0 flex-col overflow-hidden"
          style={{ background: C.panel, borderRight: `1px solid ${C.border}` }}
        >
          {/* NAVIGATOR mini-preview */}
          <PanelHeader icon={<Maximize2 className="h-3 w-3" />} label="NAVIGATOR" />
          <div className="p-3">
            <div
              className="relative overflow-hidden rounded"
              style={{ border: `1px solid ${C.border}` }}
            >
              <img
                src="https://picsum.photos/seed/imgk1/1200/800"
                alt="navigator preview"
                className="aspect-[3/2] w-full object-cover"
                style={{ filter: "saturate(1.04) brightness(0.95)" }}
              />
              {/* loupe rectangle */}
              <div
                className="absolute left-[20%] top-[24%] h-[44%] w-[44%] rounded-sm"
                style={{ border: `1.5px solid ${C.blueGlow}`, boxShadow: "0 0 0 9999px rgba(0,0,0,0.28)" }}
              />
            </div>
          </div>

          {/* COLLECTIONS tree */}
          <PanelHeader icon={<FolderTree className="h-3 w-3" />} label="COLLECTIONS" />
          <div className="min-h-0 flex-1 overflow-y-auto py-1">
            {TREE.map((t) => (
              <button
                key={t.label + t.depth}
                className="flex w-full items-center gap-1.5 py-[5px] pr-3 text-left transition-colors"
                style={{
                  paddingLeft: 10 + t.depth * 14,
                  background: t.active ? "rgba(43,80,240,0.16)" : "transparent",
                  borderLeft: t.active ? `2px solid ${C.blue}` : "2px solid transparent",
                }}
              >
                {t.open !== undefined ? (
                  t.open ? (
                    <ChevronDown className="h-3 w-3 shrink-0" style={{ color: C.dim }} />
                  ) : (
                    <ChevronRight className="h-3 w-3 shrink-0" style={{ color: C.dim }} />
                  )
                ) : (
                  <span className="w-3 shrink-0" />
                )}
                <span
                  className="flex-1 truncate text-[12px]"
                  style={{ color: t.active ? C.blueGlow : C.ink, fontWeight: t.active ? 600 : 400 }}
                >
                  {t.label}
                </span>
                {t.count && (
                  <span className="text-[10px]" style={{ fontFamily: MONO, color: C.dim }}>
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* LEDGER STATS (Lightroom info-panel style) */}
          <PanelHeader icon={<Layers className="h-3 w-3" />} label="CATALOG INFO" />
          <div className="space-y-3 px-3 py-3">
            {/* AI edits */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[10px] tracking-[0.14em]" style={{ fontFamily: MONO, color: C.dim }}>
                  <Sparkle size={10} color={C.blue} /> AI EDITS
                </span>
                <span className="text-[11px]" style={{ fontFamily: MONO, color: C.ink }}>
                  1,240<span style={{ color: C.dim }}> / 2,000</span>
                </span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full" style={{ background: C.raised }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: C.blue }}
                  initial={{ width: 0 }}
                  animate={{ width: "62%" }}
                  transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
                />
              </div>
            </div>
            {/* Storage */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[10px] tracking-[0.14em]" style={{ fontFamily: MONO, color: C.dim }}>
                  <HardDrive className="h-3 w-3" /> STORAGE
                </span>
                <span className="text-[11px]" style={{ fontFamily: MONO, color: C.ink }}>
                  48.2<span style={{ color: C.dim }}> / 100 GB</span>
                </span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full" style={{ background: C.raised }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: C.dim }}
                  initial={{ width: 0 }}
                  animate={{ width: "48.2%" }}
                  transition={{ duration: 1, delay: 0.4, ease: "easeOut" }}
                />
              </div>
            </div>
            {/* Collections + Engine row */}
            <div className="flex items-center justify-between pt-1" style={{ borderTop: `1px solid ${C.border}` }}>
              <div className="pt-2">
                <div className="text-[10px] tracking-[0.14em]" style={{ fontFamily: MONO, color: C.dim }}>
                  COLLECTIONS
                </div>
                <div className="text-[15px] font-semibold" style={{ fontFamily: MONO, color: C.ink }}>
                  12
                </div>
              </div>
              <div className="pt-2 text-right">
                <div className="text-[10px] tracking-[0.14em]" style={{ fontFamily: MONO, color: C.dim }}>
                  AURA ENGINE
                </div>
                <div className="flex items-center justify-end gap-1.5">
                  <motion.span
                    className="h-2 w-2 rounded-full"
                    style={{ background: C.blue, boxShadow: `0 0 8px ${C.blueGlow}` }}
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1.3, repeat: Infinity, ease: "easeInOut" }}
                  />
                  <span className="text-[12px] font-semibold" style={{ fontFamily: MONO, color: C.blueGlow }}>
                    WORKING
                  </span>
                </div>
              </div>
            </div>
          </div>
        </motion.aside>

        {/* ----------------------- CENTER STAGE ----------------------- */}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden" style={{ background: C.canvas }}>
          {/* histogram strip */}
          <div
            className="flex shrink-0 items-center gap-3 px-5 py-2.5"
            style={{ background: C.panel, borderBottom: `1px solid ${C.border}` }}
          >
            <span className="text-[10px] tracking-[0.24em]" style={{ fontFamily: MONO, color: C.dim }}>
              HISTOGRAM
            </span>
            <div className="flex-1">
              <Histogram />
            </div>
            <div className="flex flex-col items-end gap-0.5 text-[10px]" style={{ fontFamily: MONO, color: C.dim }}>
              <span>RGB</span>
              <span style={{ color: C.ink }}>255 · 0</span>
            </div>
          </div>

          {/* hero photo on dark canvas */}
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-8">
            <motion.figure
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="relative flex max-h-full max-w-full flex-col"
            >
              <div
                className="relative overflow-hidden rounded-sm"
                style={{ boxShadow: "0 40px 80px -30px rgba(0,0,0,0.9), 0 0 0 1px rgba(0,0,0,0.4)" }}
              >
                <img
                  src="https://picsum.photos/seed/imgk1/1200/800"
                  alt="Cohen Wedding — selected frame"
                  className="block max-h-[52vh] w-auto object-contain"
                  style={{ filter: "saturate(1.05) contrast(1.02)" }}
                />
                {/* Auto sparkle button */}
                <button
                  className="absolute right-3 top-3 flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-semibold backdrop-blur transition-colors"
                  style={{
                    background: C.blue,
                    color: "#fff",
                    boxShadow: `0 6px 20px -6px ${C.blueGlow}`,
                  }}
                >
                  <Sparkle size={13} color="#fff" />
                  Auto
                </button>
              </div>

              {/* title + EXIF mono readout */}
              <figcaption className="mt-3 flex items-end justify-between gap-4">
                <div>
                  <div className="text-[15px] font-semibold" style={{ color: C.ink }}>
                    Cohen Wedding — Frame 0428
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-[11px]" style={{ fontFamily: MONO, color: C.blueGlow }}>
                    <Sparkle size={11} color={C.blueGlow} />
                    Aura enhanced this in 0.4s
                  </div>
                </div>
                <div
                  className="rounded px-3 py-1.5 text-[11px] tracking-[0.06em]"
                  style={{ fontFamily: MONO, color: C.dim, background: C.panel, border: `1px solid ${C.border}` }}
                >
                  ISO 400 · ƒ/2.8 · 1/250 · 35mm
                </div>
              </figcaption>
            </motion.figure>
          </div>
        </main>

        {/* ----------------------- RIGHT PANEL (DEVELOP / AURA) ----------------------- */}
        <motion.aside
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="flex w-[288px] shrink-0 flex-col overflow-hidden"
          style={{ background: C.panel, borderLeft: `1px solid ${C.border}` }}
        >
          {/* DEVELOP sliders */}
          <PanelHeader icon={<Sun className="h-3 w-3" />} label="DEVELOP · BASIC" />
          <div className="overflow-y-auto py-1" style={{ borderBottom: `1px solid ${C.border}` }}>
            {SLIDERS.map((s, i) => (
              <SliderRow key={s.label} label={s.label} value={s.value} pos={s.pos} delay={0.35 + i * 0.06} />
            ))}
          </div>

          {/* AURA AI panel */}
          <div className="flex min-h-0 flex-1 flex-col">
            <div
              className="flex items-center gap-2 px-3 py-2 text-[10px] tracking-[0.26em]"
              style={{
                fontFamily: MONO,
                color: C.blueGlow,
                background: "rgba(43,80,240,0.10)",
                borderBottom: `1px solid rgba(58,99,255,0.3)`,
              }}
            >
              <Sparkle size={12} color={C.blueGlow} />
              AURA AI
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {/* briefing */}
              <div
                className="rounded-lg p-3"
                style={{ background: "rgba(43,80,240,0.07)", border: `1px solid rgba(58,99,255,0.28)` }}
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md"
                    style={{ background: "rgba(43,80,240,0.16)", border: `1px solid rgba(58,99,255,0.4)` }}
                  >
                    <Sparkle size={14} color={C.blueGlow} />
                  </span>
                  <p className="text-[13px] leading-snug" style={{ color: C.ink }}>
                    <span style={{ color: C.blueGlow, fontWeight: 600 }}>Cohen Wedding</span> is finished and ready to deliver.
                  </p>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[10px] tracking-[0.14em]" style={{ fontFamily: MONO, color: C.dim }}>
                    DELIVERY READY
                  </span>
                  <button
                    className="rounded-full px-3.5 py-1 text-[11px] font-semibold"
                    style={{ background: C.blue, color: "#fff", boxShadow: `0 4px 14px -4px ${C.blueGlow}` }}
                  >
                    Open
                  </button>
                </div>
              </div>

              {/* AI suggestions */}
              <div className="mt-3 space-y-2">
                {[
                  "Cull 124 near-duplicates",
                  "Match white balance across set",
                  "Export web-ready proofs",
                ].map((s) => (
                  <button
                    key={s}
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[12px] transition-colors"
                    style={{ background: C.raised, border: `1px solid ${C.border}`, color: C.ink }}
                  >
                    <Sparkle size={11} color={C.blue} />
                    <span className="flex-1">{s}</span>
                    <ChevronRight className="h-3.5 w-3.5" style={{ color: C.dim }} />
                  </button>
                ))}
              </div>
            </div>

            {/* Aura command input */}
            <div className="shrink-0 p-3" style={{ borderTop: `1px solid ${C.border}` }}>
              <div
                className="flex items-center gap-2 rounded-lg px-3 py-2"
                style={{ background: C.canvas, border: `1px solid rgba(58,99,255,0.35)` }}
              >
                <Search className="h-3.5 w-3.5 shrink-0" style={{ color: C.dim }} />
                <span className="flex-1 truncate text-[12px]" style={{ color: C.dim }}>
                  Ask Aura to cull, edit, or prep…
                </span>
                <span
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-md"
                  style={{ background: C.blue, color: "#fff" }}
                >
                  <Send className="h-3.5 w-3.5" />
                </span>
              </div>
            </div>
          </div>
        </motion.aside>
      </div>

      {/* ============================= BOTTOM FILMSTRIP ============================= */}
      <motion.footer
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.15, ease: "easeOut" }}
        className="shrink-0"
        style={{ background: C.panel, borderTop: `1px solid ${C.border}` }}
      >
        <div className="flex items-center justify-between px-4 pt-2">
          <span className="text-[10px] tracking-[0.26em]" style={{ fontFamily: MONO, color: C.dim }}>
            FILMSTRIP · RECENT COLLECTIONS
          </span>
          <span className="flex items-center gap-3 text-[10px] tracking-[0.18em]" style={{ fontFamily: MONO, color: C.dim }}>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: C.green }} /> READY
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: C.amber }} /> PROCESSING
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: C.red }} /> ERROR
            </span>
          </span>
        </div>

        <div className="flex items-stretch gap-2.5 overflow-x-auto px-4 pb-3 pt-2">
          {FILMSTRIP.map((f, i) => {
            const selected = i === 0;
            return (
              <motion.div
                key={f.seed}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.2 + i * 0.05, ease: "easeOut" }}
                className="group relative w-[124px] shrink-0 overflow-hidden rounded-md"
                style={{
                  background: C.raised,
                  border: selected ? `2px solid ${C.blue}` : `1px solid ${C.border}`,
                  boxShadow: selected ? `0 0 0 1px rgba(58,99,255,0.4), 0 8px 24px -10px ${C.blueGlow}` : "none",
                }}
              >
                <div className="relative">
                  <img
                    src={`https://picsum.photos/seed/${f.seed}/200/200`}
                    alt={f.name}
                    className="aspect-[5/4] w-full object-cover"
                    style={{ filter: "saturate(1.04) brightness(0.95)" }}
                  />
                  {f.status === "PROCESSING" && typeof f.pct === "number" && (
                    <div className="absolute inset-x-0 bottom-0">
                      <div className="h-1 w-full" style={{ background: "rgba(0,0,0,0.4)" }}>
                        <motion.div
                          className="h-full"
                          style={{ background: C.amber }}
                          initial={{ width: 0 }}
                          animate={{ width: `${f.pct}%` }}
                          transition={{ duration: 0.9, delay: 0.3 + i * 0.05, ease: "easeOut" }}
                        />
                      </div>
                    </div>
                  )}
                  {selected && (
                    <div
                      className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-semibold"
                      style={{ background: C.blue, color: "#fff" }}
                    >
                      <Star className="h-2.5 w-2.5" fill="#fff" /> SELECTED
                    </div>
                  )}
                </div>
                <div className="px-2 py-1.5">
                  <div className="flex items-center gap-1.5">
                    <StatusDot status={f.status} />
                    <span className="truncate text-[11px] font-medium" style={{ color: C.ink }}>
                      {f.name}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between text-[9px]" style={{ fontFamily: MONO, color: C.dim }}>
                    <span>{f.frames} FRAMES</span>
                    <span style={{ color: STATUS_COLOR[f.status] }}>
                      {f.status === "PROCESSING" ? `${f.pct}%` : f.status}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.footer>
    </div>
  );
}
