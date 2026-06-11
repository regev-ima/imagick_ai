import "./design-preview.css";
import {
  LayoutDashboard,
  Images,
  Sparkles,
  CreditCard,
  Settings,
  Search,
  Command,
  Bell,
  Plus,
  Cpu,
  HardDrive,
  Zap,
  ArrowUpRight,
  Check,
  X,
  Focus,
  Users,
  ScanFace,
  Wand2,
  SlidersHorizontal,
  LayoutGrid,
  Rows3,
  ChevronRight,
} from "lucide-react";
import imagickLogo from "@/assets/imagick-logo.png";
import hero1 from "@/assets/hero-gallery-1.jpg";
import hero2 from "@/assets/hero-gallery-2.jpg";
import hero3 from "@/assets/hero-gallery-3.jpg";

/* ════════════════════════════════════════════════════════════════════
   IMAGICK // NEXUS — design concept preview
   ────────────────────────────────────────────────────────────────────
   Internal, unlinked route (/design-preview) that renders the proposed
   futuristic redesign on top of realistic product screens. Everything
   on this page is STATIC MOCK DATA — no Supabase, no auth, no network
   calls — so the concept can be reviewed safely without touching the
   live design system. See docs/design/nexus-concept.md for the plan.
   ════════════════════════════════════════════════════════════════════ */

const HudCorners = () => (
  <>
    <span className="nx-corner nx-corner-tl" />
    <span className="nx-corner nx-corner-tr" />
    <span className="nx-corner nx-corner-bl" />
    <span className="nx-corner nx-corner-br" />
  </>
);

const SectionHeader = ({ index, title, subtitle }: { index: string; title: string; subtitle: string }) => (
  <div className="mb-8">
    <div className="flex items-baseline gap-4">
      <span className="nx-mono text-sm text-[hsl(var(--nx-cyan))]">{index}</span>
      <h2 className="nx-display text-2xl md:text-3xl font-semibold">{title}</h2>
    </div>
    <p className="mt-2 text-sm text-[hsl(var(--nx-muted))] max-w-2xl">{subtitle}</p>
    <div className="nx-hairline mt-5" />
  </div>
);

/* ── Mock data (mirrors the real product's entities) ─────────────── */

const railItems = [
  { icon: LayoutDashboard, label: "Dashboard", active: true },
  { icon: Images, label: "Collections" },
  { icon: Sparkles, label: "AI Styles" },
  { icon: CreditCard, label: "Billing" },
  { icon: Settings, label: "Settings" },
];

const collections = [
  { img: hero1, name: "Cohen Wedding", count: "1,284", status: "PROCESSING", led: "nx-led-cyan", filter: "saturate(1.05)" },
  { img: hero2, name: "Noa & Tom — Engagement", count: "312", status: "CULLING", led: "nx-led-amber", filter: "hue-rotate(-12deg) saturate(1.1)" },
  { img: hero3, name: "Levi Bat-Mitzvah", count: "743", status: "DELIVERED", led: "nx-led-green", filter: "contrast(1.05)" },
  { img: hero2, name: "Studio Portraits — June", count: "96", status: "DELIVERED", led: "nx-led-green", filter: "hue-rotate(18deg) brightness(1.05)" },
];

const queue = [
  { label: "Neural retouch — Cohen Wedding", detail: "24 / 1,284 images", pct: 62 },
  { label: "Face clustering — Noa & Tom", detail: "identifying 14 faces", pct: 38 },
  { label: "Culling scores — Studio Portraits", detail: "scoring sharpness + eyes", pct: 87 },
];

const photos = [
  { img: hero1, score: "98.2", state: "pick" as const, pos: "50% 30%", filter: "none" },
  { img: hero2, score: "96.7", state: "pick" as const, pos: "50% 40%", filter: "hue-rotate(-10deg)" },
  { img: hero3, score: "94.1", state: "selected" as const, pos: "50% 20%", filter: "none" },
  { img: hero2, score: "91.8", state: "none" as const, pos: "30% 50%", filter: "saturate(1.2)" },
  { img: hero1, score: "88.4", state: "processing" as const, pos: "70% 40%", filter: "hue-rotate(15deg)" },
  { img: hero3, score: "84.0", state: "none" as const, pos: "40% 60%", filter: "contrast(1.1)" },
  { img: hero1, score: "41.6", state: "reject" as const, pos: "20% 30%", filter: "none" },
  { img: hero2, score: "37.2", state: "reject" as const, pos: "60% 20%", filter: "none" },
];

