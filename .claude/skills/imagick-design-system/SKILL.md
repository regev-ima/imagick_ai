---
name: imagick-design-system
description: >
  The exact, authoritative LIGHTROOM design system for the imagick.ai app (this
  repo). Use it whenever you design, build, restyle, review, or fix ANY UI here —
  a page, dialog, card, form, chip, button, empty state, or micro-interaction.
  It documents the real tokens (colors, radius, elevation), typography (Inter +
  Roboto Mono, the caption / aura-microlabel / folio classes), every component
  utility class (glass-card, aura-*, plate-keyline, glow-*), the shadcn Button/
  Input/Badge variants, and the signature app patterns (plan-first header with
  inline-editable name + live pills, fixed-height two-column workspace, glow
  footer CTA, the 4-point Sparkle AI mark). Read it BEFORE writing UI so every
  choice matches the published product instead of a generic look. Source of
  truth: src/index.css, tailwind.config.ts, src/components/ui/*, and the
  Create*Page patterns.
---

# Imagick.ai — LIGHTROOM Design System

> **Golden rule:** never invent visual values. Every radius, color, font, and
> spacing choice must come from a token or an existing call-site in this file.
> When in doubt, copy a pattern from the referenced source file verbatim.

The product is a photographer's AI tool. The design goal (set with the founder)
is: **make photographers feel they're inside a professional editor — Lightroom /
Capture One.** Dark-first, neutral graphite panels, brand **royal blue** reserved
for selection + AI, the **4-point sparkle** as the AI mark, **monospace readouts**
for precision. Crisp, instrument-like — *not* soft, rounded, or "friendly SaaS."

Canonical sources (read these if a detail here is ambiguous):
- `src/index.css` — all tokens + component/utility classes (the LIGHTROOM v3 header)
- `tailwind.config.ts` — token→utility mapping, radius scale, fonts, keyframes
- `src/components/ui/button.tsx`, `input.tsx`, `badge.tsx` — primitive variants
- `src/pages/dashboard/CreateGalleryPage.tsx` — the reference "workspace" screen
  (plan-first header, `Pill`, `LookGrid`, glow footer). Treat it as the gold master.

---

## 1. Design principles (the non-negotiables)

1. **Crisp, not soft.** The base radius is **6px** (`--radius: 0.375rem`). Corners
   read like a precision instrument. NEVER use `rounded-xl`/`rounded-2xl`/
   `rounded-3xl` on app chrome (the one exception is fully-round pills/orbs). If a
   mock feels "bubbly," the radius is wrong.
2. **Royal blue is earned.** `--primary` / `--accent` (royal blue) mean **AI or
   selection**. Don't use blue for ordinary borders, plain text, or decoration.
   A neutral element stays graphite.
3. **Monospace = precision.** Labels, readouts, counts, timestamps, and status use
   **Roboto Mono**, uppercase, letter-spaced (`.caption`, `.aura-microlabel`,
   `.aura-chip`, `.folio`). Body copy is **Inter**.
4. **Panels, not glass.** `.glass-card` is a *solid* graphite panel (#1F2024) with a
   hairline border and a soft shadow — despite the name, it is NOT translucent/blurred.
5. **Calm workspaces.** Dense operational screens (create collection, editor,
   admin) have **no ambient particles/orbs/sparkle-bursts.** Reserve ambient motion
   for marketing / celebratory moments only. (`CreateStylePage`'s floating particles
   are a legacy outlier — do not copy them onto workspace screens.)
6. **The photo is the hero.** Chrome recedes (graphite, hairlines, mono labels) so
   imagery pops. Thumbnails get a `.plate-keyline` inset, never a heavy border.
7. **Dark-first, but theme-correct.** Everything is authored for dark; `.light`
   redefines the same tokens (cool white + navy). Style through tokens so both work.

---

## 2. Color tokens

Colors are HSL triples stored in CSS vars and consumed as `hsl(var(--x))` or via
Tailwind color utilities. **Always reference the token, never a raw hex.**

### Core (dark `:root` / `.dark`)

| Token | HSL | ~Hex | Tailwind | Use |
|---|---|---|---|---|
| `--background` | `228 8% 9%` | `#16171A` | `bg-background` | app canvas |
| `--foreground` | `228 13% 92%` | `#E8E9ED` | `text-foreground` | primary text |
| `--card` | `228 8% 13%` | `#1F2024` | `bg-card` | panels |
| `--popover` | `228 8% 16%` | `#26272C` | `bg-popover` | raised menus |
| `--surface-1` | `228 8% 13%` | `#1F2024` | `bg-surface-1` | panel fill |
| `--surface-2` | `228 8% 16%` | `#26272C` | `bg-surface-2` | insets, chips, inputs |
| `--surface-3` | `228 8% 20%` | `#2F3037` | `bg-surface-3` | raised inset |
| `--primary` | `227 88% 56%` | `#2B50F0` | `bg-primary` `text-primary` | **selection, key action, AI** |
| `--primary-foreground` | `0 0% 100%` | `#FFFFFF` | `text-primary-foreground` | on primary |
| `--accent` | `227 100% 62%` | `#3A63FF` | `bg-accent` `text-accent` | **brighter AI blue, the sparkle, glow CTA** |
| `--secondary` | `152 46% 45%` | `#3EA776` | `bg-secondary` `text-secondary` | ready / success |
| `--destructive` | `358 72% 58%` | `#E14954` | `text-destructive` | errors, delete |
| `--muted` | `228 7% 17%` | `#282A2F` | `bg-muted` | quiet fills |
| `--muted-foreground` | `228 6% 58%` | `#8A8C94` | `text-muted-foreground` | secondary text, labels |
| `--border` | `228 7% 21%` | `#33343A` | `border-border` | hairlines |
| `--input` | `228 7% 18%` | `#2B2C31` | `border-input` | input borders |
| `--ring` | `227 88% 56%` | `#2B50F0` | `ring-ring` | focus ring |
| `--rating` | `38 85% 56%` | `#EFA83A` | `text-rating` | star / amber accent |

Semantic colors (`secondary`=good, `rating`=amber, `destructive`=critical) are
**separate from the blue accent** and never substitute for it.

### Light mode (`.light`)

Same token names, redefined: `--background 222 36% 97%` (#F5F7FC), `--foreground
224 62% 14%` (navy #0E1A3A), `--card #FFFFFF`, `--primary 227 86% 52%`, `--border
222 24% 88%`. Because you always style through tokens, components adapt for free —
never hard-code a dark hex.

### Gradients & glows (AI signature — use sparingly)

- `--gradient-primary`: `linear-gradient(115deg, #2B50F0 0%, #3A63FF 60%, #4A66FA 100%)` → `.text-gradient-primary`, `bg-[image:var(--gradient-primary)]` (the `gradient` button).
- `.glow-primary`: `0 0 0 1px hsl(var(--primary)/.5), 0 0 24px -6px hsl(var(--primary)/.5)`.
- `--gradient-glow`: radial blue bloom for hero backdrops.
- Elevation shadows: `--elevation-1` (panels), `--elevation-2` (raised/hover), `--elevation-3` (modals). Prefer these over ad-hoc `shadow-*`.

---

## 3. Radius scale (memorize this)

`--radius: 0.375rem` = **6px**. Tailwind maps:

| Utility | Value | Use |
|---|---|---|
| `rounded-lg` | `var(--radius)` = **6px** | cards, panels, dropzones, buttons |
| `rounded-md` | `calc(var(--radius) - 2px)` = **4px** | inputs, chips, small controls, thumbnails |
| `rounded-sm` | `calc(var(--radius) - 4px)` = **2px** | tiny tags, image cells |
| `rounded-[--radius]` | 6px | explicit panel radius (common in this codebase) |
| `rounded-full` | 999px | pills, orbs, LEDs, toggle knobs, avatars |

**Never** `rounded-xl` (12px) or larger on structural chrome. The Input primitive
uses `rounded-xl` — that's a known soft spot; the workspace screens override it with
crisp inline fields (see §6). Match the workspace, not the raw primitive.

---

## 3b. Layout, containers & spacing (READ before laying out any page)

**Every dashboard page uses the same scaffold** — a full-bleed background wrapper
with padding, then a centered max-width container:
```tsx
<div className="min-h-full bg-background px-4 py-6 lg:px-8">
  <div className="mx-auto w-full max-w-6xl"> … </div>
</div>
```

### Container max-widths — pick by page type. THIS IS FIXED; do not improvise.
| Page type | Container | Call-sites |
|---|---|---|
| **Create / workspace flow** | **`max-w-6xl`** (1152px) | `CreateGalleryPage`, `CreateStylePage` — the two "create" screens MUST match |
| List / detail / admin | `max-w-[1320px]` | `StylesPage`, `DashboardHome`, `BillingPage`, `StyleDetailsPage` content, all `admin/*` pages |
| Media grid (galleries) | `max-w-[1600px]` | `GalleriesPage` |
| Settings / narrow form | `max-w-[1100px]` | `SettingsPage` |
| Centered empty / not-found card | `max-w-md` | "Style not found" card |
| Modal (standard) | `sm:max-w-md` / `sm:max-w-lg` | most dialogs |
| Modal (near-fullscreen viewer) | `sm:max-w-[95vw] h-[92vh]` | training-gallery / lightbox dialog |

> **Sibling screens share a width.** A create flow is `max-w-6xl` — never pick
> `max-w-2xl`/`3xl` for one just because it has fewer fields. Keep the page frame
> identical to its sibling and let the internal columns/cards breathe. Widening the
> *container* while narrowing the *content* to a sub-column is fine ONLY if the
> sibling does the same; otherwise fill the container.

### Page padding rhythm
`px-4 py-5`/`py-6` on mobile → `lg:px-8` on desktop. A **fixed-height workspace**
(e.g. CreateGalleryPage) adds `lg:h-full lg:overflow-hidden` and scrolls its columns
internally (`flex min-h-0 flex-col` + inner `overflow-y-auto`); a **normal page**
uses `min-h-full` and lets the body scroll.

### Spacing scale (the Tailwind steps actually used — stay on them)
- Stacked cards / sections: `space-y-4` (dense) … `space-y-6` (roomy) … `space-y-8` (hero).
- Card padding: `p-5` (`glass-card rounded-[--radius] p-5`); compact cards `px-4 py-3`.
- Inline gaps: `gap-1.5` (chips/pills, icon+label), `gap-2` (chip rows, button icon),
  `gap-3` (form rows; header row uses `gap-x-3 gap-y-2`).
- Label → control `mb-2`/`mb-2.5`; help text under a title `mt-1`; grids `gap-4`.

### Responsive breakpoints (mobile-first)
`sm:` (640px) collapses two-up grids to one column. `lg:` (1024px) is the desktop
workspace threshold — columns appear, padding grows (`lg:px-8`), fixed-height kicks in
(`lg:h-full`). Two-column workspace grid: `lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]`.

### Z-index scale — only 10 / 20 / 30 / 50
`z-10` in-card overlays & the lightbox layer · `z-20` labels over media · `z-50`
modals, dialogs, fixed action bars. Don't invent values between.

### States (encode state in form, not just text)
- **Loading**: inline `Loader2` (`h-4 w-4 animate-spin text-primary`); `<Orb>` for a
  hero/AI load; `AdminLoading` for admin tables; `.thumbnail-shimmer` for image tiles.
- **Empty**: centered `glass-card` with a muted icon in a `rounded-[--radius] border
  bg-muted` tile, a `text-lg font-semibold tracking-tight` line, a muted explainer
  (`AdminEmptyState`, or StyleDetailsPage's "No examples yet").
- **Error**: inline box `rounded-[--radius] border border-destructive/30 bg-destructive/10`
  + `AlertTriangle`. A NON-blocking warning uses `--rating` (amber) instead of destructive.
- **Focus**: always `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`
  (buttons add `ring-offset-2 ring-offset-background`).
- **Busy / locked**: freeze a form mid-submit with `pointer-events-none select-none opacity-60`.

### Toasts
`sonner` — `import { toast } from "sonner"`; `toast.success/error(...)`, past-tense
("Training started"), specific and blameless.

---

## 4. Typography

Two families, loaded via Google Fonts in `src/index.css`:
- **Inter** — `font-sans` / `font-display`. Weights 400/500/600/700/800. All prose,
  headings, buttons, inputs.
- **Roboto Mono** — `font-mono`. Weights 400/500/600. All labels, readouts, counts,
  timestamps, status. This mono-for-instrumentation split is the system's signature.

### Named text classes (from `src/index.css`) — prefer these over ad-hoc styles

| Class | Spec | Use |
|---|---|---|
| `.caption` | Roboto Mono · 11px (`.6875rem`) · 500 · `letter-spacing .12em` · UPPERCASE · muted | section labels ("Photos"), inline readouts |
| `.aura-microlabel` | Roboto Mono · 10px (`.625rem`) · 500 · `letter-spacing .18em` · UPPERCASE · muted | eyebrow labels above a title, group headers |
| `.aura-chip` | Roboto Mono · 10px · 500 · `.12em` · UPPERCASE · `border-border` · `bg-surface-2` · `rounded` (4px) · inline-flex gap .45rem | telemetry/readout chip |
| `.folio` | tabular lining nums · 700 · `letter-spacing -.02em` | big numbers / counts that must align |

Accent-tint a microlabel/caption by adding `text-accent` or `text-primary`
(e.g. `class="aura-microlabel text-accent"`). That's the standard "AI" label color.

### Heading scale (Inter, tracking-tight)

| Role | Classes |
|---|---|
| Page H1 | `text-2xl font-bold tracking-tight` (workspace) → up to `text-4xl/5xl font-semibold` (hero pages) |
| Section H2 | `text-xl font-semibold tracking-tight` |
| Card title | `text-sm font-semibold` (dense) / `text-lg font-semibold tracking-tight` (roomy) |
| Body | `text-sm` (`font-sans`), muted variants `text-muted-foreground` |
| Micro/help | `text-[11px] text-muted-foreground` or `.caption` |

`tracking-tight` (or tighter) on headings; mono labels carry wide tracking instead.

---

## 5. Component & utility classes (catalog from `src/index.css`)

Copy these class names directly; they already encode the system.

**Surfaces**
- `.glass-card` — the panel: solid `#1F2024`, `1px` `--border`, `--elevation-1`. The
  default container for any card/section. Pair with `rounded-[--radius] p-5`.
- `.surface-1/2/3` — tonal fills with rising elevation.
- `.plate` — image frame (card bg + border). `.plate-keyline` — inset white 6%
  keyline for thumbnails (`box-shadow: inset 0 0 0 1px hsl(0 0% 100%/.06)`).

**AI kit (royal-blue "engine" mark)**
- `.aura-ai-border` — animated conic royal-blue keyline + soft blue bloom. Wrap the
  *primary AI panel* (e.g. the "Choose your AI look" card). Use once per screen, max.
- `.aura-orb` + `.aura-orb-halo/-ring/-core` — the luminous AI orb (also `<Orb>` in
  `@/components/aura/Orb`). Used as a hero AI avatar.
- `.aura-chip` — mono readout chip (see §4).
- `.aura-led` — 6px glowing status dot; set color via `--led` (e.g. `--led: var(--rating)`); add `.aura-led-pulse` while active.
- `.aura-gauge` — conic ring gauge (`--gauge: 0–100`).
- `.aura-microlabel`, `.aura-hairline` (1px `--border` divider).

**AI text / borders**
- `.text-gradient-primary` — royal-blue gradient text (reserve for "AI"/brand words).
- `.gradient-border` — static royal-blue keyline (masked).
- `.glow-primary/-secondary/-accent` — blue glow shadows for CTAs.

**Backgrounds**: `.bg-grid-pattern`, `.bg-dots-pattern` (subtle 40px/22px grids).

**Motion utilities**: `.animate-pulse-glow`, `.animate-float`, `.animate-gradient`,
`.animate-neon-pulse` — sparing, AI/hero only. All aura animations already gate on
`prefers-reduced-motion`.

---

## 6. UI primitives (shadcn, in `src/components/ui/`)

### Button (`button.tsx`) — variants & sizes are fixed; use them, don't reinvent

Base: `rounded-md` (4px) · `font-semibold` · `text-sm` · `gap-2` · `active:scale-[0.98]`
· `transition` on the strong ease `cubic-bezier(0.22,0.61,0.36,1)` · `[&_svg]:size-4`.

| Variant | Look | Use |
|---|---|---|
| `default` | `bg-primary text-primary-foreground` hover `/88` | standard primary action |
| `glow` | `bg-accent text-accent-foreground` + blue glow shadow | **the AI / "create & start" CTA** |
| `gradient` | royal-blue gradient bg + glow | premium AI action |
| `outline` | `border-border bg-card` hover border/muted | secondary |
| `ghost` | hover `bg-muted` | tertiary / icon buttons |
| `secondary` | green | success action |
| `destructive` | `border-destructive/40 bg-destructive/10 text-destructive` | delete |
| `link` | `text-accent underline` | inline link |
| `glass` | `.glass-card` panel button | on busy backgrounds |

Sizes: `sm` h-9 px-4 text-xs · `default` h-10 px-5 · `lg` h-12 px-8 text-base · `xl`
h-14 px-10 · `icon` h-10 w-10. Primary CTA on a workspace = `variant="glow" size="lg"`.

### Input (`input.tsx`)
Primitive: `h-10 rounded-xl border-input bg-background/60 px-3.5` + blue focus ring/glow.
NOTE the `rounded-xl`. On **instrument/workspace** screens, prefer the crisp inline
field used in `CreateGalleryPage` (the editable title):
`rounded-md bg-surface-2/40 ring-1 ring-inset ring-border/60 hover:bg-surface-2/70
focus:bg-surface-2 focus:ring-primary/60` with a trailing `Pencil` affordance. For a
plain form field, `Input` with `className="bg-input border-border"` (as in
`CreateStylePage`) is acceptable.

### Badge (`badge.tsx`)
`rounded-full border px-2.5 py-0.5 text-xs font-semibold`. Variants: `default`
(primary tint), `secondary` (green), `destructive`, `outline`. Use for status
("Ready"/"Training"/"No model"), tags.

### The `Pill` pattern (page-level, from `CreateGalleryPage.tsx` lines ~746–759)
Not a primitive — a small local component reused for the header live-summary chips:
```tsx
function Pill({ children, accent = false, danger = false }: { children: React.ReactNode; accent?: boolean; danger?: boolean }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
      danger    ? "border-destructive/50 bg-destructive/10 text-destructive"
      : accent  ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-surface-2 text-muted-foreground",
    )}>{children}</span>
  );
}
```
Copy it as-is when a screen needs a live-summary row. `accent` = the headline metric
(e.g. credits/edits), `danger` = an over-limit / error metric.

Other primitives to reuse rather than restyle: `Select`, `Switch` (toggle with a
`motion.span` knob, see the culling card), `Tabs`, `Separator`, `AlertDialog`,
`Dialog`, `Sheet`, `Progress`, `Textarea`, `Label`.

---

## 7. Signature patterns (copy these, don't re-derive)

### 7a. The plan-first workspace header
The app's most recognizable pattern (`CreateGalleryPage.tsx` ~L421–448):
a mono microlabel on its own line, then ONE aligned row — back button · **inline-
editable title** (large `text-2xl font-bold`, `bg-surface-2/40` ring, trailing pencil)
· **live summary `Pill`s** pushed to the right that recalculate as the user works.
```tsx
<span className="aura-microlabel flex items-center gap-1.5 text-accent"><Sparkle size={11} /> New collection · live plan</span>
<div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-2">
  <Button variant="ghost" size="icon" onClick={handleLeave} aria-label="Back"><ArrowLeft className="h-5 w-5" /></Button>
  <div className="group relative min-w-0 flex-1"> {/* inline editable name + <Pencil/> */} </div>
  <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto sm:justify-end"> {/* <Pill/> x N */} </div>
