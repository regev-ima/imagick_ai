# Imagick.ai — LIGHTROOM Design System

> **Single source of truth for every visual decision on imagick.ai.**
> This document describes the design **exactly as it ships** — every token,
> radius, type ramp, component recipe and motion curve here is copied from the
> live code (`src/index.css`, `tailwind.config.ts`, `src/components/marketing/*`,
> `src/pages/*`). If you change a value in code, change it here too. If you are
> about to build or restyle anything, match the recipes below to the letter so
> the result is indistinguishable from the rest of the site.

**Direction:** the photographer's professional tool. Dark‑first, neutral
graphite panels like Lightroom / Capture One, a single confident **royal blue**
for selection + AI, a 4‑point **sparkle** as the AI mark, and a **mono readout**
voice for precision. Nothing neon, nothing rainbow. Calm, instrument‑grade.

---

## 0. The one rule that makes re‑skinning trivial

**Never hardcode a brand colour in a component.** Every colour is an HSL CSS
variable in `src/index.css`. Components reference them through Tailwind
(`text-primary`, `bg-card`, `border-border`) or `hsl(var(--…))`. Because of
this, **changing the entire brand hue is a ~15‑line edit** to the token block —
not a component rewrite. Swapping royal blue for any other brand colour means
editing only these variables (in `:root`, `.dark`, and `.light`):

```
--primary  --accent  --ring  --sidebar-primary  --sidebar-ring
--glow-primary  --glow-secondary  --glow-accent
--gradient-start  --gradient-end  --gradient-primary  --gradient-secondary  --gradient-accent
--dynamic-primary  --dynamic-soft   (and the legacy --neon-* aliases)
```

Keep neutrals (`--background`, `--card`, `--surface-*`, `--border`,
`--muted*`), the radius scale, the type ramp and every component recipe fixed —
those define the *system*; the hue is just a variable.

> **One language across the whole product.** The app (platform) and the
> marketing site share this exact token file (`src/index.css`). There is not a
> "site design" and an "app design" — there is one LIGHTROOM language. Don't
> invent a new look for a new page; reuse the recipes below.
>
> **The only legitimate hardcoded colours** are third‑party *service* brand
> colours in `ServiceLogo.tsx` (Google, Meta, LinkedIn, TikTok, Pinterest, GA,
> …) on the tracking/tags admin — those must be each vendor's real hex to be
> recognisable, and are **not** part of our palette. Nothing else in a
> component may hardcode a colour.

---

## 1. Colour tokens

All colours are stored as **space‑separated HSL channels** (no `hsl()`, no
commas) so Tailwind can apply opacity: `hsl(var(--primary) / 0.4)`. Three
themes are defined and kept in sync: `:root` (= dark default), `.dark` (explicit
mirror of `:root`), and `.light`.

### 1.1 Dark (default — `:root` / `.dark`)

| Token | HSL | Hex | Role |
|---|---|---|---|
| `--background` | `228 8% 9%` | `#16171A` | app canvas |
| `--foreground` | `228 13% 92%` | `#E8E9ED` | primary text |
| `--card` | `228 8% 13%` | `#1F2024` | panel fill |
| `--card-foreground` | `228 13% 92%` | — | text on card |
| `--popover` | `228 8% 16%` | `#26272C` | raised menu |
| `--surface-1` | `228 8% 13%` | `#1F2024` | tonal panel (base) |
| `--surface-2` | `228 8% 16%` | `#26272C` | tonal panel (raised) |
| `--surface-3` | `228 8% 20%` | `#2F3037` | tonal panel (highest) |
| `--primary` | `227 88% 56%` | `#2B50F0` | **brand royal blue** — selection, key actions, AI |
| `--primary-foreground` | `0 0% 100%` | `#FFFFFF` | text on primary |
| `--secondary` | `152 46% 45%` | `#3DA876` | "ready / success" green |
| `--accent` | `227 100% 62%` | `#3A63FF` | brighter AI blue — sparkle, `glow` CTA |
| `--muted` | `228 7% 17%` | `#2A2B30` | muted fill |
| `--muted-foreground` | `228 6% 58%` | `#8A8C94` | secondary text, captions |
| `--destructive` | `358 72% 58%` | `#E14B54` | errors |
| `--border` | `228 7% 21%` | `#33343A` | hairline borders |
| `--input` | `228 7% 18%` | — | input fill |
| `--ring` | `227 88% 56%` | `#2B50F0` | focus ring |
| `--rating` | `38 85% 56%` | amber | star ratings |

