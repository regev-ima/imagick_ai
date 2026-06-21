import {
  LayoutGrid,
  Images,
  Settings2,
  Star,
  Check,
  Heart,
  Download,
  SlidersHorizontal,
  Search,
  Users,
  Wand2,
  Folder,
} from "lucide-react";
import { Sparkle } from "./Sparkle";
import hero1 from "@/assets/hero-gallery-1.jpg";
import hero2 from "@/assets/hero-gallery-2.jpg";
import hero3 from "@/assets/hero-gallery-3.jpg";

const SHOTS = [hero2, hero1, hero3];
const flat = "saturate(0.6) contrast(0.85) brightness(1.06)";

/** A browser/app window chrome wrapper in the LIGHTROOM language. */
function AppFrame({
  url,
  children,
}: {
  url: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface-2 shadow-[var(--elevation-3)]">
      {/* Title bar */}
      <div className="flex items-center gap-3 border-b border-border bg-surface-3 px-4 py-2.5">
        <div className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full bg-destructive/70" />
          <span className="h-3 w-3 rounded-full bg-rating/70" />
          <span className="h-3 w-3 rounded-full bg-secondary/70" />
        </div>
        <div className="mx-auto flex w-full max-w-xs items-center justify-center gap-2 rounded-md border border-border bg-background/60 px-3 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-secondary" />
          <span className="caption !tracking-normal !normal-case text-muted-foreground/90 truncate">
            {url}
          </span>
        </div>
        <div className="hidden w-12 sm:block" />
      </div>
      {children}
    </div>
  );
}

function RailIcon({
  icon: Icon,
  active = false,
}: {
  icon: typeof LayoutGrid;
  active?: boolean;
}) {
  return (
    <div
      className={`grid h-9 w-9 place-items-center rounded-md transition-colors ${
        active
          ? "bg-primary/15 text-primary ring-1 ring-primary/30"
          : "text-muted-foreground"
      }`}
    >
      <Icon className="h-[18px] w-[18px]" />
    </div>
  );
}

function StarRow({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[0, 1, 2, 3, 4].map((i) => (
        <Star
          key={i}
          className={`h-3 w-3 ${i < n ? "fill-rating text-rating" : "text-muted-foreground/40"}`}
        />
      ))}
    </span>
  );
}