</div>
```

### 7b. Fixed-height two-column workspace
Dense create/edit screens fill the viewport and scroll **internally**, so the page
itself never scrolls on desktop: outer `min-h-full lg:h-full lg:overflow-hidden`, a
grid `lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:grid-rows-[minmax(0,1fr)]`, each
column `flex min-h-0 flex-col` with inner `overflow-y-auto`. When work is in flight,
freeze controls: `busy && "pointer-events-none select-none opacity-60"`.

### 7c. Spanning footer: summary card + glow CTA
Below the columns, a full-width row: a live cost/plan `glass-card` on the left
(progress bar + `.caption` explainer) and the primary action on the right in a fixed
`lg:w-[320px]` column — `variant="glow" size="lg"` with a `Zap`/`Sparkle` icon and a
`text-[11px] text-muted-foreground/70` sub-line beneath it.

### 7d. The Sparkle — the AI mark
A 4-point star, tinted via `currentColor` (usually `text-accent`). Inline SVG:
```tsx
<svg width={size} height={size} viewBox="0 0 24 24" aria-hidden style={{ display: "block" }}>
  <path d="M12 0 C12.9 7.2 16.8 11.1 24 12 C16.8 12.9 12.9 16.8 12 24 C11.1 16.8 7.2 12.9 0 12 C7.2 11.1 11.1 7.2 12 0 Z" fill="currentColor" />