### 1.2 Light (`.light`) — "soft‑proofing daylight": cool white + navy

| Token | HSL | Role |
|---|---|---|
| `--background` | `222 36% 97%` (`#F5F7FC`) | canvas |
| `--foreground` | `224 62% 14%` (`#0E1A3A` navy) | text |
| `--card` / `--surface-1` | `0 0% 100%` | white panels |
| `--surface-2` | `222 30% 96%` | raised |
| `--surface-3` | `222 26% 92%` | highest |
| `--primary` | `227 86% 52%` | brand blue (slightly deeper for contrast) |
| `--secondary` | `152 52% 36%` | green |
| `--accent` | `227 90% 56%` | AI blue |
| `--muted-foreground` | `224 14% 42%` | secondary text |
| `--border` | `222 24% 88%` | hairline |

> Dark is the default and the hero surface. Light is fully supported (theme
> toggle in the nav) and must never be an afterthought — every new component is
> checked in both. The blog article `prose` uses `dark:prose-invert`.

### 1.3 Opacity conventions (memorise these — they're everywhere)

| Usage | Value |
|---|---|
| Brand tint fill (icon tiles, chips) | `bg-primary/12` |
| Brand ring on tint tile | `ring-1 ring-primary/20` |
| Card hover border | `hover:border-primary/40` |
| Highlighted card border | `border-primary/50` |
| Card fill (default) | `bg-card/60` |
| Muted panel section | `bg-surface-1/40` |
| Success chip fill | `bg-secondary/15` |
| Atmospheric glow | `hsl(var(--primary) / 0.14–0.18)` |

---

## 2. Gradients, glow & elevation

### 2.1 Gradients (reserved for the AI "engine" — sparkle, key CTAs, AI text)

```
--gradient-primary:   linear-gradient(115deg, hsl(227 88% 56%) 0%, hsl(227 100% 64%) 60%, hsl(232 90% 70%) 100%);
--gradient-secondary: linear-gradient(115deg, hsl(227 88% 56%) 0%, hsl(232 80% 64%) 100%);
--gradient-accent:    linear-gradient(135deg, hsl(227 100% 62%) 0%, hsl(227 88% 56%) 100%);
--gradient-glow:      radial-gradient(ellipse at center, hsl(227 88% 56% / 0.18) 0%, transparent 70%);
```

Helpers: `.text-gradient-primary`, `.text-gradient-secondary` (blue gradient
text), `.gradient-border` (royal‑blue keyline via mask). Use gradients
**sparingly** — they signal "our AI", not decoration.

### 2.2 Elevation (the only shadows we use)

```
--elevation-1: 0 1px 0 hsl(0 0% 0% / .3), 0 1px 2px hsl(0 0% 0% / .3);        /* cards at rest */
--elevation-2: 0 2px 6px …, 0 8px 24px -12px …;                               /* nav scrolled, popovers */
--elevation-3: 0 4px 12px …, 0 18px 48px -18px …;                            /* highlighted plan, mobile sheet */
```

Apply as `shadow-[var(--elevation-2)]`. Do **not** invent new box‑shadows;
pick an elevation step. Glow utilities (`.glow-primary`, `.glow-pink`,
`.glow-text`) add a blue bloom for AI emphasis only.

---

## 3. Radius scale — **the corner language** ⚠️

`--radius: 0.375rem` (**6px**) — "crisp, instrument‑like". Tailwind maps
`rounded-lg → var(--radius)`, `md → radius-2px`, `sm → radius-4px`. On top of
that, the marketing surface uses a deliberate, **consistent** ladder. **Match
it exactly** — this is the detail most often gotten wrong.