/* ════════════════════════════ EDITOR ════════════════════════════ */
export function EditorMockup() {
  return (
    <AppFrame url="imagick.ai/dashboard/galleries">
      <div className="flex h-[420px] sm:h-[480px]">
        {/* Rail */}
        <aside className="hidden w-14 flex-col items-center gap-2 border-r border-border bg-sidebar py-4 sm:flex">
          <div className="mb-2 grid h-9 w-9 place-items-center rounded-md bg-primary/15 text-primary">
            <Sparkle size={16} className="text-primary" />
          </div>
          <RailIcon icon={LayoutGrid} active />
          <RailIcon icon={Images} />
          <RailIcon icon={Wand2} />
          <RailIcon icon={Folder} />
          <div className="mt-auto">
            <RailIcon icon={Settings2} />
          </div>
        </aside>

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Toolbar */}
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-foreground">
                Ava &amp; Liam — Wedding
              </div>
              <div className="caption !tracking-normal !normal-case text-muted-foreground">
                842 photos
              </div>
            </div>
            <span className="ml-auto inline-flex items-center gap-1.5 rounded bg-secondary/15 px-2 py-1 caption !text-secondary">
              <span className="h-1.5 w-1.5 rounded-full bg-secondary" />
              Ready
            </span>
            <span className="hidden items-center gap-1.5 rounded bg-primary/15 px-2 py-1 caption !text-primary sm:inline-flex">
              <Sparkle size={11} className="text-primary" />
              Auto · Golden Hour
            </span>
          </div>

          {/* Grid */}
          <div className="grid flex-1 grid-cols-3 gap-2 overflow-hidden p-3 md:grid-cols-4">
            {Array.from({ length: 12 }).map((_, i) => {
              const selected = i === 1;
              const rating = [5, 5, 4, 3, 5, 4, 2, 5, 4, 5, 3, 4][i];
              return (
                <div
                  key={i}
                  className={`relative aspect-square overflow-hidden rounded-md border ${
                    selected
                      ? "border-primary ring-2 ring-primary/40"
                      : "border-border"
                  }`}
                >
                  <img
                    src={SHOTS[i % SHOTS.length]}
                    alt=""
                    loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
                    style={{ objectPosition: `${(i * 23) % 100}% 30%` }}
                  />
                  <span className="absolute left-1 top-1 rounded bg-black/55 px-1 py-0.5 backdrop-blur-sm">
                    <StarRow n={rating} />
                  </span>
                  {(i === 0 || i === 4 || i === 7) && (
                    <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded bg-primary text-white">
                      <Sparkle size={10} className="text-white" />
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Inspector */}
        <aside className="hidden w-56 flex-col border-l border-border bg-surface-1 lg:flex">
          <div className="border-b border-border px-4 py-3">
            <div className="aura-microlabel mb-2">AI Style</div>
            <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-2">
              <Sparkle size={13} className="text-primary" />
              <span className="text-xs font-medium text-foreground">Golden Hour</span>
              <span className="ml-auto caption !text-primary">model</span>
            </div>
          </div>
          <div className="space-y-3 px-4 py-4">
            {[
              ["Exposure", "+0.32"],
              ["Contrast", "+18"],
              ["Temp", "5400K"],
              ["Skin tone", "Protected"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between">
                <span className="caption !tracking-normal !normal-case text-muted-foreground">
                  {k}
                </span>
                <span className="folio text-xs text-foreground">{v}</span>
              </div>
            ))}
            <div className="!mt-5 h-px bg-border" />
            <div className="flex items-center gap-2 text-muted-foreground">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span className="caption !tracking-normal !normal-case">Applied to 842 frames</span>
            </div>
          </div>
          <div className="mt-auto border-t border-border p-3">
            <div className="flex items-center justify-center gap-1.5 rounded-md bg-primary py-2 text-xs font-semibold text-white">
              <Download className="h-3.5 w-3.5" /> Export gallery
            </div>
          </div>
        </aside>
      </div>
    </AppFrame>
  );
}

/* ════════════════════════════ CULLING ════════════════════════════ */
export function CullingMockup() {
  const chips = ["All 842", "Top picks ★4+", "Flagged", "Duplicates", "Closed eyes"];
  return (
    <AppFrame url="imagick.ai/dashboard/galleries/cull">
      <div className="flex h-[420px] flex-col sm:h-[480px]">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
          <div className="inline-flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded bg-primary/15 text-primary">
              <Wand2 className="h-4 w-4" />
            </span>
            <div>
              <div className="text-sm font-semibold text-foreground">AI Culling</div>
              <div className="caption !tracking-normal !normal-case text-muted-foreground">
                842 frames analysed
              </div>
            </div>
          </div>
          <div className="ml-auto text-right">
            <div className="folio text-lg text-foreground">
              842 <span className="text-muted-foreground">→</span>{" "}
              <span className="text-secondary">214</span>
            </div>
            <div className="caption !tracking-normal !normal-case text-muted-foreground">
              keepers selected
            </div>
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap gap-2 border-b border-border px-4 py-2.5">
          {chips.map((c, i) => (
            <span
              key={c}
              className={`rounded-full px-2.5 py-1 caption !tracking-normal !normal-case ${
                i === 1
                  ? "bg-primary text-white"
                  : "border border-border bg-surface-1 text-muted-foreground"
              }`}
            >
              {c}
            </span>
          ))}
        </div>

        {/* Grid */}
        <div className="grid flex-1 grid-cols-3 gap-2 overflow-hidden p-3 sm:grid-cols-4 md:grid-cols-5">
          {Array.from({ length: 15 }).map((_, i) => {
            const rejected = i === 3 || i === 9 || i === 12;
            const pick = i === 0 || i === 5 || i === 7;
            const rating = [5, 4, 4, 1, 5, 5, 3, 5, 4, 2, 4, 3, 1, 4, 5][i];
            return (
              <div
                key={i}
                className={`relative aspect-square overflow-hidden rounded-md border border-border ${
                  rejected ? "opacity-35 grayscale" : ""
                }`}
              >
                <img
                  src={SHOTS[i % SHOTS.length]}
                  alt=""
                  loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
                  style={{ objectPosition: `${(i * 37) % 100}% 35%` }}
                />
                <span className="absolute left-1 top-1 rounded bg-black/55 px-1 py-0.5 backdrop-blur-sm">
                  <StarRow n={rating} />
                </span>
                {pick && (
                  <span className="absolute right-1 top-1 inline-flex items-center gap-0.5 rounded bg-primary px-1 py-0.5 caption !text-white">
                    <Sparkle size={9} className="text-white" /> Pick
                  </span>
                )}
                {rejected && (
                  <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded bg-background/80 text-muted-foreground">
                    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </span>
                )}
                {!rejected && (
                  <span className="absolute bottom-1 right-1 grid h-4 w-4 place-items-center rounded-full bg-secondary text-white">
                    <Check className="h-2.5 w-2.5" strokeWidth={3} />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </AppFrame>
  );
}

/* ═══════════════════════ CLIENT GALLERY ═══════════════════════ */
export function ClientGalleryMockup() {
  return (
    <AppFrame url="gallery.imagick.ai/the-bennett-wedding">
      <div className="h-[420px] overflow-hidden bg-surface-1 sm:h-[480px]">
        {/* Client header */}
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <div
              className="truncate text-lg font-semibold tracking-tight text-foreground"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              The Bennett Wedding
            </div>
            <div className="caption !tracking-[0.1em] text-muted-foreground">
              ELEGANT · 214 IMAGES
            </div>
          </div>
          <div className="ml-auto hidden items-center gap-2 sm:flex">
            {/* Face search avatars */}
            <div className="flex -space-x-2">
              {SHOTS.map((s, i) => (
                <img
                  key={i}
                  src={s}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-7 w-7 rounded-full border-2 border-surface-1 object-cover"
                  style={{ objectPosition: "50% 25%" }}
                />
              ))}
              <span className="grid h-7 w-7 place-items-center rounded-full border-2 border-surface-1 bg-primary text-[9px] font-semibold text-white">
                <Search className="h-3 w-3" />
              </span>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white">
              <Download className="h-3.5 w-3.5" /> Download
            </span>
          </div>
        </div>

        {/* Face-search hint */}
        <div className="flex items-center gap-2 border-b border-border bg-primary/[0.06] px-5 py-2">
          <Users className="h-3.5 w-3.5 text-primary" />
          <span className="caption !tracking-normal !normal-case text-foreground/80">
            Tap your face to find every photo you're in
          </span>
        </div>

        {/* Masonry-ish grid */}
        <div className="columns-2 gap-3 p-4 sm:columns-3 md:columns-4">
          {Array.from({ length: 9 }).map((_, i) => {
            const tall = i % 3 === 0;
            const liked = i === 1 || i === 4;
            return (
              <div
                key={i}
                className="mb-3 break-inside-avoid overflow-hidden rounded-lg border border-border"
              >
                <div className={`relative ${tall ? "aspect-[3/4]" : "aspect-square"}`}>
                  <img
                    src={SHOTS[i % SHOTS.length]}
                    alt=""
                    loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
                    style={{ objectPosition: `${(i * 41) % 100}% 30%` }}
                  />
                  <span
                    className={`absolute bottom-2 right-2 grid h-7 w-7 place-items-center rounded-full backdrop-blur ${
                      liked ? "bg-primary text-white" : "bg-black/40 text-white/90"
                    }`}
                  >
                    <Heart className={`h-3.5 w-3.5 ${liked ? "fill-white" : ""}`} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppFrame>
  );
}
