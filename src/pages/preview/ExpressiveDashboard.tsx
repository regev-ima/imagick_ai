import { useEffect } from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  Plus,
  Wand2,
  Share2,
  ArrowUpRight,
  Cpu,
  HardDrive,
  Layers,
  Zap,
  Camera,
  CheckCircle2,
  Clock3,
  AlertTriangle,
} from "lucide-react";

/**
 * EXPRESSIVE — a bright, playful Material You / Google-2026 dashboard mock.
 *
 * Self-contained: renders its own background, uses only explicit hex colors and
 * explicit fonts (no CSS variables / tokens / theme classes). Looks identical in
 * light or dark app themes.
 */

const FONT_STACK =
  '"Figtree", "Quicksand", Inter, ui-rounded, "Segoe UI", system-ui, sans-serif';

// ----- sample data -----------------------------------------------------------

const QUEUE = [
  {
    name: "Maya + Roi · Engagement",
    seed: "imgkq1",
    pct: 72,
    tint: "#E7DEFF",
    deep: "#3A2C8F",
    bar: "#7C5CFC",
  },
  {
    name: "Jaffa Street Series",
    seed: "imgkq2",
    pct: 38,
    tint: "#CFE6FF",
    deep: "#0B4E8F",
    bar: "#246BFB",
  },
];

const COLLECTIONS = [
  {
    name: "Cohen Wedding",
    seed: "imgk1",
    count: 842,
    status: "Ready",
    tint: "#CFEFD8",
    deep: "#1E6B3A",
    pill: "#BDE9C9",
  },
  {
    name: "Tel Aviv Editorial",
    seed: "imgk2",
    count: 214,
    status: "Processing",
    tint: "#FBE9A8",
    deep: "#8A6A00",
    pill: "#F7DE84",
  },
  {
    name: "Negev Sunrise",
    seed: "imgk3",
    count: 168,
    status: "Ready",
    tint: "#FFE0C7",
    deep: "#9A4A12",
    pill: "#FFCFA8",
  },
  {
    name: "Studio Portraits",
    seed: "imgk4",
    count: 96,
    status: "Ready",
    tint: "#FFD9E3",
    deep: "#9A2350",
    pill: "#FBC2D3",
  },
  {
    name: "Carmel Market",
    seed: "imgk5",
    count: 331,
    status: "Error",
    tint: "#FFD9E3",
    deep: "#A11A2E",
    pill: "#F7B7C0",
  },
  {
    name: "Galilee Elopement",
    seed: "imgk6",
    count: 540,
    status: "Processing",
    tint: "#CFE6FF",
    deep: "#0B4E8F",
    pill: "#BBD9FB",
  },
];

const statusStyle: Record<
  string,
  { bg: string; fg: string; Icon: typeof CheckCircle2 }
> = {
  Ready: { bg: "#BDE9C9", fg: "#1E6B3A", Icon: CheckCircle2 },
  Processing: { bg: "#F7DE84", fg: "#8A6A00", Icon: Clock3 },
  Error: { bg: "#F7B7C0", fg: "#A11A2E", Icon: AlertTriangle },
};

// ----- motion helpers --------------------------------------------------------

const spring = { type: "spring" as const, stiffness: 260, damping: 22 };

const pop = {
  hidden: { opacity: 0, y: 26, scale: 0.94 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { ...spring, delay: 0.05 * i },
  }),
};

// ----- small components ------------------------------------------------------

function Pill({
  children,
  bg,
  fg,
}: {
  children: React.ReactNode;
  bg: string;
  fg: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold"
      style={{ backgroundColor: bg, color: fg }}
    >
      {children}
    </span>
  );
}

function ProgressRing({
  value,
  color,
  track,
}: {
  value: number;
  color: string;
  track: string;
}) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <svg width="84" height="84" viewBox="0 0 84 84" className="-rotate-90">
      <circle cx="42" cy="42" r={r} fill="none" stroke={track} strokeWidth="9" />
      <motion.circle
        cx="42"
        cy="42"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: offset }}
        transition={{ ...spring, delay: 0.3 }}
      />
    </svg>
  );
}

// ----- page ------------------------------------------------------------------