const palette = [
  { name: "VOID", value: "248 36% 4%", cls: "bg-[hsl(248_36%_4%)] border" },
  { name: "PANEL GLASS", value: "246 30% 8%", cls: "bg-[hsl(246_30%_8%)] border" },
  { name: "QUANTUM CYAN", value: "187 100% 55%", cls: "bg-[hsl(187_100%_55%)]" },
  { name: "ULTRAVIOLET", value: "268 100% 68%", cls: "bg-[hsl(268_100%_68%)]" },
  { name: "NEON MAGENTA", value: "326 100% 60%", cls: "bg-[hsl(326_100%_60%)]" },
  { name: "PLASMA GREEN", value: "152 95% 45%", cls: "bg-[hsl(152_95%_45%)]" },
  { name: "SIGNAL AMBER", value: "40 100% 55%", cls: "bg-[hsl(40_100%_55%)]" },
];

const sparkline = "0,26 12,22 24,24 36,16 48,18 60,10 72,13 84,6 96,9 108,2";

/* ── Page ────────────────────────────────────────────────────────── */

export default function DesignPreview() {
  return (
    <div className="nexus min-h-screen">
      {/* Ambient layers */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="nx-stars" />
        <div className="nx-aurora w-[60vw] h-[60vw] bg-[hsl(var(--nx-violet))] -top-[20vw] -left-[15vw]" />
        <div className="nx-aurora w-[50vw] h-[50vw] bg-[hsl(var(--nx-cyan))] top-[10%] -right-[18vw]" style={{ animationDelay: "-8s" }} />
        <div className="nx-aurora w-[45vw] h-[45vw] bg-[hsl(var(--nx-magenta))] top-[42%] -left-[12vw]" style={{ animationDelay: "-16s" }} />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 py-16 md:py-24">
        {/* ── Concept hero ─────────────────────────────────────────── */}
        <header className="mb-20 md:mb-28">
          <div className="flex flex-wrap items-center gap-3">
            <span className="nx-chip">
              <span className="nx-led nx-led-amber nx-led-pulse" />
              Concept preview · not deployed
            </span>
            <span className="nx-chip">v0.1 · 2026-06</span>
            <span className="nx-chip">Internal</span>
          </div>

          <div className="mt-10 flex items-center gap-4">
            <img src={imagickLogo} alt="Imagick.ai" className="h-9 object-contain opacity-90" />
            <span className="nx-mono text-xs text-[hsl(var(--nx-muted))]">//</span>
            <span className="nx-microlabel">Next-gen interface study</span>
          </div>

          <h1 className="nx-display mt-4 text-6xl md:text-8xl font-bold leading-none">
            <span className="nx-holo-text">NEXUS UI</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-[hsl(var(--nx-muted))]">
            A holographic, HUD-inspired evolution of the Imagick design language — deep-space
            surfaces, a quantum-cyan / ultraviolet / magenta spectrum, and an interface that makes
            the AI engine feel physically present in the room.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <span className="nx-chip nx-chip-active">Holographic glass</span>
            <span className="nx-chip">HUD telemetry</span>
            <span className="nx-chip">Command-first nav</span>
            <span className="nx-chip">Living AI core</span>
          </div>
        </header>

        {/* ── 01 · Dashboard concept ──────────────────────────────── */}
        <section id="concept-dashboard" className="mb-24">
          <SectionHeader
            index="01"
            title="Dashboard — Mission Control"
            subtitle="The studio's home becomes a command deck: a floating icon rail, a ⌘K command bar, bento telemetry tiles, and a live Neural Engine core replacing static stat cards."
          />

          {/* Browser frame */}
          <div className="nx-glass-deep rounded-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-3 border-b border-[hsl(var(--nx-line)/0.1)]">
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[hsl(0_70%_55%/0.8)]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[hsl(40_90%_55%/0.8)]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[hsl(150_70%_45%/0.8)]" />
              </div>
              <span className="nx-mono text-[11px] text-[hsl(var(--nx-muted))] px-3 py-1 rounded-md bg-[hsl(var(--nx-void)/0.6)] border border-[hsl(var(--nx-line)/0.1)]">
                app.imagick.ai/dashboard — concept render
              </span>
            </div>

            <div className="flex min-h-[640px]">
              {/* Command rail */}
              <aside className="hidden md:flex w-[76px] flex-col items-center gap-2 py-5 border-r border-[hsl(var(--nx-line)/0.1)] bg-[hsl(var(--nx-void)/0.5)]">
                <div className="nx-orb w-10 h-10 mb-4">
                  <div className="nx-orb-ring" />
                  <div className="nx-orb-core" />
                </div>

                {railItems.map((item) => (
                  <div
                    key={item.label}
                    className={
                      "relative flex h-11 w-11 items-center justify-center rounded-xl transition-colors " +
                      (item.active
                        ? "bg-[hsl(var(--nx-cyan)/0.12)] text-[hsl(var(--nx-cyan))] shadow-[0_0_22px_-6px_hsl(var(--nx-cyan)/0.7)]"
                        : "text-[hsl(var(--nx-muted))] hover:text-[hsl(var(--nx-text))]")
                    }
                    title={item.label}
                  >
                    {item.active && (
                      <span className="absolute -left-[18px] h-6 w-[3px] rounded-full bg-[hsl(var(--nx-cyan))] shadow-[0_0_12px_hsl(var(--nx-cyan))]" />
                    )}
                    <item.icon className="h-5 w-5" />
                  </div>
                ))}

                <div className="mt-auto flex flex-col items-center gap-4">
                  {/* Credits mini-gauge */}
                  <div className="relative h-11 w-11">
                    <div className="nx-gauge absolute inset-0" style={{ ["--gauge" as string]: 74 }} />
                    <span className="nx-mono absolute inset-0 grid place-items-center text-[9px] text-[hsl(var(--nx-cyan))]">74%</span>
                  </div>
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-[hsl(var(--nx-magenta))] to-[hsl(var(--nx-violet))] nx-display text-sm font-bold text-white">
                    RG
                  </div>
                </div>
              </aside>

              {/* Main column */}
              <div className="nx-microgrid flex-1 p-6 md:p-8">
                {/* Command bar */}
                <div className="flex items-center gap-3">
                  <div className="nx-glass flex flex-1 items-center gap-3 rounded-xl px-4 py-2.5">
                    <Search className="h-4 w-4 text-[hsl(var(--nx-muted))]" />
                    <span className="flex-1 text-sm text-[hsl(var(--nx-muted))]">
                      Search collections, styles, clients… or ask the engine
                    </span>
                    <span className="nx-chip !py-1">
                      <Command className="h-3 w-3" /> K
                    </span>
                  </div>
                  <span className="nx-chip hidden lg:inline-flex">
                    <span className="nx-led nx-led-green nx-led-pulse" /> Engine online
                  </span>
                  <button className="nx-btn nx-btn-glass !px-3" aria-label="Notifications">
                    <Bell className="h-4 w-4" />
                  </button>
                  <button className="nx-btn nx-btn-holo">
                    <Plus className="h-4 w-4" /> New
                  </button>
                </div>

                {/* Greeting */}
                <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="nx-microlabel">Thursday · 2026-06-11 · 21:42 IDT</p>
                    <h3 className="nx-display mt-2 text-3xl md:text-4xl font-semibold">
                      Good evening, <span className="nx-holo-text">Regev</span>
                    </h3>
                  </div>
                  <span className="nx-chip">
                    <Zap className="h-3 w-3 text-[hsl(var(--nx-amber))]" /> Studio Pro
                  </span>
                </div>

                {/* Bento telemetry */}
                <div className="mt-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
                  {/* Edits gauge */}
                  <div className="nx-glass nx-hover-lift relative rounded-2xl p-5">
                    <HudCorners />
                    <p className="nx-microlabel">Edits remaining</p>
                    <div className="mt-3 flex items-center gap-4">
                      <div className="relative h-16 w-16 shrink-0">
                        <div className="nx-gauge absolute inset-0" style={{ ["--gauge" as string]: 74 }} />
                      </div>
                      <div>
                        <p className="nx-display text-2xl font-semibold">1,840</p>
                        <p className="nx-mono text-[11px] text-[hsl(var(--nx-muted))]">/ 2,500 monthly</p>
                      </div>
                    </div>
                  </div>

                  {/* Storage */}
                  <div className="nx-glass nx-hover-lift relative rounded-2xl p-5">
                    <HudCorners />
                    <p className="nx-microlabel flex items-center gap-2">
                      <HardDrive className="h-3 w-3" /> Storage
                    </p>
                    <p className="nx-display mt-3 text-2xl font-semibold">
                      38.2 <span className="text-sm font-normal text-[hsl(var(--nx-muted))]">/ 100 GB</span>
                    </p>
                    <div className="nx-progress mt-4">
                      <div className="nx-progress-fill" style={{ width: "38%" }} />
                    </div>
                    <p className="nx-mono mt-2 text-[10px] text-[hsl(var(--nx-muted))]">RAW 24.1 · JPEG 11.6 · PREVIEWS 2.5</p>
                  </div>

                  {/* Collections + sparkline */}
                  <div className="nx-glass nx-hover-lift relative rounded-2xl p-5">
                    <HudCorners />
                    <p className="nx-microlabel">Active collections</p>
                    <div className="mt-3 flex items-end justify-between gap-3">
                      <p className="nx-display text-3xl font-semibold">12</p>
                      <svg viewBox="0 0 108 28" className="h-8 w-24 overflow-visible">
                        <polyline
                          points={sparkline}
                          fill="none"
                          stroke="url(#nx-spark)"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <defs>
                          <linearGradient id="nx-spark" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0" stopColor="hsl(326 100% 60%)" />
                            <stop offset="1" stopColor="hsl(187 100% 55%)" />
                          </linearGradient>
                        </defs>
                        <circle cx="108" cy="2" r="3" fill="hsl(187 100% 55%)" />
                      </svg>
                    </div>
                    <p className="nx-mono mt-2 text-[10px] text-[hsl(var(--nx-green))]">▲ 3 delivered this week</p>
                  </div>

                  {/* Neural engine */}
                  <div className="nx-glass nx-hover-lift relative rounded-2xl p-5">
                    <HudCorners />
                    <p className="nx-microlabel flex items-center gap-2">
                      <Cpu className="h-3 w-3" /> Neural engine
                    </p>
                    <div className="mt-3 flex items-center gap-4">
                      <div className="nx-orb h-14 w-14 shrink-0">
                        <div className="nx-orb-ring" />
                        <div className="nx-orb-core" />
                      </div>
                      <div>
                        <p className="nx-display text-lg font-semibold text-[hsl(var(--nx-cyan))]">3 jobs</p>
                        <p className="nx-mono text-[11px] text-[hsl(var(--nx-muted))]">est. 14 min to clear</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recent collections */}
                <div className="mt-10">
                  <div className="mb-4 flex items-center justify-between">
                    <p className="nx-microlabel">Recent collections</p>
                    <span className="nx-mono flex items-center gap-1 text-[11px] text-[hsl(var(--nx-cyan))]">
                      View all <ChevronRight className="h-3 w-3" />
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                    {collections.map((c) => (
                      <div key={c.name} className="nx-glass nx-hover-lift group relative overflow-hidden rounded-2xl">
                        <HudCorners />
                        <div className="relative aspect-[4/3] overflow-hidden">
                          <img
                            src={c.img}
                            alt={c.name}
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                            style={{ filter: c.filter }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-[hsl(var(--nx-void)/0.9)] via-transparent to-transparent" />
                          <span className="nx-chip absolute left-3 top-3 !bg-[hsl(var(--nx-void)/0.75)]">
                            <span className={`nx-led ${c.led} nx-led-pulse`} /> {c.status}
                          </span>
                          <ArrowUpRight className="absolute right-3 top-3 h-4 w-4 text-white/0 transition-all duration-300 group-hover:text-white/90" />
                        </div>
                        <div className="flex items-center justify-between px-4 py-3">
                          <p className="nx-display truncate text-sm font-medium">{c.name}</p>
                          <p className="nx-mono shrink-0 pl-3 text-[11px] text-[hsl(var(--nx-muted))]">{c.count}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI activity queue */}
                <div className="mt-10">
                  <p className="nx-microlabel mb-4">Engine queue</p>
                  <div className="nx-glass relative rounded-2xl p-2">
                    <HudCorners />
                    {queue.map((job, i) => (
                      <div
                        key={job.label}
                        className={
                          "flex items-center gap-4 rounded-xl px-4 py-3 " +
                          (i !== queue.length - 1 ? "border-b border-[hsl(var(--nx-line)/0.08)]" : "")
                        }
                      >
                        <div className="nx-scanline h-10 w-14 shrink-0 overflow-hidden rounded-lg">
                          <img src={collections[i].img} alt="" loading="lazy" className="h-full w-full object-cover opacity-80" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{job.label}</p>
                          <p className="nx-mono text-[11px] text-[hsl(var(--nx-muted))]">{job.detail}</p>
                        </div>
                        <div className="hidden w-40 sm:block">
                          <div className="nx-progress">
                            <div className="nx-progress-fill" style={{ width: `${job.pct}%` }} />
                          </div>
                        </div>
                        <span className="nx-mono w-12 text-right text-xs text-[hsl(var(--nx-cyan))]">{job.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 02 · Gallery / culling concept ──────────────────────── */}
        <section id="concept-gallery" className="mb-24">
          <SectionHeader
            index="02"
            title="Gallery — AI Culling Deck"
            subtitle="Every frame carries live HUD telemetry: an AI quality score, focus and eyes checks, face matches. Picks glow cyan, rejects fade back, and frames still being scored show a scanning beam."
          />

          <div className="nx-glass-deep rounded-2xl p-6 md:p-8">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="nx-chip nx-chip-active">All · 1,284</span>
              <span className="nx-chip">AI picks · 96</span>
              <span className="nx-chip">Top 5%</span>
              <span className="nx-chip">
                <ScanFace className="h-3 w-3" /> Faces: Noa
              </span>
              <span className="nx-chip">Rejects · 117</span>
              <div className="ml-auto flex items-center gap-2">
                <button className="nx-btn nx-btn-glass !px-3" aria-label="Filters">
                  <SlidersHorizontal className="h-4 w-4" />
                </button>
                <button className="nx-btn nx-btn-glass !px-3" aria-label="Grid view">
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button className="nx-btn nx-btn-glass !px-3" aria-label="Row view">
                  <Rows3 className="h-4 w-4" />
                </button>
                <button className="nx-btn nx-btn-holo">
                  <Wand2 className="h-4 w-4" /> Aura sort
                </button>
              </div>
            </div>

            {/* Photo grid */}
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {photos.map((p, i) => (
                <div
                  key={i}
                  className={
                    "group relative aspect-[3/4] overflow-hidden rounded-xl border border-[hsl(var(--nx-line)/0.12)] " +
                    (p.state === "selected" ? "nx-ring-select " : "") +
                    (p.state === "processing" ? "nx-scanline " : "")
                  }
                >
                  <img
                    src={p.img}
                    alt={`Frame ${i + 1}`}
                    loading="lazy"
                    className={"h-full w-full object-cover " + (p.state === "reject" ? "nx-tile-reject" : "")}
                    style={{ objectPosition: p.pos, filter: p.state === "reject" ? undefined : p.filter }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[hsl(var(--nx-void)/0.8)] via-transparent to-[hsl(var(--nx-void)/0.25)]" />

                  {/* Score */}
                  <span
                    className={
                      "nx-mono absolute left-2.5 top-2.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold backdrop-blur " +
                      (p.state === "reject"
                        ? "bg-[hsl(var(--nx-void)/0.7)] text-[hsl(var(--nx-muted))]"
                        : "bg-[hsl(var(--nx-void)/0.7)] text-[hsl(var(--nx-cyan))]")
                    }
                  >
                    {p.score}
                  </span>

                  {/* Pick / reject mark */}
                  {(p.state === "pick" || p.state === "selected") && (
                    <span className="absolute right-2.5 top-2.5 grid h-6 w-6 place-items-center rounded-full bg-[hsl(var(--nx-cyan))] text-[hsl(248_36%_6%)] shadow-[0_0_16px_hsl(var(--nx-cyan)/0.8)]">
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                  )}
                  {p.state === "reject" && (
                    <span className="absolute right-2.5 top-2.5 grid h-6 w-6 place-items-center rounded-full border border-[hsl(0_75%_60%/0.6)] bg-[hsl(var(--nx-void)/0.7)] text-[hsl(0_85%_65%)]">
                      <X className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                  )}

                  {/* Telemetry footer */}
                  <div className="absolute inset-x-2.5 bottom-2.5 flex items-center gap-1.5">
                    {p.state === "processing" ? (
                      <span className="nx-mono rounded-md bg-[hsl(var(--nx-void)/0.75)] px-1.5 py-0.5 text-[10px] tracking-[0.18em] text-[hsl(var(--nx-cyan))]">
                        SCORING…
                      </span>
                    ) : p.state !== "reject" ? (
                      <>
                        <span className="nx-mono flex items-center gap-1 rounded-md bg-[hsl(var(--nx-void)/0.75)] px-1.5 py-0.5 text-[10px] text-[hsl(var(--nx-green))]">
                          <Focus className="h-2.5 w-2.5" /> FOCUS
                        </span>
                        <span className="nx-mono flex items-center gap-1 rounded-md bg-[hsl(var(--nx-void)/0.75)] px-1.5 py-0.5 text-[10px] text-[hsl(var(--nx-green))]">
                          <Users className="h-2.5 w-2.5" /> EYES
                        </span>
                      </>
                    ) : (
                      <span className="nx-mono rounded-md bg-[hsl(var(--nx-void)/0.75)] px-1.5 py-0.5 text-[10px] text-[hsl(var(--nx-muted))]">
                        SOFT FOCUS
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Before / after */}
            <div className="mt-8 grid gap-4 lg:grid-cols-[1.4fr,1fr]">
              <div className="relative overflow-hidden rounded-2xl border border-[hsl(var(--nx-line)/0.14)]">
                <div className="relative aspect-[21/10]">
                  <img src={hero3} alt="Raw frame" className="absolute inset-0 h-full w-full object-cover" style={{ filter: "saturate(0.55) contrast(0.9) brightness(0.92)" }} />
                  <img
                    src={hero3}
                    alt="Retouched frame"
                    className="absolute inset-0 h-full w-full object-cover"
                    style={{ clipPath: "polygon(46% 0, 100% 0, 100% 100%, 46% 100%)", filter: "saturate(1.15) contrast(1.08)" }}
                  />
                  <div className="absolute inset-y-0 left-[46%] w-px bg-[hsl(var(--nx-cyan))] shadow-[0_0_18px_hsl(var(--nx-cyan))]" />
                  <span className="nx-mono absolute bottom-3 left-3 rounded-md bg-[hsl(var(--nx-void)/0.8)] px-2 py-1 text-[10px] tracking-[0.2em] text-[hsl(var(--nx-muted))]">RAW</span>
                  <span className="nx-mono absolute bottom-3 right-3 rounded-md bg-[hsl(var(--nx-void)/0.8)] px-2 py-1 text-[10px] tracking-[0.2em] text-[hsl(var(--nx-cyan))]">NEXUS RETOUCH</span>
                </div>
              </div>

              <div className="nx-glass relative rounded-2xl p-5">
                <HudCorners />
                <p className="nx-microlabel flex items-center gap-2">
                  <Sparkles className="h-3 w-3" /> Style applied
                </p>
                <p className="nx-display mt-2 text-xl font-semibold">Film Noir 02</p>
                <p className="mt-1 text-sm text-[hsl(var(--nx-muted))]">
                  Trained on 240 of your reference edits · v3
                </p>
                <div className="mt-4 space-y-3">
                  {[
                    { k: "Tone match", v: 96 },
                    { k: "Skin fidelity", v: 99 },
                    { k: "Grain character", v: 88 },
                  ].map((row) => (
                    <div key={row.k}>
                      <div className="mb-1 flex justify-between">
                        <span className="nx-mono text-[11px] text-[hsl(var(--nx-muted))]">{row.k}</span>
                        <span className="nx-mono text-[11px] text-[hsl(var(--nx-cyan))]">{row.v}</span>
                      </div>
                      <div className="nx-progress">
                        <div className="nx-progress-fill" style={{ width: `${row.v}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                <button className="nx-btn nx-btn-holo mt-5 w-full">Apply to 96 picks</button>
              </div>
            </div>
          </div>
        </section>

        {/* ── 03 · Design tokens ──────────────────────────────────── */}
        <section id="concept-tokens" className="mb-24">
          <SectionHeader
            index="03"
            title="Design Tokens"
            subtitle="The quantum spectrum keeps today's brand magenta but shifts the primary action color to quantum cyan, with ultraviolet bridging the two. Space Grotesk carries display type; JetBrains Mono carries telemetry."
          />

          <div className="grid gap-4 md:grid-cols-7 grid-cols-2">
            {palette.map((c) => (
              <div key={c.name} className="nx-glass rounded-2xl p-3">
                <div className={`h-16 rounded-xl ${c.cls}`} />
                <p className="nx-microlabel mt-3 !text-[9px]">{c.name}</p>
                <p className="nx-mono mt-1 text-[10px] text-[hsl(var(--nx-muted))]">{c.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="nx-glass relative rounded-2xl p-6">
              <HudCorners />
              <p className="nx-microlabel mb-5">Typography</p>
              <p className="nx-display text-4xl font-bold">Space Grotesk <span className="nx-holo-text">700</span></p>
              <p className="nx-display mt-2 text-xl font-medium text-[hsl(var(--nx-muted))]">Display & headings — geometric, technical warmth</p>
              <p className="mt-4 text-sm leading-relaxed">
                Inter 400/500 stays for body copy: quiet, legible, already loaded by the product.
              </p>
              <p className="nx-mono mt-4 text-xs text-[hsl(var(--nx-cyan))]">
                JETBRAINS MONO — telemetry · counts · timestamps · scores
              </p>
            </div>

            <div className="nx-glass relative rounded-2xl p-6">
              <HudCorners />
              <p className="nx-microlabel mb-5">Surfaces & effects</p>
              <div className="space-y-3">
                {[
                  { k: "Glass panel", v: "blur 22px · saturate 140% · specular top edge" },
                  { k: "Deep glass", v: "blur 28px · for framing shells & modals" },
                  { k: "HUD brackets", v: "1.5px cyan corners on telemetry tiles" },
                  { k: "Energy hover", v: "lift 3px + cyan ring + 44px glow" },
                  { k: "Radius scale", v: "12 / 16 / 24 px — softened, capsule chips" },
                ].map((row) => (
                  <div key={row.k} className="flex items-baseline justify-between gap-4 border-b border-[hsl(var(--nx-line)/0.08)] pb-2">
                    <span className="text-sm font-medium">{row.k}</span>
                    <span className="nx-mono text-right text-[11px] text-[hsl(var(--nx-muted))]">{row.v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── 04 · Components ─────────────────────────────────────── */}
        <section id="concept-components" className="mb-20">
          <SectionHeader
            index="04"
            title="Core Components"
            subtitle="The working set, restyled: holographic primary actions, glass secondaries, energized focus states, capsule status chips and shimmer progress."
          />

          <div className="nx-glass-deep rounded-2xl p-6 md:p-8">
            <div className="grid gap-8 lg:grid-cols-3">
              {/* Buttons */}
              <div>
                <p className="nx-microlabel mb-4">Buttons</p>
                <div className="flex flex-wrap items-center gap-3">
                  <button className="nx-btn nx-btn-holo">
                    <Sparkles className="h-4 w-4" /> Generate
                  </button>
                  <button className="nx-btn nx-btn-glass">Secondary</button>
                  <button className="nx-btn nx-btn-ghost">Ghost</button>
                  <button className="nx-btn nx-btn-danger">Delete</button>
                </div>

                <p className="nx-microlabel mb-4 mt-8">Status chips</p>
                <div className="flex flex-wrap gap-2">
                  <span className="nx-chip"><span className="nx-led nx-led-green nx-led-pulse" /> Delivered</span>
                  <span className="nx-chip"><span className="nx-led nx-led-cyan nx-led-pulse" /> Processing</span>
                  <span className="nx-chip"><span className="nx-led nx-led-amber nx-led-pulse" /> Culling</span>
                  <span className="nx-chip"><span className="nx-led nx-led-magenta nx-led-pulse" /> Awaiting client</span>
                </div>
              </div>

              {/* Inputs */}
              <div>
                <p className="nx-microlabel mb-4">Inputs</p>
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--nx-muted))]" />
                    <input className="nx-input !pl-9" placeholder="Search the studio…" />
                  </div>
                  <input className="nx-input" defaultValue="Cohen Wedding" />
                  <div className="flex items-center justify-between rounded-xl border border-[hsl(var(--nx-line)/0.14)] bg-[hsl(var(--nx-void)/0.5)] px-4 py-3">
                    <span className="text-sm">Auto-retouch new uploads</span>
                    <span className="nx-switch nx-switch-on" />
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-[hsl(var(--nx-line)/0.14)] bg-[hsl(var(--nx-void)/0.5)] px-4 py-3">
                    <span className="text-sm">Client watermark</span>
                    <span className="nx-switch" />
                  </div>
                </div>
              </div>

              {/* Feedback */}
              <div>
                <p className="nx-microlabel mb-4">Progress & feedback</p>
                <div className="space-y-4">
                  <div>
                    <div className="mb-1.5 flex justify-between">
                      <span className="nx-mono text-[11px] text-[hsl(var(--nx-muted))]">UPLOADING · 412 / 1,284</span>
                      <span className="nx-mono text-[11px] text-[hsl(var(--nx-cyan))]">32%</span>
                    </div>
                    <div className="nx-progress">
                      <div className="nx-progress-fill" style={{ width: "32%" }} />
                    </div>
                  </div>

                  <div className="nx-glass relative flex items-start gap-3 rounded-xl p-4">
                    <HudCorners />
                    <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[hsl(var(--nx-green)/0.15)] text-[hsl(var(--nx-green))]">
                      <Check className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="nx-display text-sm font-semibold">Gallery delivered</p>
                      <p className="mt-0.5 text-xs text-[hsl(var(--nx-muted))]">
                        Cohen Wedding · 96 picks sent to client portal
                      </p>
                    </div>
                  </div>

                  <div className="nx-glass relative flex items-start gap-3 rounded-xl p-4">
                    <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[hsl(var(--nx-cyan)/0.15)]">
                      <div className="nx-orb h-5 w-5">
                        <div className="nx-orb-ring" />
                        <div className="nx-orb-core" />
                      </div>
                    </span>
                    <div>
                      <p className="nx-display text-sm font-semibold">Engine suggestion</p>
                      <p className="mt-0.5 text-xs text-[hsl(var(--nx-muted))]">
                        17 near-duplicates found — keep the sharpest of each set?
                      </p>
                      <div className="mt-2 flex gap-2">
                        <button className="nx-btn nx-btn-holo !px-3 !py-1.5 !text-xs">Review</button>
                        <button className="nx-btn nx-btn-ghost !px-3 !py-1.5 !text-xs">Dismiss</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Footer ──────────────────────────────────────────────── */}
        <footer className="border-t border-[hsl(var(--nx-line)/0.1)] pt-8 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="nx-mono text-[11px] text-[hsl(var(--nx-muted))]">
              IMAGICK // NEXUS · concept v0.1 · branch preview only — not wired to production
            </p>
            <span className="nx-chip">
              <span className="nx-led nx-led-amber nx-led-pulse" /> Awaiting design review
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