| Tailwind class | px | Use for |
|---|---|---|
| `rounded-md` | 6 | **buttons**, small controls, editor/instrument surfaces, app‑UI mockups, icon buttons, mobile nav rows |
| `rounded-lg` | 8 | icon tiles, image frames *inside* a card, inline `prose` images |
| `rounded-xl` | 12 | **the default card / panel** — feature cards, pricing tiers, blog cards, nav bar, mobile sheet, cover images |
| `rounded-2xl` | 16 | large hero/CTA panels only (the big closing CTA, the blog CTA block) |
| `rounded-full` | ∞ | pills, badges, kickers, chips, tags, toggles, avatar dots, atmospheric glows |

**Rules:**
- A content card is **`rounded-xl`**. Never `rounded-3xl`, never bare `rounded`.
- Buttons are **`rounded-md`** (comes from the button component — don't override).
- Anything pill‑shaped (kicker, category badge, tag, plan badge, toggle track) is **`rounded-full`**.
- The only place `rounded-2xl` appears is a *large* full‑width CTA/hero panel.

---

## 4. Typography

### 4.1 Families

- **Inter** — `font-sans` **and** `font-display` (headings + body). Weights 400/500/600/700/800. Loaded via Google Fonts `@import` at the top of `index.css`.
- **Roboto Mono** — `font-mono`. Weights 400/500/600. Used for the "instrument readout" voice (captions, chips, stat labels).

### 4.2 Headings (always `font-sans`, tight tracking)

| Element | Recipe |
|---|---|
| Hero H1 | `font-sans text-5xl font-bold leading-[0.98] tracking-[-0.03em] sm:text-6xl md:text-7xl` |
| Section H2 | `font-sans text-3xl font-bold tracking-[-0.02em] sm:text-4xl` |
| Article H1 (blog) | `font-sans text-3xl font-bold leading-[1.12] tracking-[-0.02em] sm:text-4xl` |
| Card H3 (big) | `font-sans text-2xl font-semibold tracking-tight` |
| Card H3 | `text-lg font-semibold tracking-tight` |
| Lede / subhead | `text-lg text-muted-foreground` (hero: `sm:text-xl`) |
| Body | `text-sm leading-relaxed text-muted-foreground` (long‑form: `text-base`) |

Heading colour is `text-foreground`; supporting copy is `text-muted-foreground`.
Negative letter‑spacing on headings (`-0.02em` to `-0.03em`) is mandatory.

### 4.3 The mono voice — two utilities you must reuse

```css
.caption {            /* instrument label / eyebrow / metadata */
  font-family: 'Roboto Mono'; font-size: 0.6875rem; font-weight: 500;
  letter-spacing: 0.12em; text-transform: uppercase; color: hsl(var(--muted-foreground));
}
.folio {              /* big numbers — stats, prices, step numbers */
  font-variant-numeric: lining-nums tabular-nums; font-weight: 700; letter-spacing: -0.02em;
}
```

- Eyebrows, dates, read‑time, category labels, stat labels → `caption`.
- Prices, counters, step numbers → `folio` (e.g. `folio text-4xl text-foreground`).
- To make a caption sentence‑case (dates, tags): add `!normal-case !tracking-normal`.
- Aura variants for AI context: `.aura-microlabel` (wider `0.18em`), `.aura-chip`.

---

## 5. Component recipes (copy these verbatim)

### 5.1 Buttons — `src/components/ui/button.tsx` (cva)

Base: `inline-flex items-center justify-center gap-2 rounded-md text-sm
font-semibold transition-[…] duration-200 [timing:cubic-bezier(0.22,0.61,0.36,1)]
active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring`.

| Variant | Look | When |
|---|---|---|
| `default` | `bg-primary text-primary-foreground hover:bg-primary/88` | standard action |
| `glow` | `bg-accent text-accent-foreground` + `shadow-[0_0_18px_-6px_hsl(var(--accent)/0.7)]`, stronger on hover | **the primary "AI" CTA** — "Start free", conversions |
| `outline` | `border border-border bg-card hover:border-foreground/30 hover:bg-muted` | secondary action |
| `ghost` | `hover:bg-muted hover:text-foreground` | tertiary / nav "Sign in" |
| `gradient` | `bg-[image:var(--gradient-primary)] text-white` + blue glow | rare, engine emphasis |
| `link` | `text-accent underline-offset-4 hover:underline` | inline links |

Sizes: `sm` `h-9 px-4 text-xs` · `default` `h-10 px-5` · `lg` `h-12 px-8 text-base` · `xl` `h-14 px-10 text-lg` · `icon` `h-10 w-10`.
Primary conversion CTA across the site = **`variant="glow"`**. Marketing CTAs
wrap `AppCta` (cross‑domain link to `app.imagick.ai`).

### 5.2 Card / panel (the canonical surface)

```html
<div class="group h-full rounded-xl border border-border bg-card/60 p-6
            transition-colors duration-200 hover:border-primary/40">
```

- Highlighted (e.g. featured plan): `border-primary/50 bg-card shadow-[var(--elevation-3)]`.
- Icon tile inside a card: `inline-grid h-11 w-11 place-items-center rounded-lg bg-primary/12 text-primary ring-1 ring-primary/20` with a `h-5 w-5` lucide icon.
- Inner image frame: `overflow-hidden rounded-lg border border-border`.

### 5.3 Kicker (section eyebrow) — reuse `Reveal.tsx`'s `Kicker`

```html
<div class="inline-flex items-center gap-2 rounded-full border border-border bg-surface-2 px-3 py-1.5">
  <Sparkle size={11} class="text-primary" />
  <span class="caption !tracking-[0.14em] text-muted-foreground">…</span>
</div>
```

### 5.4 Pills, badges, chips

- Category / status pill: `rounded-full bg-primary/12 px-2 py-0.5 !text-primary` (caption inside).
- Success pill: `rounded-full bg-secondary/15 px-2.5 py-1 caption !text-secondary`.
- Floating plan badge: `absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-white shadow-[0_0_18px_-4px_hsl(var(--primary)/0.8)]` + sparkle.
- Tag chip: `rounded-full border border-border bg-card/60 px-3 py-1 caption !normal-case !tracking-normal text-muted-foreground`.

### 5.5 Nav — `MarketingNav.tsx`

Fixed floating pill: wrapper `fixed inset-x-0 top-0 z-50 px-3 pt-3`, inner
`mx-auto max-w-6xl rounded-xl border px-4 py-2.5`. Transparent at top;
scrolled (`> 12px`): `border-border bg-background/80 shadow-[var(--elevation-2)]
backdrop-blur-xl`. Logo `h-6 sm:h-7`. Links `text-sm font-medium
text-muted-foreground hover:text-foreground`. Theme toggle
`h-9 w-9 rounded-md border border-border bg-surface-2`. Right‑side CTA =
`glow` size `sm`. Mobile sheet: framer fade+`y:-8`, `rounded-xl`, `elevation-3`.

### 5.6 Section rhythm & layout

- Page top padding under fixed nav: `pt-32 sm:pt-40`.
- Section vertical rhythm: `py-20 sm:py-28` (or `py-10 sm:py-16` for lighter ones).
- Containers: `max-w-6xl` (full sections) · `max-w-5xl` (grids) · `max-w-4xl` (hero) · `max-w-3xl` (article/reading). Always `px-4 sm:px-6`, `mx-auto`.
- Muted band section: `border-y border-border bg-surface-1/40`.
- Divider: `<hr class="aura-hairline my-8" />` (1px `border`‑coloured rule).
- `scroll-mt-24` on anchored sections so the fixed nav doesn't cover headings.

### 5.7 Atmosphere (backgrounds)

- Grid wash: `bg-grid-pattern opacity-[0.35] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]`.
- Brand glow orb: an absolutely‑positioned `rounded-full blur-3xl` div with
  `background: radial-gradient(circle, hsl(var(--primary) / 0.14–0.18) 0%, transparent 70%)`.
- Dots: `bg-dots-pattern`. Keep atmosphere `pointer-events-none` and subtle.

---

## 6. The AI mark & "Aura" kit

- **Sparkle** (`Sparkle.tsx`) — the 4‑point star, `fill="currentColor"`; colour it `text-primary` (or `text-primary-foreground` on solid brand). This is *the* AI signifier; use it in kickers, badges, CTAs.
- **Aura kit** (`index.css`) — self‑animating royal‑blue AI ornaments, all reduced‑motion aware:
  `.aura-ai-border` (rotating conic keyline + bloom), `.aura-orb*` (luminous core), `.aura-gauge` (ring meter, `--gauge` 0–100), `.aura-chip` + `.aura-led` (mono telemetry chip), `.aura-microlabel`, `.aura-hairline`.
  Reserve these for genuinely AI‑powered surfaces.

---

## 7. Motion

- **Signature easing:** `cubic-bezier(0.22, 0.61, 0.36, 1)` — exported as `EASE` from `Reveal.tsx` and used by buttons, nav, sheets. (`index.css` also defines `--ease-out-strong: cubic-bezier(0.22,1,0.36,1)`.)
- **Reveal on scroll** (`Reveal.tsx`): `initial {opacity:0, y:22}` → `whileInView {opacity:1, y:0}`, `viewport {once:true, margin:"-60px"}`, `duration 0.6`, staggered `delay` (e.g. `(i%3)*0.06`).
- **UI feedback:** `duration-200`, `active:scale-[0.98]` on pressables.
- Named keyframes available: `float`, `pulse-glow`, `gradient-shift`, `shimmer`, `scan`, `pulse-dot`, `thinking-dot`, aura spins. Respect `prefers-reduced-motion`.

---

## 8. Long‑form / blog `prose` theming

Article body uses `@tailwindcss/typography`:

```
prose prose-lg max-w-none dark:prose-invert
prose-headings:font-sans prose-headings:font-semibold prose-headings:tracking-tight
prose-a:text-primary prose-a:no-underline hover:prose-a:underline
prose-img:rounded-lg prose-img:border prose-img:border-border
```

Reading column is `max-w-3xl`. Cover image is `aspect-[16/9] rounded-xl border
border-border object-cover`, `width={1200} height={675}`, `loading="eager"` on
the article page / `loading="lazy"` in lists. Meta row (category pill · date ·
read‑time) uses `caption`. The closing CTA is a `rounded-2xl border
border-primary/30 bg-surface-1 p-8 text-center` panel with a centred sparkle.

---

## 9. Iconography & imagery

- **Icons:** `lucide-react`, stroke default, sized `h-4 w-4` (inline/buttons) or `h-5 w-5` (feature tiles). Buttons auto‑size SVGs to `size-4`.
- **Imagery:** always framed with a hairline (`border border-border`) — the
  "Lightroom cell" keyline (`.plate`, `.plate-keyline`). Set explicit
  `width`/`height` + `aspect-[…]` to avoid CLS. Before/after uses the
  `BeforeAfter` slider component.

---

## 10. Accessibility & quality bar

- Focus is always visible: `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`.
- Every icon‑only control has `aria-label`; decorative SVGs are `aria-hidden`.
- Contrast: body text on `--background` and on `--card` meets AA in both themes.
- Ship both themes; test the toggle. Honour `prefers-reduced-motion`.
- Explicit media dimensions; lazy‑load below‑the‑fold images.

---

## Quick reference (the 12 things to get right)

1. Cards = `rounded-xl border border-border bg-card/60 p-6`, hover `border-primary/40`.
2. Buttons = `rounded-md`; primary CTA = `variant="glow"`.
3. Pills/badges/kickers/tags/toggles = `rounded-full`.
4. Big CTA/hero panels = `rounded-2xl`; nothing rounder.
5. Headings = `font-sans` + bold + `tracking-[-0.02em/-0.03em]`, `text-foreground`.
6. Eyebrows/labels/dates/read‑time = `.caption` (mono, uppercase). Numbers = `.folio`.
7. Brand hue only via `--primary`/`--accent` tokens — never hardcode.
8. Tints: `bg-primary/12`, ring `ring-primary/20`, hover border `/40`.
9. Shadows only from `--elevation-1/2/3`.
10. Motion eases with `cubic-bezier(0.22,0.61,0.36,1)`; reveals `y:22→0, 0.6s`.
11. Section padding `py-20 sm:py-28`; page top `pt-32 sm:pt-40`; container `max-w-6xl px-4 sm:px-6`.
12. The sparkle is the AI mark — colour it `text-primary`. Design for dark first, verify light.