</svg>
```
Use it for AI eyebrows, the glow CTA, "your AI models" group labels. For a richer AI
avatar use `<Orb>` (`.aura-orb`).

### 7e. Selectable visual tile (looks / options)
Aspect `4/3`, `rounded-[--radius]`, cover image `object-cover`; selected =
`border-primary ring-1 ring-inset ring-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.10)]`;
name overlaid on a bottom black gradient with a small `Sparkle`; a round check
`SelectMark` top-right; optional `Pick` badge (`bg-primary text-primary-foreground`
`text-[8px] uppercase`). Covers with no image get a graphite tile + royal-blue
gradient wash + centered `Sparkle`. See `LookGrid`/`LookTile` in `CreateGalleryPage`.

### 7f. Dropzone
`rounded-[--radius] border-2 border-dashed border-border` · hover
`border-primary/50 hover:bg-primary/[0.03]` · centered `UploadCloud`/`Upload` icon +
`text-sm text-muted-foreground` prompt + a `.caption`/mono hint line
("Minimum 5 · RAW supported"). RAW/HEIC previews are impossible in-browser — render a
graphite tile with a mono `RAW` label instead of a broken `<img>`.

---

## 8. Motion

- Micro-interactions: **150–250ms**. UI feedback stays under 250ms.
- Easing: `--ease-out-strong: cubic-bezier(0.22, 1, 0.36, 1)` (the app's signature
  "LIGHTROOM" ease; the Button uses the sibling `cubic-bezier(0.22,0.61,0.36,1)`).
- Prefer transform/opacity. Toggles animate the knob with `motion.span layout`.
- Always honor `prefers-reduced-motion` (all `.aura-*` animations already do).
- Buttons: `active:scale-[0.98]`. Cards on hover: raise to `--elevation-2` / lift border.
- Do NOT add ambient looping particles/orbs to dense workspace screens (§1.5).

---

## 9. Iconography

- **lucide-react** only (no emoji as icons). Default stroke `1.75–1.8`.
- Sizes: `h-3 w-3` (in mono chips) · `h-3.5 w-3.5` (inline w/ caption) · `h-4 w-4`
  (buttons; the Button auto-sizes `[&_svg]:size-4`) · `h-5 w-5` (icon buttons).
- The AI mark is the custom `Sparkle` SVG (§7d), NOT a lucide icon.
- Shoot/model-type icon set (canonical mapping): Wedding `Heart`, Portrait `User`,
  Newborn `Baby`, Family `Users`, Event `PartyPopper`, Commercial `Briefcase`,
  Real Estate `Home`, Fashion `Shirt`, Food `UtensilsCrossed`, Landscape `Mountain`,
  Street `MapPin`, Sports `Trophy`.

---

## 10. Copy voice

- Buttons say exactly what happens: "Create & start training", "Create & start
  editing", not "Submit". Toast confirms in past tense ("Training started").
- Labels are terse and often mono/uppercase ("TRAINING DATA", "NEW COLLECTION · LIVE PLAN").
- Errors are specific and blameless, near the problem, with the fix
  ("3 credits short for this plan." + Buy/Upgrade actions).
- Numbers use `.folio` / `tabular-nums` so they align.
- Product language over system language: "collection" not "gallery row", "look"/
  "style" not "model config".

---

## 11. Do / Don't quick card

| Do | Don't |
|---|---|
| `rounded-lg`(6) / `rounded-md`(4) / `rounded-sm`(2) / `rounded-full` | `rounded-xl`+ on chrome; random radii |
| Royal blue for AI + selection only | blue borders/text as decoration |
| Roboto Mono uppercase for labels/counts (`.caption`, `.aura-microlabel`) | mono for body; sentence-case labels |
| `.glass-card` graphite panels + `.aura-hairline` dividers | translucent/blurred "glass", heavy borders |
| `Button variant="glow"` for the AI CTA | a hand-rolled blue button |
| Reuse `Pill`, the inline-name header, `LookTile`, dropzone patterns | bespoke one-off components |
| `.plate-keyline` on thumbnails | thick borders around photos |
| Calm workspaces; ambient motion only on hero/celebration | particles/orbs on dense screens |
| Style through tokens (works in light+dark) | hard-coded hex values |
| lucide icons + the `Sparkle` SVG | emoji icons |
| Match the sibling screen's container width (create = `max-w-6xl`) — see §3b | picking `max-w-2xl`/`3xl` because a screen "feels smaller" |
| Z-index only 10/20/30/50; page scaffold `min-h-full bg-background px-4 py-6 lg:px-8` | arbitrary z-index; ad-hoc page shells |

---

## 12. Cheat sheet (paste-ready)

```
Page shell:   <div className="min-h-full bg-background px-4 py-6 lg:px-8"><div className="mx-auto w-full max-w-6xl"> … (create=6xl · list/admin=[1320px] · galleries=[1600px] · settings=[1100px]; see §3b)
Panel:        <div className="glass-card rounded-[--radius] p-5"> … </div>
Section label:<div className="caption mb-2.5">Photos</div>
AI eyebrow:   <span className="aura-microlabel flex items-center gap-1.5 text-accent"><Sparkle size={11}/> Label</span>
Divider:      <hr className="aura-hairline" />
Readout chip: <span className="aura-chip"><span className="aura-led" style={{'--led':'var(--rating)'} as any}/> Training</span>
Live pill:    <Pill accent>…</Pill>   (copy Pill from CreateGalleryPage)
Primary CTA:  <Button variant="glow" size="lg" className="gap-2"><Zap className="h-4 w-4"/> Create & start …</Button>
Input (form): <Input className="bg-input border-border" />
Crisp title:  className="rounded-md bg-surface-2/40 ring-1 ring-inset ring-border/60 focus:ring-primary/60"
Thumb:        className="rounded-sm object-cover plate-keyline"
AI panel:     <div className="aura-ai-border glass-card rounded-[--radius] p-5"> … </div>
```

When you finish any UI change, sanity-check against §11 and run `npx tsc --noEmit`
+ `npm run build`. If a value isn't traceable to a token or a cited call-site, it's wrong.
