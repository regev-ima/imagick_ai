import "./design-preview.css";
import type { CSSProperties, MouseEvent } from "react";
import {
  LayoutDashboard,
  Images,
  Sparkles,
  CreditCard,
  Settings,
  Search,
  Command,
  HardDrive,
  Zap,
  ArrowUpRight,
  Check,
  X,
  ScanFace,
  Wand2,
  SlidersHorizontal,
  LayoutGrid,
  Rows3,
  ChevronRight,
  Mic,
  CopyX,
  Send,
  MoveHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import imagickLogo from "@/assets/imagick-logo.png";
// One demo photo for every slot, on purpose: photographers bring their
// own images, so the concept showcases the platform chrome, not the
// photography. The repeated frame reads as "your photos go here."
import demoPhoto from "@/assets/hero-gallery-1.jpg";

/* ════════════════════════════════════════════════════════════════════
   IMAGICK // AURA — design concept v2
   ────────────────────────────────────────────────────────────────────
   Internal, unlinked route (/design-preview) rendering the proposed
   redesign over realistic product screens. STATIC MOCK DATA ONLY — no
   Supabase, no auth, no network calls. All styling is scoped in
   design-preview.css under `.aura`. See docs/design/aura-concept.md.

   v2 after review of v1 (NEXUS): one consistent rounded geometry —
   the square HUD brackets are gone — and the "AI is light" instead:
   rotating iridescent borders, a breathing orb with orbiting
   particles, sparkles, scan beams and cursor-following glow.
   ════════════════════════════════════════════════════════════════════ */

/* Cursor-following glow on cards (CSS reads --mx/--my). Writes are
   coalesced to one per frame via rAF — mousemove can fire faster than
   the display refreshes, and each write repaints the glow overlay. */
let glowFrame = 0;
const trackGlow = (e: MouseEvent<HTMLElement>) => {
  const el = e.currentTarget;
  const { clientX, clientY } = e;
  if (glowFrame) return;
  glowFrame = requestAnimationFrame(() => {
    glowFrame = 0;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${clientX - r.left}px`);
    el.style.setProperty("--my", `${clientY - r.top}px`);
  });
};

const Orb = ({ className = "" }: { className?: string }) => (
  <div className={`au-orb ${className}`}>
    <div className="au-orb-halo" />
    <div className="au-orb-ring" />
    <div className="au-orb-ring2" />
    <div className="au-orb-core" />
    <div className="au-orb-orbit" style={{ "--d": "4.5s", "--r": "46%" } as CSSProperties} />
    <div className="au-orb-orbit" style={{ "--d": "7s", "--r": "38%", animationDelay: "-2s" } as CSSProperties} />
  </div>
);

/* A few ✦ sparkles scattered inside a relatively-positioned parent */
const Sparkles3 = () => (
  <>
    <span className="au-spark" style={{ top: "12%", right: "10%" }} />
    <span className="au-spark" style={{ top: "55%", right: "22%", animationDelay: "-0.9s", color: "hsl(var(--au-fuchsia))" }} />
    <span className="au-spark" style={{ top: "30%", right: "42%", animationDelay: "-1.7s", color: "hsl(var(--au-gold))" }} />
  </>
);

const SectionHeader = ({ title, subtitle }: { title: string; subtitle: string }) => (
  <div className="mb-8">
    <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">{title}</h2>
    <p className="mt-2 text-sm text-[hsl(var(--au-muted))] max-w-2xl leading-relaxed">{subtitle}</p>
    <div className="au-hairline mt-5" />
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
  { name: "Cohen Wedding", count: "1,284", status: "Processing", led: "au-led-aqua", pos: "50% 20%" },
  { name: "Noa & Tom · Engagement", count: "312", status: "Culling", led: "au-led-gold", pos: "30% 45%" },
  { name: "Levi Bat-Mitzvah", count: "743", status: "Delivered", led: "au-led-green", pos: "70% 35%" },
  { name: "Studio Portraits · June", count: "96", status: "Delivered", led: "au-led-green", pos: "50% 60%" },
];

const queue = [
  { label: "Neural retouch · Cohen Wedding", detail: "24 / 1,284 images", pct: 62 },
  { label: "Face clustering · Noa & Tom", detail: "weaving 14 identities", pct: 38 },
  { label: "Culling scores · Studio Portraits", detail: "reading focus + eyes", pct: 87 },
];

const promptChips = [
  "Cull the Cohen wedding",
  "Find duplicates",
  "Apply Film Noir to picks",
  "Deliver top 200 to client",
];

const photos = [
  { score: "98.2", state: "pick" as const, pos: "50% 30%" },
  { score: "96.7", state: "pick" as const, pos: "20% 45%" },
  { score: "94.1", state: "selected" as const, pos: "50% 20%" },
  { score: "91.8", state: "none" as const, pos: "75% 50%" },
  { score: "88.4", state: "generating" as const, pos: "60% 30%" },
  { score: "84.0", state: "none" as const, pos: "35% 60%" },
  { score: "41.6", state: "reject" as const, pos: "15% 30%" },
  { score: "37.2", state: "reject" as const, pos: "80% 25%" },
];

const palette = [
  { name: "VOID", value: "258 30% 3.5%", cls: "bg-[hsl(258_30%_3.5%)] border" },
  { name: "GLASS", value: "256 24% 7.5%", cls: "bg-[hsl(256_24%_7.5%)] border" },
  { name: "AURA VIOLET", value: "272 96% 66%", cls: "bg-[hsl(272_96%_66%)]" },
  { name: "FUCHSIA", value: "318 100% 62%", cls: "bg-[hsl(318_100%_62%)]" },
  { name: "AQUA", value: "192 100% 58%", cls: "bg-[hsl(192_100%_58%)]" },
  { name: "CHAMPAGNE", value: "42 96% 62%", cls: "bg-[hsl(42_96%_62%)]" },
  { name: "JADE", value: "160 84% 45%", cls: "bg-[hsl(160_84%_45%)]" },
];

const sparkline = "0,26 12,22 24,24 36,16 48,18 60,10 72,13 84,6 96,9 108,2";

/* ── Page ────────────────────────────────────────────────────────── */

export default function DesignPreview() {
  return (
    <div className="aura au-grain min-h-screen">
      {/* Ambient layers */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="au-stars" />
        <div className="au-nebula w-[64vw] h-[64vw] bg-[hsl(var(--au-violet))] -top-[22vw] -left-[18vw]" />
        <div className="au-nebula w-[52vw] h-[52vw] bg-[hsl(var(--au-aqua))] top-[8%] -right-[20vw]" style={{ animationDelay: "-10s" }} />
        <div className="au-nebula w-[46vw] h-[46vw] bg-[hsl(var(--au-fuchsia))] top-[44%] -left-[14vw]" style={{ animationDelay: "-20s" }} />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 py-16 md:py-24">
        {/* ── Concept hero ─────────────────────────────────────────── */}
        <header className="mb-24 md:mb-32">
          <div className="au-enter flex flex-wrap items-center gap-3" style={{ "--i": 0 } as CSSProperties}>
            <span className="au-chip">
              <span className="au-led au-led-gold au-led-pulse" />
              Concept v2 · not deployed
            </span>
          </div>

          <div className="mt-12 grid items-center gap-12 lg:grid-cols-[1.1fr,0.9fr]">
            <div>
              <img
                src={imagickLogo}
                alt="Imagick.ai"
                className="au-enter h-8 object-contain opacity-90"
                style={{ "--i": 1 } as CSSProperties}
              />

              <h1 className="au-wordmark au-enter mt-6 text-6xl md:text-8xl font-bold leading-none" style={{ "--i": 2 } as CSSProperties}>
                <span className="au-holo-text">AURA</span>
              </h1>
              <p className="au-enter mt-6 max-w-xl text-lg leading-relaxed text-[hsl(var(--au-muted))]" style={{ "--i": 3 } as CSSProperties}>
                One soft, continuous geometry, with the intelligence expressed as{" "}
                <span className="text-[hsl(var(--au-text))]">light</span>: iridescent borders that
                slowly rotate, a breathing AI core, sparkles where the engine touches your photos.
                No hard edges. The machine feels alive, not technical.
              </p>

              <div className="au-enter mt-8 flex flex-wrap gap-3" style={{ "--i": 4 } as CSSProperties}>
                <span className="au-chip au-chip-active">The AI is light</span>
                <span className="au-chip">One geometry</span>
                <span className="au-chip">Conversation-first</span>
                <span className="au-chip">Living gradients</span>
              </div>
            </div>

            {/* Floating deck */}
            <div className="au-perspective au-enter relative hidden h-[380px] lg:block" style={{ "--i": 5 } as CSSProperties}>
              <Orb className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2" />
              <div className="au-rim au-float-tl absolute left-0 top-6 w-56 overflow-hidden rounded-3xl au-glass">
                <img src={demoPhoto} alt="" className="aspect-[3/4] w-full object-cover" />
                <span className="au-chip absolute left-3 top-3 !bg-[hsl(var(--au-void)/0.7)]">
                  <span className="au-led au-led-aqua au-led-pulse" /> Retouching
                </span>
              </div>
              <div className="au-rim au-float-tr absolute right-0 top-0 w-52 overflow-hidden rounded-3xl au-glass">
                <img src={demoPhoto} alt="" className="aspect-[3/4] w-full object-cover" style={{ objectPosition: "20% 40%" }} />
                <span className="au-mono absolute left-3 top-3 rounded-full bg-[hsl(var(--au-void)/0.7)] px-2 py-0.5 text-[10px] text-[hsl(var(--au-aqua))]">98.2</span>
              </div>
              <div className="au-rim au-float-c absolute bottom-0 left-1/2 w-60 overflow-hidden rounded-3xl au-glass" style={{ animationDelay: "-3s" }}>
                <img src={demoPhoto} alt="" className="aspect-[16/10] w-full object-cover" style={{ objectPosition: "50% 25%" }} />
                <div className="relative flex items-center justify-between px-4 py-2.5">
                  <Sparkles3 />
                  <span className="text-xs font-medium">Levi Bat-Mitzvah</span>
                  <span className="au-mono text-[10px] text-[hsl(var(--au-muted))]">743</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* ── 01 · Dashboard concept ──────────────────────────────── */}
        <section id="concept-dashboard" className="mb-24">
          <SectionHeader
            title="Talk to the Studio"
            subtitle="The home screen is built around a conversation. One prompt bar wears the rotating AI border, and everything else (telemetry, collections, the engine queue) orbits around it. While the engine works, the whole frame glows at its edges."
          />

          <div className="au-edge-glow rounded-[28px]">
            <div className="au-glass-deep overflow-hidden rounded-[28px]">
              {/* Window chrome */}
              <div className="flex items-center justify-between px-6 py-3.5 border-b border-[hsl(var(--au-line)/0.08)]">
                <div className="flex items-center gap-3">
                  <Orb className="h-6 w-6" />
                  <span className="au-microlabel">Imagick Studio OS</span>
                </div>
                <span className="au-mono rounded-full border border-[hsl(var(--au-line)/0.1)] bg-[hsl(var(--au-void)/0.5)] px-3 py-1 text-[10px] text-[hsl(var(--au-muted))]">
                  app.imagick.ai · concept render
                </span>
                <div className="flex items-center gap-2">
                  <span className="au-chip">
                    <span className="au-led au-led-aqua au-led-pulse" /> Engine working
                  </span>
                  <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-[hsl(var(--au-fuchsia))] to-[hsl(var(--au-violet))] text-xs font-bold text-white">
                    RG
                  </div>
                </div>
              </div>

              <div className="flex min-h-[640px]">
                {/* Floating pill rail */}
                <aside className="hidden md:flex flex-col items-center justify-center gap-1 px-4">
                  <div className="au-glass flex flex-col items-center gap-1.5 rounded-full px-2 py-3">
                    {railItems.map((item) => (
                      <div
                        key={item.label}
                        title={item.label}
                        className={cn(
                          "grid h-11 w-11 place-items-center rounded-full transition-all",
                          item.active
                            ? "bg-[hsl(var(--au-violet)/0.18)] text-[hsl(var(--au-text))] shadow-[0_0_24px_-4px_hsl(var(--au-violet)/0.8)]"
                            : "text-[hsl(var(--au-muted))] hover:text-[hsl(var(--au-text))]",
                        )}
                      >
                        <item.icon className="h-5 w-5" />
                      </div>
                    ))}
                    <div className="my-1 h-px w-6 bg-[hsl(var(--au-line)/0.15)]" />
                    <div className="relative h-11 w-11">
                      <div className="au-gauge absolute inset-1" style={{ "--gauge": 74 } as CSSProperties} />
                      <span className="au-mono absolute inset-0 grid place-items-center text-[9px] text-[hsl(var(--au-aqua))]">74</span>
                    </div>
                  </div>
                </aside>

                {/* Main column */}
                <div className="flex-1 p-6 pl-2 md:p-10 md:pl-4">
                  {/* Greeting */}
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <p className="au-microlabel">Thursday · June 11 · 21:42</p>
                      <h3 className="mt-2 text-3xl md:text-4xl font-semibold tracking-tight">
                        Good evening, <span className="au-holo-text">Regev</span>
                      </h3>
                    </div>
                    <span className="au-chip">
                      <Zap className="h-3 w-3 text-[hsl(var(--au-gold))]" /> Studio Pro
                    </span>
                  </div>

                  {/* AI prompt bar — the hero of the screen */}
                  <div className="au-ai-border relative mt-8 rounded-full">
                    <div className="relative flex items-center gap-3 rounded-full bg-[hsl(var(--au-void)/0.75)] px-5 py-4 backdrop-blur-xl">
                      <Sparkles3 />
                      <Sparkles className="h-5 w-5 shrink-0 text-[hsl(var(--au-violet))]" />
                      <span className="flex-1 truncate text-sm text-[hsl(var(--au-muted))]">
                        Ask Aura: “cull the Cohen wedding, apply Film Noir 02, deliver the top 200”
                      </span>
                      <Mic className="hidden h-4 w-4 shrink-0 text-[hsl(var(--au-muted))] sm:block" />
                      <span className="au-chip !py-1 hidden sm:inline-flex">
                        <Command className="h-3 w-3" /> K
                      </span>
                      <button className="au-btn au-btn-ai !p-2.5" aria-label="Send">
                        <Send className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {promptChips.map((c) => (
                      <span key={c} className="au-chip hover:border-[hsl(var(--au-violet)/0.5)] cursor-pointer transition-colors">
                        <Wand2 className="h-3 w-3 text-[hsl(var(--au-violet))]" /> {c}
                      </span>
                    ))}
                  </div>

                  {/* Telemetry pills */}
                  <div className="mt-8 grid grid-cols-2 gap-4 xl:grid-cols-4">
                    <div className="au-rim au-glass au-mouse-glow rounded-3xl p-5" onMouseMove={trackGlow}>
                      <p className="au-microlabel">Edits left</p>
                      <div className="mt-3 flex items-center gap-4">
                        <div className="relative h-14 w-14 shrink-0">
                          <div className="au-gauge absolute inset-0" style={{ "--gauge": 74 } as CSSProperties} />
                        </div>
                        <div>
                          <p className="text-2xl font-semibold">1,840</p>
                          <p className="au-mono text-[10px] text-[hsl(var(--au-muted))]">/ 2,500 monthly</p>
                        </div>
                      </div>
                    </div>

                    <div className="au-rim au-glass au-mouse-glow rounded-3xl p-5" onMouseMove={trackGlow}>
                      <p className="au-microlabel flex items-center gap-2">
                        <HardDrive className="h-3 w-3" /> Storage
                      </p>
                      <p className="mt-3 text-2xl font-semibold">
                        38.2 <span className="text-sm font-normal text-[hsl(var(--au-muted))]">/ 100 GB</span>
                      </p>
                      <div className="au-progress mt-4">
                        <div className="au-progress-fill" style={{ width: "38%" }} />
                      </div>
                    </div>

                    <div className="au-rim au-glass au-mouse-glow rounded-3xl p-5" onMouseMove={trackGlow}>
                      <p className="au-microlabel">Collections</p>
                      <div className="mt-3 flex items-end justify-between gap-3">
                        <p className="text-3xl font-semibold">12</p>
                        <svg viewBox="0 0 108 28" className="h-8 w-24 overflow-visible">
                          <defs>
                            <linearGradient id="au-spark-line" x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0" stopColor="hsl(318 100% 62%)" />
                              <stop offset="1" stopColor="hsl(192 100% 58%)" />
                            </linearGradient>
                          </defs>
                          <polyline points={sparkline} fill="none" stroke="url(#au-spark-line)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          <circle cx="108" cy="2" r="3" fill="hsl(192 100% 58%)" />
                        </svg>
                      </div>
                      <p className="au-mono mt-2 text-[10px] text-[hsl(var(--au-green))]">▲ 3 delivered this week</p>
                    </div>

                    <div className="au-ai-border au-mouse-glow rounded-3xl" onMouseMove={trackGlow}>
                      <div className="relative rounded-3xl bg-[hsl(var(--au-void)/0.7)] p-5 backdrop-blur-xl h-full">
                        <p className="au-microlabel">Aura engine</p>
                        <div className="mt-3 flex items-center gap-4">
                          <Orb className="h-12 w-12 shrink-0" />
                          <div>
                            <p className="text-lg font-semibold au-holo-text">3 jobs</p>
                            <p className="au-mono text-[10px] text-[hsl(var(--au-muted))]">est. 14 min to clear</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Recent collections */}
                  <div className="mt-10">
                    <div className="mb-4 flex items-center justify-between">
                      <p className="au-microlabel">Recent collections</p>
                      <span className="au-mono flex items-center gap-1 text-[11px] text-[hsl(var(--au-aqua))]">
                        View all <ChevronRight className="h-3 w-3" />
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                      {collections.map((c) => (
                        <div
                          key={c.name}
                          className="au-rim au-glass au-mouse-glow au-hover-lift group relative overflow-hidden rounded-3xl"
                          onMouseMove={trackGlow}
                        >
                          <div className="relative aspect-[4/3] overflow-hidden">
                            <img
                              src={demoPhoto}
                              alt={c.name}
                              loading="lazy"
                              className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                              style={{ objectPosition: c.pos }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-[hsl(var(--au-void)/0.92)] via-transparent to-transparent" />
                            <span className="au-chip absolute left-3 top-3 !bg-[hsl(var(--au-void)/0.72)]">
                              <span className={`au-led ${c.led} au-led-pulse`} /> {c.status}
                            </span>
                            <ArrowUpRight className="absolute right-3.5 top-3.5 h-4 w-4 text-white/0 transition-all duration-300 group-hover:text-white/90" />
                          </div>
                          <div className="flex items-center justify-between px-4 py-3.5">
                            <p className="truncate text-sm font-medium">{c.name}</p>
                            <p className="au-mono shrink-0 pl-3 text-[11px] text-[hsl(var(--au-muted))]">{c.count}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Engine queue */}
                  <div className="mt-10">
                    <p className="au-microlabel mb-4">Aura is working on</p>
                    <div className="au-rim au-glass rounded-3xl p-2.5">
                      {queue.map((job, i) => (
                        <div
                          key={job.label}
                          className={cn(
                            "flex items-center gap-4 rounded-2xl px-4 py-3.5",
                            i !== queue.length - 1 && "border-b border-[hsl(var(--au-line)/0.07)]",
                          )}
                        >
                          <div className="au-scan h-11 w-16 shrink-0 overflow-hidden rounded-xl">
                            <img src={demoPhoto} alt="" loading="lazy" className="h-full w-full object-cover opacity-85" style={{ objectPosition: collections[i].pos }} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{job.label}</p>
                            <p className="au-mono text-[10px] text-[hsl(var(--au-muted))]">{job.detail}</p>
                          </div>
                          <div className="hidden w-44 sm:block">
                            <div className="au-progress">
                              <div className="au-progress-fill" style={{ width: `${job.pct}%` }} />
                            </div>
                          </div>
                          <span className="au-mono w-12 text-right text-xs text-[hsl(var(--au-aqua))]">{job.pct}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 02 · Gallery / culling concept ──────────────────────── */}
        <section id="concept-gallery" className="mb-24">
          <SectionHeader
            title="The Living Cull"
            subtitle="Scores float as soft pills, picks wear the iridescent ring, rejects dissolve into the dark. Frames the engine is still enhancing shimmer and sparkle, and Aura leans in with suggestions instead of burying them in menus."
          />

          <div className="au-glass-deep rounded-[28px] p-6 md:p-8">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="au-chip au-chip-active">All · 1,284</span>
              <span className="au-chip"><Sparkles className="h-3 w-3 text-[hsl(var(--au-violet))]" /> Aura picks · 96</span>
              <span className="au-chip">Top 5%</span>
              <span className="au-chip"><ScanFace className="h-3 w-3" /> Faces: Noa</span>
              <span className="au-chip">Rejects · 117</span>
              <div className="ml-auto flex items-center gap-2">
                <button className="au-btn au-btn-glass !p-2.5" aria-label="Filters"><SlidersHorizontal className="h-4 w-4" /></button>
                <button className="au-btn au-btn-glass !p-2.5" aria-label="Grid view"><LayoutGrid className="h-4 w-4" /></button>
                <button className="au-btn au-btn-glass !p-2.5" aria-label="Row view"><Rows3 className="h-4 w-4" /></button>
                <button className="au-btn au-btn-ai"><Wand2 className="h-4 w-4" /> Aura sort</button>
              </div>
            </div>

            {/* Photo grid */}
            <div className="mt-6 grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4">
              {photos.map((p, i) => (
                <div
                  key={i}
                  className={cn(
                    "group relative aspect-[3/4] overflow-hidden rounded-2xl",
                    p.state === "selected" && "au-ring-select",
                    p.state === "generating" && "au-scan",
                  )}
                >
                  <img
                    src={demoPhoto}
                    alt={`Frame ${i + 1}`}
                    loading="lazy"
                    className={cn("h-full w-full object-cover", p.state === "reject" && "au-tile-reject")}
                    style={{ objectPosition: p.pos }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[hsl(var(--au-void)/0.78)] via-transparent to-[hsl(var(--au-void)/0.18)]" />

                  {p.state === "generating" && (
                    <>
                      <div className="au-shimmer absolute inset-0 mix-blend-screen" />
                      <Sparkles3 />
                    </>
                  )}

                  {/* Score pill */}
                  <span
                    className={cn(
                      "au-mono absolute left-3 top-3 rounded-full bg-[hsl(var(--au-void)/0.65)] px-2 py-0.5 text-[11px] font-medium backdrop-blur-md",
                      p.state === "reject" ? "text-[hsl(var(--au-muted))]" : "text-[hsl(var(--au-aqua))]",
                    )}
                  >
                    {p.score}
                  </span>

                  {/* Pick / reject mark */}
                  {(p.state === "pick" || p.state === "selected") && (
                    <span className="au-ai-border absolute right-3 top-3 rounded-full">
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-[hsl(var(--au-void)/0.8)] text-[hsl(var(--au-aqua))]">
                        <Check className="h-3.5 w-3.5" strokeWidth={3} />
                      </span>
                    </span>
                  )}
                  {p.state === "reject" && (
                    <span className="absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full bg-[hsl(var(--au-void)/0.7)] text-[hsl(350_85%_68%)]">
                      <X className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                  )}

                  {/* Footer pill */}
                  <div className="absolute inset-x-3 bottom-3">
                    {p.state === "generating" ? (
                      <span className="au-mono inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--au-void)/0.75)] px-2.5 py-1 text-[10px] tracking-[0.16em] text-[hsl(var(--au-violet))]">
                        <Sparkles className="h-3 w-3" /> ENHANCING
                      </span>
                    ) : p.state !== "reject" ? (
                      <span className="au-mono inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--au-void)/0.75)] px-2.5 py-1 text-[10px] tracking-[0.16em] text-[hsl(var(--au-green))]">
                        FOCUS · EYES · SMILE
                      </span>
                    ) : (
                      <span className="au-mono inline-flex rounded-full bg-[hsl(var(--au-void)/0.75)] px-2.5 py-1 text-[10px] tracking-[0.16em] text-[hsl(var(--au-muted))]">
                        SOFT FOCUS
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Aura suggestion — floating, conversational */}
            <div className="au-ai-border mt-6 rounded-3xl">
              <div className="relative flex flex-wrap items-center gap-4 rounded-3xl bg-[hsl(var(--au-void)/0.75)] px-5 py-4 backdrop-blur-xl">
                <Sparkles3 />
                <Orb className="h-9 w-9 shrink-0" />
                <p className="min-w-0 flex-1 text-sm">
                  <span className="font-semibold au-holo-text">Aura</span>{" "}
                  <span className="text-[hsl(var(--au-muted))]">
                    found 17 near-duplicate sets. Keep the sharpest of each and reject 31 frames?
                  </span>
                </p>
                <div className="flex gap-2">
                  <button className="au-btn au-btn-ai !py-2 !text-xs"><CopyX className="h-3.5 w-3.5" /> Clean them up</button>
                  <button className="au-btn au-btn-ghost !py-2 !text-xs">Show me first</button>
                </div>
              </div>
            </div>

            {/* Before / after */}
            <div className="mt-8 grid gap-4 lg:grid-cols-[1.4fr,1fr]">
              <div className="au-rim relative overflow-hidden rounded-3xl">
                <div className="relative aspect-[21/10]">
                  <img src={demoPhoto} alt="Raw frame" className="absolute inset-0 h-full w-full object-cover" style={{ filter: "saturate(0.55) contrast(0.9) brightness(0.92)" }} />
                  <img
                    src={demoPhoto}
                    alt="Retouched frame"
                    className="absolute inset-0 h-full w-full object-cover"
                    style={{ clipPath: "polygon(46% 0, 100% 0, 100% 100%, 46% 100%)", filter: "saturate(1.18) contrast(1.08)" }}
                  />
                  <div className="absolute inset-y-0 left-[46%] w-px bg-gradient-to-b from-[hsl(var(--au-aqua))] via-[hsl(var(--au-violet))] to-[hsl(var(--au-fuchsia))] shadow-[0_0_18px_hsl(var(--au-violet))]" />
                  <span className="au-ai-border absolute left-[46%] top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full">
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-[hsl(var(--au-void)/0.85)] text-[hsl(var(--au-text))]">
                      <MoveHorizontal className="h-4 w-4" />
                    </span>
                  </span>
                  <span className="au-mono absolute bottom-3 left-3 rounded-full bg-[hsl(var(--au-void)/0.75)] px-2.5 py-1 text-[10px] tracking-[0.18em] text-[hsl(var(--au-muted))]">RAW</span>
                  <span className="au-mono absolute bottom-3 right-3 rounded-full bg-[hsl(var(--au-void)/0.75)] px-2.5 py-1 text-[10px] tracking-[0.18em] au-holo-text">AURA RETOUCH</span>
                </div>
              </div>

              <div className="au-rim au-glass au-mouse-glow rounded-3xl p-5" onMouseMove={trackGlow}>
                <p className="au-microlabel flex items-center gap-2">
                  <Sparkles className="h-3 w-3" /> Style applied
                </p>
                <p className="mt-2 text-xl font-semibold">Film Noir 02</p>
                <p className="mt-1 text-sm text-[hsl(var(--au-muted))]">Trained on 240 of your reference edits · v3</p>
                <div className="mt-4 space-y-3.5">
                  {[
                    { k: "Tone match", v: 96 },
                    { k: "Skin fidelity", v: 99 },
                    { k: "Grain character", v: 88 },
                  ].map((row) => (
                    <div key={row.k}>
                      <div className="mb-1.5 flex justify-between">
                        <span className="au-mono text-[10px] text-[hsl(var(--au-muted))]">{row.k}</span>
                        <span className="au-mono text-[10px] text-[hsl(var(--au-aqua))]">{row.v}</span>
                      </div>
                      <div className="au-progress">
                        <div className="au-progress-fill" style={{ width: `${row.v}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                <button className="au-btn au-btn-ai mt-5 w-full">
                  <Sparkles className="h-4 w-4" /> Apply to 96 picks
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ── 03 · Design tokens ──────────────────────────────────── */}
        <section id="concept-tokens" className="mb-24">
          <SectionHeader
            title="Design Tokens"
            subtitle="A bioluminescent spectrum on violet-black glass. The animated tri-hue gradient is reserved for intelligence; champagne marks the premium tier; everything sits on one continuous radius scale."
          />

          {/* Signature gradient */}
          <div className="au-ai-border rounded-3xl">
            <div className="rounded-3xl bg-[hsl(var(--au-void)/0.75)] px-6 py-5 backdrop-blur-xl">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="au-microlabel">The AI signature</p>
                  <p className="mt-1 text-sm text-[hsl(var(--au-muted))]">violet, fuchsia, aqua. Always in slow motion; champagne stays reserved for the premium tier.</p>
                </div>
                <div className="h-10 w-full max-w-md rounded-full au-btn-ai" />
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-7">
            {palette.map((c) => (
              <div key={c.name} className="au-rim au-glass rounded-3xl p-3">
                <div className={`h-16 rounded-2xl ${c.cls}`} />
                <p className="au-microlabel mt-3 !text-[9px]">{c.name}</p>
                <p className="au-mono mt-1 text-[10px] text-[hsl(var(--au-muted))]">{c.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="au-rim au-glass rounded-3xl p-6">
              <p className="au-microlabel mb-5">Typography</p>
              <p className="au-wordmark text-3xl font-bold au-holo-text">Unbounded</p>
              <p className="mt-1 text-sm text-[hsl(var(--au-muted))]">Wordmarks & hero moments only</p>
              <p className="mt-5 text-3xl font-semibold tracking-tight">Sora 600. Headings with quiet confidence.</p>
              <p className="mt-3 text-sm leading-relaxed text-[hsl(var(--au-muted))]">
                Sora 400 carries body copy. It is geometric enough to feel engineered, warm enough for wedding albums.
              </p>
              <p className="au-mono mt-4 text-xs text-[hsl(var(--au-aqua))]">JETBRAINS MONO · scores · counts · timestamps</p>
            </div>

            <div className="au-rim au-glass rounded-3xl p-6">
              <p className="au-microlabel mb-5">Geometry & light</p>
              <div className="flex items-center gap-5">
                {/* Concentric radius demo */}
                <div className="grid h-28 w-28 shrink-0 place-items-center rounded-[28px] border border-[hsl(var(--au-line)/0.25)]">
                  <div className="grid h-20 w-20 place-items-center rounded-[20px] border border-[hsl(var(--au-violet)/0.5)]">
                    <div className="h-12 w-12 rounded-[14px] border border-[hsl(var(--au-aqua)/0.6)]" />
                  </div>
                </div>
                <div className="space-y-2.5 text-sm">
                  <p><span className="font-medium">Concentric radii</span> <span className="au-mono text-[11px] text-[hsl(var(--au-muted))]">28 / 20 / 14, pills for actions</span></p>
                  <p><span className="font-medium">Glass</span> <span className="au-mono text-[11px] text-[hsl(var(--au-muted))]">blur 24-30, saturate 150%, grain 3%</span></p>
                  <p><span className="font-medium">Iridescent rim</span> <span className="au-mono text-[11px] text-[hsl(var(--au-muted))]">1px gradient instead of hard borders</span></p>
                  <p><span className="font-medium">AI border</span> <span className="au-mono text-[11px] text-[hsl(var(--au-muted))]">rotating conic + bloom, engine only</span></p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 04 · Components ─────────────────────────────────────── */}
        <section id="concept-components" className="mb-20">
          <SectionHeader
            title="Core Components"
            subtitle="Pill-first controls. The animated gradient belongs to actions the engine performs; everything human stays calm glass."
          />

          <div className="au-glass-deep rounded-[28px] p-6 md:p-8">
            <div className="grid gap-10 lg:grid-cols-3">
              {/* Buttons */}
              <div>
                <p className="au-microlabel mb-4">Buttons</p>
                <div className="flex flex-wrap items-center gap-3">
                  <button className="au-btn au-btn-ai"><Sparkles className="h-4 w-4" /> Generate</button>
                  <button className="au-btn au-btn-glass">Secondary</button>
                  <button className="au-btn au-btn-ghost">Ghost</button>
                  <button className="au-btn au-btn-danger">Delete</button>
                </div>

                <p className="au-microlabel mb-4 mt-9">Status</p>
                <div className="flex flex-wrap gap-2">
                  <span className="au-chip"><span className="au-led au-led-green au-led-pulse" /> Delivered</span>
                  <span className="au-chip"><span className="au-led au-led-aqua au-led-pulse" /> Processing</span>
                  <span className="au-chip"><span className="au-led au-led-gold au-led-pulse" /> Culling</span>
                  <span className="au-chip"><span className="au-led au-led-fuchsia au-led-pulse" /> Awaiting client</span>
                </div>
              </div>

              {/* Inputs */}
              <div>
                <p className="au-microlabel mb-4">Inputs</p>
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--au-muted))]" />
                    <input className="au-input !pl-10" placeholder="Search the studio…" />
                  </div>
                  <input className="au-input" defaultValue="Cohen Wedding" />
                  <div className="flex items-center justify-between rounded-2xl border border-[hsl(var(--au-line)/0.12)] bg-[hsl(var(--au-void)/0.45)] px-4 py-3">
                    <span className="text-sm">Auto-retouch new uploads</span>
                    <span className="au-switch au-switch-on" />
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-[hsl(var(--au-line)/0.12)] bg-[hsl(var(--au-void)/0.45)] px-4 py-3">
                    <span className="text-sm">Client watermark</span>
                    <span className="au-switch" />
                  </div>
                </div>
              </div>

              {/* Feedback */}
              <div>
                <p className="au-microlabel mb-4">Progress & voice</p>
                <div className="space-y-4">
                  <div>
                    <div className="mb-2 flex justify-between">
                      <span className="au-mono text-[10px] text-[hsl(var(--au-muted))]">UPLOADING · 412 / 1,284</span>
                      <span className="au-mono text-[10px] text-[hsl(var(--au-aqua))]">32%</span>
                    </div>
                    <div className="au-progress">
                      <div className="au-progress-fill" style={{ width: "32%" }} />
                    </div>
                  </div>

                  <div className="au-rim au-glass flex items-start gap-3 rounded-2xl p-4">
                    <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[hsl(var(--au-green)/0.14)] text-[hsl(var(--au-green))]">
                      <Check className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">Gallery delivered</p>
                      <p className="mt-0.5 text-xs text-[hsl(var(--au-muted))]">Cohen Wedding · 96 picks live on the client portal</p>
                    </div>
                  </div>

                  <div className="au-ai-border rounded-2xl">
                    <div className="relative flex items-start gap-3 rounded-2xl bg-[hsl(var(--au-void)/0.75)] p-4 backdrop-blur-xl">
                      <Sparkles3 />
                      <Orb className="mt-0.5 h-7 w-7 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold au-holo-text">Aura</p>
                        <p className="mt-0.5 text-xs text-[hsl(var(--au-muted))]">
                          “The dance-floor frames are underexposed. Lift shadows on all 84?”
                        </p>
                        <div className="mt-2.5 flex gap-2">
                          <button className="au-btn au-btn-ai !px-3.5 !py-1.5 !text-xs">Yes, go</button>
                          <button className="au-btn au-btn-ghost !px-3.5 !py-1.5 !text-xs">Not now</button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Generative skeleton row */}
            <div className="mt-10">
              <p className="au-microlabel mb-4">Generative states</p>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {["Dreaming the layout…", "Reading 1,284 frames…", "Matching your style…", "Polishing skin tones…"].map((t, i) => (
                  <div key={t} className="au-rim relative overflow-hidden rounded-2xl p-4">
                    <div className="au-shimmer absolute inset-0" style={{ animationDelay: `${-i * 0.5}s` }} />
                    <div className="relative">
                      <Sparkles className="h-4 w-4 text-[hsl(var(--au-violet))]" />
                      <p className="au-mono mt-3 text-[10px] tracking-[0.14em] text-[hsl(var(--au-muted))]">{t.toUpperCase()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Footer ──────────────────────────────────────────────── */}
        <footer className="border-t border-[hsl(var(--au-line)/0.08)] pt-8 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="au-mono text-[11px] text-[hsl(var(--au-muted))]">
              Aura concept · internal branch preview, not wired to production
            </p>
            <span className="au-chip">
              <span className="au-led au-led-gold au-led-pulse" /> Awaiting design review
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