export default function ExpressiveDashboard() {
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800;900&family=Quicksand:wght@500;600;700&display=swap";
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  return (
    <div
      className="min-h-screen w-full"
      style={{
        fontFamily: FONT_STACK,
        color: "#1C1530",
        backgroundColor: "#FBF8FF",
        backgroundImage:
          "radial-gradient(1100px 700px at 8% -10%, #EFE7FF 0%, rgba(239,231,255,0) 55%), radial-gradient(900px 600px at 100% 0%, #DDF0E6 0%, rgba(221,240,230,0) 55%), radial-gradient(1000px 700px at 60% 120%, #FFE7D6 0%, rgba(255,231,214,0) 55%)",
      }}
    >
      <div className="mx-auto w-full max-w-[1280px] px-5 pb-16 pt-8 sm:px-8">
        {/* ---------- Header ---------- */}
        <motion.header
          variants={pop}
          custom={0}
          initial="hidden"
          animate="show"
          className="flex flex-wrap items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl shadow-lg"
              style={{
                backgroundImage: "linear-gradient(135deg, #7C5CFC, #246BFB)",
                boxShadow: "0 10px 24px rgba(91,75,224,0.35)",
              }}
            >
              <Sparkles className="h-6 w-6 text-white" strokeWidth={2.4} />
            </div>
            <span
              className="text-2xl font-extrabold tracking-tight"
              style={{ color: "#2A1E66" }}
            >
              imagick<span style={{ color: "#5B4BE0" }}>.ai</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Pill bg="#E7DEFF" fg="#3A2C8F">
              <Zap className="h-4 w-4" strokeWidth={2.6} /> Studio Pro
            </Pill>
            <div
              className="flex h-11 w-11 items-center justify-center rounded-full text-base font-extrabold text-white shadow-md"
              style={{ backgroundImage: "linear-gradient(135deg, #FF8FB1, #FF5C8A)" }}
            >
              N
            </div>
          </div>
        </motion.header>

        {/* ---------- Greeting ---------- */}
        <motion.div
          variants={pop}
          custom={1}
          initial="hidden"
          animate="show"
          className="mt-9"
        >
          <p className="text-base font-semibold" style={{ color: "#7A6FA6" }}>
            Sunday, June 14 · 2026
          </p>
          <h1
            className="mt-1 text-[44px] font-black leading-[1.04] tracking-tight sm:text-[60px]"
            style={{ color: "#241850" }}
          >
            Good evening, Nate{" "}
            <span className="inline-block">✨</span>
          </h1>
          <p className="mt-2 text-lg font-medium" style={{ color: "#6B5F94" }}>
            Aura prepped two galleries while you were out. Here's where things stand.
          </p>
        </motion.div>

        {/* ---------- Aura command bar ---------- */}
        <motion.section
          variants={pop}
          custom={2}
          initial="hidden"
          animate="show"
          className="mt-7 rounded-[36px] p-6 sm:p-7"
          style={{
            backgroundImage: "linear-gradient(135deg, #ECE5FF 0%, #E7F0FF 100%)",
            boxShadow: "0 20px 50px rgba(91,75,224,0.14)",
          }}
        >
          <div className="flex items-center gap-3 rounded-full bg-white px-4 py-3 shadow-sm sm:px-5 sm:py-4">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundImage: "linear-gradient(135deg, #7C5CFC, #246BFB)" }}
            >
              <Sparkles className="h-5 w-5 text-white" strokeWidth={2.4} />
            </div>
            <span
              className="flex-1 truncate text-base font-medium sm:text-lg"
              style={{ color: "#8A7FB0" }}
            >
              Ask Aura to cull, edit, or prep a shoot…
            </span>
            <button
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white shadow-md transition-transform hover:scale-105"
              style={{ backgroundColor: "#5B4BE0" }}
            >
              <ArrowUpRight className="h-5 w-5" strokeWidth={2.6} />
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <QuickPill icon={Plus} bg="#CFEFD8" fg="#1E6B3A">
              New collection
            </QuickPill>
            <QuickPill icon={Wand2} bg="#E7DEFF" fg="#3A2C8F">
              Train an AI style
            </QuickPill>
            <QuickPill icon={Share2} bg="#FFE0C7" fg="#9A4A12">
              Share a gallery
            </QuickPill>
          </div>
        </motion.section>

        {/* ---------- Stat bento ---------- */}
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {/* AI edits left (with ring) */}
          <motion.div
            variants={pop}
            custom={3}
            initial="hidden"
            animate="show"
            className="col-span-2 rounded-[32px] p-6 sm:col-span-1"
            style={{ backgroundColor: "#E7DEFF" }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold" style={{ color: "#5A4AA0" }}>
                  AI edits left
                </p>
                <p
                  className="mt-1 text-[40px] font-black leading-none tracking-tight"
                  style={{ color: "#3A2C8F" }}
                >
                  1,240
                </p>
                <p className="mt-1 text-sm font-semibold" style={{ color: "#7A6FB8" }}>
                  of 2,000
                </p>
              </div>
              <div className="relative grid place-items-center">
                <ProgressRing value={62} color="#7C5CFC" track="#D2C4FF" />
                <span
                  className="absolute text-sm font-black"
                  style={{ color: "#3A2C8F" }}
                >
                  62%
                </span>
              </div>
            </div>
          </motion.div>

          {/* Storage */}
          <StatTile
            i={4}
            tint="#CFE6FF"
            deep="#0B4E8F"
            sub="#3E73B0"
            icon={HardDrive}
            label="Storage"
            big="48.2"
            unit="/ 100 GB"
          >
            <div
              className="mt-4 h-3 w-full overflow-hidden rounded-full"
              style={{ backgroundColor: "#B8D6F7" }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: "#246BFB" }}
                initial={{ width: 0 }}
                animate={{ width: "48%" }}
                transition={{ ...spring, delay: 0.35 }}
              />
            </div>
          </StatTile>

          {/* Collections */}
          <StatTile
            i={5}
            tint="#FFE0C7"
            deep="#9A4A12"
            sub="#B7672E"
            icon={Layers}
            label="Collections"
            big="12"
            unit="active"
          >
            <p className="mt-3 text-sm font-semibold" style={{ color: "#B7672E" }}>
              4 delivered this week
            </p>
          </StatTile>

          {/* Aura engine */}
          <StatTile
            i={6}
            tint="#CFEFD8"
            deep="#1E6B3A"
            sub="#3C8757"
            icon={Cpu}
            label="Aura engine"
            big="Working"
            bigSize="text-[34px]"
          >
            <div className="mt-3 flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span
                  className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                  style={{ backgroundColor: "#3FBF6E" }}
                />
                <span
                  className="relative inline-flex h-3 w-3 rounded-full"
                  style={{ backgroundColor: "#2FA85E" }}
                />
              </span>
              <span className="text-sm font-bold" style={{ color: "#3C8757" }}>
                2 jobs running
              </span>
            </div>
          </StatTile>
        </div>

        {/* ---------- Briefing + Queue ---------- */}
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-5">
          {/* AI briefing */}
          <motion.section
            variants={pop}
            custom={7}
            initial="hidden"
            animate="show"
            className="relative overflow-hidden rounded-[36px] p-7 lg:col-span-2"
            style={{
              backgroundImage: "linear-gradient(160deg, #FFD9E3 0%, #FFE6CF 100%)",
            }}
          >
            <Sparkles
              className="absolute -right-4 -top-4 h-28 w-28 opacity-30"
              style={{ color: "#FF8FB1" }}
              strokeWidth={1.5}
            />
            <Pill bg="#FFFFFF" fg="#A11A2E">
              <Sparkles className="h-4 w-4" strokeWidth={2.6} /> Aura briefing
            </Pill>
            <p
              className="mt-4 text-2xl font-extrabold leading-snug"
              style={{ color: "#7A1F3E" }}
            >
              Cohen Wedding is finished and ready to deliver.
            </p>
            <p className="mt-3 text-base font-medium" style={{ color: "#9A4A56" }}>
              I'm working on 2 collections right now — I'll ping you the moment
              they're done.
            </p>
            <button
              className="mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-base font-bold text-white shadow-md transition-transform hover:scale-105"
              style={{ backgroundColor: "#E0457B" }}
            >
              Open it <ArrowUpRight className="h-5 w-5" strokeWidth={2.6} />
            </button>
          </motion.section>

          {/* Engine queue */}
          <motion.section
            variants={pop}
            custom={8}
            initial="hidden"
            animate="show"
            className="rounded-[36px] bg-white p-6 shadow-sm lg:col-span-3"
            style={{ boxShadow: "0 16px 40px rgba(40,28,90,0.08)" }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold" style={{ color: "#241850" }}>
                Engine queue
              </h2>
              <Pill bg="#E7DEFF" fg="#3A2C8F">
                <Cpu className="h-4 w-4" strokeWidth={2.6} /> 2 in progress
              </Pill>
            </div>
            <div className="mt-4 space-y-4">
              {QUEUE.map((q, i) => (
                <motion.div
                  key={q.seed}
                  variants={pop}
                  custom={9 + i}
                  initial="hidden"
                  animate="show"
                  className="flex items-center gap-4 rounded-[26px] p-3"
                  style={{ backgroundColor: q.tint }}
                >
                  <img
                    src={`https://picsum.photos/seed/${q.seed}/200/200`}
                    alt={q.name}
                    className="h-16 w-16 shrink-0 rounded-2xl object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className="truncate text-base font-extrabold"
                        style={{ color: q.deep }}
                      >
                        {q.name}
                      </p>
                      <span
                        className="text-base font-black"
                        style={{ color: q.deep }}
                      >
                        {q.pct}%
                      </span>
                    </div>
                    <div
                      className="mt-2 h-2.5 w-full overflow-hidden rounded-full"
                      style={{ backgroundColor: "rgba(255,255,255,0.6)" }}
                    >
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: q.bar }}
                        initial={{ width: 0 }}
                        animate={{ width: `${q.pct}%` }}
                        transition={{ ...spring, delay: 0.4 + i * 0.1 }}
                      />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.section>
        </div>

        {/* ---------- Recent collections ---------- */}
        <motion.div
          variants={pop}
          custom={11}
          initial="hidden"
          animate="show"
          className="mt-10 flex items-center justify-between"
        >
          <h2
            className="text-2xl font-black tracking-tight sm:text-3xl"
            style={{ color: "#241850" }}
          >
            Recent collections
          </h2>
          <button
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-colors"
            style={{ backgroundColor: "#E7DEFF", color: "#3A2C8F" }}
          >
            View all <ArrowUpRight className="h-4 w-4" strokeWidth={2.6} />
          </button>
        </motion.div>

        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {COLLECTIONS.map((c, i) => {
            const s = statusStyle[c.status];
            return (
              <motion.article
                key={c.seed}
                variants={pop}
                custom={12 + i}
                initial="hidden"
                animate="show"
                whileHover={{ y: -6, scale: 1.015 }}
                transition={spring}
                className="group overflow-hidden rounded-[32px] p-3"
                style={{ backgroundColor: c.tint }}
              >
                <div className="relative overflow-hidden rounded-[24px]">
                  <img
                    src={`https://picsum.photos/seed/${c.seed}/600/600`}
                    alt={c.name}
                    className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute left-3 top-3">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold shadow-sm"
                      style={{ backgroundColor: s.bg, color: s.fg }}
                    >
                      <s.Icon className="h-3.5 w-3.5" strokeWidth={2.8} />
                      {c.status}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between px-2 pb-1 pt-3">
                  <div>
                    <p
                      className="text-lg font-extrabold leading-tight"
                      style={{ color: c.deep }}
                    >
                      {c.name}
                    </p>
                    <p
                      className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold"
                      style={{ color: c.deep, opacity: 0.7 }}
                    >
                      <Camera className="h-4 w-4" strokeWidth={2.4} />
                      {c.count.toLocaleString()} photos
                    </p>
                  </div>
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-full transition-transform group-hover:scale-110"
                    style={{ backgroundColor: "rgba(255,255,255,0.7)" }}
                  >
                    <ArrowUpRight
                      className="h-5 w-5"
                      strokeWidth={2.6}
                      style={{ color: c.deep }}
                    />
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>

        {/* ---------- Footer flourish ---------- */}
        <motion.p
          variants={pop}
          custom={18}
          initial="hidden"
          animate="show"
          className="mt-12 text-center text-sm font-semibold"
          style={{ color: "#9A8FC0" }}
        >
          Made with ✨ by Aura · imagick.ai
        </motion.p>
      </div>
    </div>
  );
}

// ----- sub-components ---------------------------------------------------------

function QuickPill({
  icon: Icon,
  bg,
  fg,
  children,
}: {
  icon: typeof Plus;
  bg: string;
  fg: string;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.96 }}
      transition={spring}
      className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-base font-bold shadow-sm"
      style={{ backgroundColor: bg, color: fg }}
    >
      <Icon className="h-4 w-4" strokeWidth={2.8} />
      {children}
    </motion.button>
  );
}

function StatTile({
  i,
  tint,
  deep,
  sub,
  icon: Icon,
  label,
  big,
  unit,
  bigSize = "text-[40px]",
  children,
}: {
  i: number;
  tint: string;
  deep: string;
  sub: string;
  icon: typeof Cpu;
  label: string;
  big: string;
  unit?: string;
  bigSize?: string;
  children?: React.ReactNode;
}) {
  return (
    <motion.div
      variants={pop}
      custom={i}
      initial="hidden"
      animate="show"
      className="rounded-[32px] p-6"
      style={{ backgroundColor: tint }}
    >
      <div className="flex items-center gap-2">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-full"
          style={{ backgroundColor: "rgba(255,255,255,0.6)" }}
        >
          <Icon className="h-5 w-5" strokeWidth={2.4} style={{ color: deep }} />
        </div>
        <p className="text-sm font-bold" style={{ color: sub }}>
          {label}
        </p>
      </div>
      <p
        className={`mt-3 ${bigSize} font-black leading-none tracking-tight`}
        style={{ color: deep }}
      >
        {big}
      </p>
      {unit ? (
        <p className="mt-1 text-sm font-semibold" style={{ color: sub }}>
          {unit}
        </p>
      ) : null}
      {children}
    </motion.div>
  );
}
