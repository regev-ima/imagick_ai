# LIGHTROOM Design System — Portable Spec

> **Self-contained.** Everything needed to reproduce the imagick.ai look in a
> **different** project, any stack (React, Vue, Svelte, plain HTML, native — with
> or without Tailwind). No dependency on the original repo. Copy the CSS blocks
> verbatim; every value below is the real shipping value.

**Direction:** the photographer's professional tool. Dark‑first, neutral
graphite panels (like Lightroom / Capture One), one confident **royal blue** for
selection + AI, a 4‑point **sparkle** as the AI mark, and a **mono readout**
voice for precision. Calm, luminous, instrument‑grade. Never neon‑rainbow.

---

## 0. The one rule

**Colours are HSL CSS variables — never hardcode a brand colour in a component.**
Reference tokens (`hsl(var(--primary))`, `var(--card)`, …). Because of this,
re‑skinning the entire brand hue is a ~15‑line token edit (see §12). The
channels are stored **space‑separated, no `hsl()`** so you can add opacity:
`hsl(var(--primary) / 0.4)`.

---

## 1. Setup — fonts

Add to your `<head>` (or CSS `@import` at the very top):

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Roboto+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```

- **Inter** — everything (headings + body). Weights 400/500/600/700/800.
- **Roboto Mono** — the "instrument readout" voice (captions, chips, stat labels). Weights 400/500/600.

*(Optional, faster: self‑host the woff2 files and drop the network request.)*

---

## 2. Tokens — paste this whole block (`theme.css`)

Dark is the default (`:root`). Light is applied by adding `class="light"` to a
wrapper (or `<html>`). Add `class="dark"` explicitly if you gate themes by class.

```css
:root {
  /* Canvas — neutral graphite */
  --background: 228 8% 9%;            /* #16171A */
  --foreground: 228 13% 92%;         /* #E8E9ED */

  /* Panels (tonal, Lightroom-style) */
  --card: 228 8% 13%;                /* #1F2024 */
  --card-foreground: 228 13% 92%;
  --popover: 228 8% 16%;             /* #26272C */
  --popover-foreground: 228 13% 92%;
  --surface-1: 228 8% 13%;           /* base panel */
  --surface-2: 228 8% 16%;           /* raised */
  --surface-3: 228 8% 20%;           /* highest */

  /* Brand — royal blue */
  --primary: 227 88% 56%;            /* #2B50F0 */
  --primary-foreground: 0 0% 100%;
  --accent: 227 100% 62%;            /* #3A63FF — brighter AI blue */
  --accent-foreground: 0 0% 100%;

  /* Success / "ready" green */
  --secondary: 152 46% 45%;
  --secondary-foreground: 0 0% 100%;

  --muted: 228 7% 17%;
  --muted-foreground: 228 6% 58%;    /* #8A8C94 */
  --destructive: 358 72% 58%;
  --destructive-foreground: 0 0% 100%;

  --border: 228 7% 21%;              /* #33343A hairline */
  --input: 228 7% 18%;
  --ring: 227 88% 56%;
  --rating: 38 85% 56%;              /* amber (stars) */

  --radius: 0.375rem;                /* 6px — crisp, instrument-like */

  /* Gradients (reserved for the AI "engine") */
  --gradient-start: 227 88% 56%;
  --gradient-end: 227 100% 68%;
  --gradient-primary: linear-gradient(115deg, hsl(227 88% 56%) 0%, hsl(227 100% 64%) 60%, hsl(232 90% 70%) 100%);
  --gradient-secondary: linear-gradient(115deg, hsl(227 88% 56%) 0%, hsl(232 80% 64%) 100%);
  --gradient-accent: linear-gradient(135deg, hsl(227 100% 62%) 0%, hsl(227 88% 56%) 100%);
  --gradient-dark: linear-gradient(180deg, hsl(228 8% 13%) 0%, hsl(228 8% 9%) 100%);
  --gradient-glow: radial-gradient(ellipse at center, hsl(227 88% 56% / 0.18) 0%, transparent 70%);

  /* Glow endpoints */
  --glow-primary: 227 88% 56%;
  --glow-secondary: 227 100% 62%;
  --glow-accent: 232 80% 64%;

  /* Panel fill + hairline (a.k.a. "glass") */
  --glass-background: hsl(228 8% 13%);
  --glass-border: hsl(228 7% 21%);

  /* Elevation — the ONLY shadows we use */
  --elevation-1: 0 1px 0 hsl(0 0% 0% / 0.3), 0 1px 2px hsl(0 0% 0% / 0.3);
  --elevation-2: 0 2px 6px hsl(0 0% 0% / 0.35), 0 8px 24px -12px hsl(0 0% 0% / 0.5);
  --elevation-3: 0 4px 12px hsl(0 0% 0% / 0.4), 0 18px 48px -18px hsl(0 0% 0% / 0.6);

  /* Motion */
  --ease-out-strong: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-in-out-strong: cubic-bezier(0.65, 0, 0.35, 1);
  --ease-signature: cubic-bezier(0.22, 0.61, 0.36, 1); /* buttons, nav, reveals */
}

/* Light mode — "soft-proofing daylight": cool white + navy */
.light {
  --background: 222 36% 97%;         /* #F5F7FC */
  --foreground: 224 62% 14%;         /* #0E1A3A navy */
  --card: 0 0% 100%;
  --card-foreground: 224 62% 14%;
  --popover: 0 0% 100%;
  --popover-foreground: 224 62% 14%;
  --surface-1: 0 0% 100%;
  --surface-2: 222 30% 96%;
  --surface-3: 222 26% 92%;
  --primary: 227 86% 52%;
  --primary-foreground: 0 0% 100%;
  --accent: 227 90% 56%;
  --accent-foreground: 0 0% 100%;
  --secondary: 152 52% 36%;
  --secondary-foreground: 0 0% 100%;
  --muted: 222 26% 94%;
  --muted-foreground: 224 14% 42%;
  --destructive: 358 68% 52%;
  --destructive-foreground: 0 0% 100%;
  --border: 222 24% 88%;
  --input: 222 24% 90%;
  --ring: 227 86% 52%;
  --rating: 38 82% 48%;
  --gradient-start: 227 86% 52%;
  --gradient-end: 227 96% 60%;
  --gradient-primary: linear-gradient(115deg, hsl(227 86% 52%) 0%, hsl(227 96% 60%) 100%);
  --gradient-secondary: linear-gradient(115deg, hsl(227 86% 52%) 0%, hsl(232 78% 56%) 100%);
  --glow-primary: 227 86% 52%;
  --glow-secondary: 227 90% 56%;
  --glow-accent: 232 78% 56%;
  --glass-background: hsl(0 0% 100%);
  --glass-border: hsl(222 24% 88%);
  --elevation-1: 0 1px 0 hsl(224 40% 40% / 0.06), 0 1px 2px hsl(224 40% 40% / 0.08);
  --elevation-2: 0 2px 6px hsl(224 40% 40% / 0.08), 0 12px 32px -16px hsl(224 40% 40% / 0.22);
  --elevation-3: 0 4px 12px hsl(224 40% 40% / 0.1), 0 20px 48px -20px hsl(224 40% 40% / 0.26);
}

/* Base */
* { border-color: hsl(var(--border)); box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  font-family: 'Inter', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  margin: 0;
}
```

---

## 3. Colour palette (HSL · hex · role)

### Dark (default)

| Token | HSL | Hex | Role |
|---|---|---|---|
| `--background` | `228 8% 9%` | `#16171A` | app canvas |
| `--foreground` | `228 13% 92%` | `#E8E9ED` | primary text |
| `--card` / `--surface-1` | `228 8% 13%` | `#1F2024` | panel |
| `--surface-2` / `--popover` | `228 8% 16%` | `#26272C` | raised panel / menu |
| `--surface-3` | `228 8% 20%` | `#2F3037` | highest panel |
| `--primary` | `227 88% 56%` | **`#2B50F0`** | brand royal blue — actions, selection, AI |
| `--accent` | `227 100% 62%` | `#3A63FF` | brighter AI blue — the `glow` CTA, sparkle |
| `--secondary` | `152 46% 45%` | `#3DA876` | success / "ready" green |
| `--muted-foreground` | `228 6% 58%` | `#8A8C94` | secondary text, captions |
| `--border` | `228 7% 21%` | `#33343A` | hairline borders |
| `--destructive` | `358 72% 58%` | `#E14B54` | errors |
| `--rating` | `38 85% 56%` | amber | star ratings |

### Opacity conventions (used everywhere — memorise)

| Use | Value |
|---|---|
| Brand tint fill (icon tiles, chips) | `hsl(var(--primary) / 0.12)` → `bg-primary/12` |
| Brand ring on a tint tile | `0 0 0 1px hsl(var(--primary) / 0.2)` → `ring-primary/20` |
| Card hover border | `hsl(var(--primary) / 0.4)` → `hover:border-primary/40` |
| Highlighted card border | `hsl(var(--primary) / 0.5)` |
| Card fill (default) | `hsl(var(--card) / 0.6)` → `bg-card/60` |
| Muted section band | `hsl(var(--surface-1) / 0.4)` |
| Atmospheric glow | `hsl(var(--primary) / 0.12–0.18)` |

---

## 4. Radius ladder ⚠️ (the corner language)

Base `--radius: 6px`. On top of it, the whole UI uses a deliberate, consistent
ladder. **Match it exactly** — this is the detail most often gotten wrong.

| px | Tailwind | Use for |
|---|---|---|
| 6 | `rounded-md` | **buttons**, inputs, small controls, editor/instrument surfaces, icon buttons |
| 8 | `rounded-lg` | icon tiles, image frames *inside* a card, inline article images |
| 12 | `rounded-xl` | **the default card / panel**, nav bar, cover images |
| 16 | `rounded-2xl` | large hero / closing-CTA panels only |
| ∞ | `rounded-full` | pills, badges, kickers, tags, toggles, avatar dots, glows |

Rules: a content card is **12px**. Buttons are **6px**. Pills are **full**.
Nothing is rounder than **16px**.

---

## 5. Typography

**Families:** Inter (`sans`, headings + body), Roboto Mono (`mono`, the readout voice).

| Element | Spec |
|---|---|
| Hero H1 | `Inter 700`, `clamp(2.5rem, 6vw, 4.5rem)` (`text-5xl→7xl`), `line-height: 0.98`, `letter-spacing: -0.03em` |
| Section H2 | `Inter 700`, `1.875rem→2.25rem` (`text-3xl→4xl`), `letter-spacing: -0.02em` |
| Article H1 | `Inter 700`, `1.875rem→2.25rem`, `line-height: 1.12`, `letter-spacing: -0.02em` |
| Card title (big) | `Inter 600`, `1.5rem` (`text-2xl`), `letter-spacing: -0.02em` |
| Card title | `Inter 600`, `1.125rem` (`text-lg`) |
| Lede / subhead | `1.125rem` (`text-lg`), `color: hsl(var(--muted-foreground))` |
| Body | `0.875–1rem`, `line-height: 1.6`, `color: hsl(var(--muted-foreground))` |

Headings are `hsl(var(--foreground))`; supporting copy is `--muted-foreground`.
Negative letter‑spacing on headings is mandatory.

### The mono voice — two utilities (paste)

```css
.caption {  /* eyebrows, labels, dates, metadata */
  font-family: 'Roboto Mono', ui-monospace, monospace;
  font-size: 0.6875rem;      /* 11px */
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: hsl(var(--muted-foreground));
}
.folio {    /* big numbers — stats, prices, step numbers */
  font-variant-numeric: lining-nums tabular-nums;
  font-weight: 700;
  letter-spacing: -0.02em;
}
```

Eyebrows/labels/dates/read‑time → `.caption`. Prices/counters/step numbers →
`.folio`. For a sentence‑case caption (dates, tags) drop the transform +
letter‑spacing.

---

## 6. Utilities & effects (paste)

```css
/* Panel fill (a.k.a. glass card) */
.glass-card { background: var(--glass-background); border: 1px solid var(--glass-border); box-shadow: var(--elevation-1); }

/* AI text — royal-blue gradient */
.text-gradient-primary {
  background: var(--gradient-primary);
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
}

/* Atmospheric backgrounds */
.bg-grid-pattern {
  background-image:
    linear-gradient(to right, hsl(var(--border) / 0.4) 1px, transparent 1px),
    linear-gradient(to bottom, hsl(var(--border) / 0.4) 1px, transparent 1px);
  background-size: 40px 40px;
}
.bg-dots-pattern {
  background-image: radial-gradient(hsl(var(--border) / 0.6) 1px, transparent 1px);
  background-size: 22px 22px;
}

/* Brand glow orb — place absolutely behind a hero */
.glow-orb {
  position: absolute; border-radius: 9999px; filter: blur(64px); pointer-events: none;
  background: radial-gradient(circle, hsl(var(--primary) / 0.16) 0%, transparent 70%);
}

/* 1px hairline rule */
.hairline { height: 1px; border: 0; background: hsl(var(--border)); }

/* Instrument chip (mono telemetry) */
.chip {
  display: inline-flex; align-items: center; gap: 0.45rem;
  padding: 0.25rem 0.6rem; border-radius: 4px;
  border: 1px solid hsl(var(--border)); background: hsl(var(--surface-2));
  font-family: 'Roboto Mono', ui-monospace, monospace;
  font-size: 0.625rem; font-weight: 500; letter-spacing: 0.12em; text-transform: uppercase;
  color: hsl(var(--muted-foreground)); white-space: nowrap;
}
```

---

## 7. Components — recipes (Tailwind classes + plain CSS)

### 7.1 Buttons

Base: `inline-flex items-center justify-center gap-2 rounded-md text-sm font-semibold
transition duration-200 [timing-function:var(--ease-signature)] active:scale-[0.98]`.
Focus ring: `box-shadow: 0 0 0 2px hsl(var(--background)), 0 0 0 4px hsl(var(--ring))`.

| Variant | Look | Use |
|---|---|---|
| **glow** (primary CTA) | `background: hsl(var(--accent)); color: #fff; box-shadow: 0 0 18px -6px hsl(var(--accent)/0.7);` hover → `0 0 26px -6px hsl(var(--accent)/0.9)` | the main "AI" CTA — *Start free*, conversions |
| default | `background: hsl(var(--primary)); color: #fff;` hover `background: hsl(var(--primary)/0.88)` | standard action |
| outline | `border: 1px solid hsl(var(--border)); background: hsl(var(--card));` hover `border-color: hsl(var(--foreground)/0.3); background: hsl(var(--muted))` | secondary |
| ghost | transparent; hover `background: hsl(var(--muted))` | tertiary / nav |
| gradient | `background: var(--gradient-primary); color:#fff;` + blue glow | rare engine emphasis |

Sizes: `sm` = h36 px16 text-xs · `default` = h40 px20 · `lg` = h48 px32 text-base · `xl` = h56 px40 text-lg · `icon` = 40×40.
Primary conversion CTA everywhere = **glow**.

```css
.btn { display:inline-flex; align-items:center; justify-content:center; gap:.5rem;
  height:2.5rem; padding:0 1.25rem; border-radius:calc(var(--radius) - 2px);
  font:600 .875rem/1 'Inter',sans-serif; border:0; cursor:pointer;
  transition: transform .2s var(--ease-signature), box-shadow .2s var(--ease-signature), background-color .2s; }
.btn:active { transform: scale(.98); }
.btn--glow { background:hsl(var(--accent)); color:#fff; box-shadow:0 0 18px -6px hsl(var(--accent)/.7); }
.btn--glow:hover { background:hsl(var(--accent)/.9); box-shadow:0 0 26px -6px hsl(var(--accent)/.9); }
```

### 7.2 Card / panel (the canonical surface)

```css
.card {
  border-radius: 0.75rem;                     /* 12px */
  border: 1px solid hsl(var(--border));
  background: hsl(var(--card) / 0.6);
  padding: 1.5rem;
  transition: border-color .2s var(--ease-signature);
}
.card:hover { border-color: hsl(var(--primary) / 0.4); }
.card--highlight { border-color: hsl(var(--primary) / 0.5); background: hsl(var(--card)); box-shadow: var(--elevation-3); }
```
Tailwind: `rounded-xl border border-border bg-card/60 p-6 transition-colors duration-200 hover:border-primary/40`.
Icon tile inside a card: `48×48, rounded-lg, background: hsl(var(--primary)/0.12), color: hsl(var(--primary)), box-shadow: 0 0 0 1px hsl(var(--primary)/0.2)`, icon 20px.

### 7.3 Nav — sticky glass bar

Fixed, top. Inner bar: `max-width: 72rem; margin: 0 auto; border-radius: 12px;
padding: 10px 16px; border: 1px solid hsl(var(--border) / 0.6);
background: hsl(var(--background) / 0.55); backdrop-filter: blur(24px);
box-shadow: var(--elevation-1);`. On scroll (>12px): `background: hsl(var(--background) / 0.8);
border-color: hsl(var(--border)); box-shadow: var(--elevation-2)`. Keep the glass at all
scroll positions (never fully transparent — content behind must stay frosted/legible).
Links: `0.875rem/500, color: hsl(var(--muted-foreground))`, hover → `--foreground`.

### 7.4 Pills, badges, chips, kicker

- **Kicker** (section eyebrow): `inline-flex; gap 8px; rounded-full; border 1px solid hsl(var(--border)); background hsl(var(--surface-2)); padding 6px 12px;` + a 11px sparkle (`--primary`) + `.caption` text.
- **Category pill:** `rounded-full; background: hsl(var(--primary)/0.12); color: hsl(var(--primary)); padding: 2px 8px;` `.caption` inside.
- **Success pill:** `rounded-full; background: hsl(var(--secondary)/0.15); color: hsl(var(--secondary));`.
- **Tag chip:** `rounded-full; border 1px solid hsl(var(--border)); background: hsl(var(--card)/0.6); padding: 4px 12px;` `.caption` sentence‑case.

### 7.5 Inputs

```css
.input {
  height: 3rem; width: 100%; border-radius: calc(var(--radius) - 2px);
  border: 1px solid hsl(var(--border)); background: hsl(var(--surface-1));
  padding: 0 1rem; font: 400 1rem 'Inter', sans-serif;  /* 16px avoids iOS zoom */
  color: hsl(var(--foreground));
}
.input::placeholder { color: hsl(var(--muted-foreground)); }
.input:focus { outline: none; border-color: hsl(var(--primary) / 0.5); box-shadow: 0 0 0 2px hsl(var(--ring) / 0.4); }
```

### 7.6 Section rhythm & layout

- Page top padding under fixed nav: `8rem` mobile → `10rem` desktop (`pt-32 sm:pt-40`).
- Section vertical rhythm: `5rem` → `7rem` (`py-20 sm:py-28`); lighter sections `2.5rem→4rem`.
- Containers: `72rem` (full), `64rem` (grids), `56rem` (hero), `48rem` (reading). Always `padding-inline: 1rem` (`sm: 1.5rem`), centred.
- Muted band section: `border-block: 1px solid hsl(var(--border)); background: hsl(var(--surface-1) / 0.4)`.
- Anchored sections: `scroll-margin-top: 6rem` so the fixed nav doesn't cover headings.

### 7.7 Long‑form / article ("prose")

Reading column `max-width: 48rem`. Body `1.0625–1.125rem`, `line-height: 1.7`,
`color: hsl(var(--foreground)/0.9)`. Links `color: hsl(var(--primary))`, underline
on hover. Inline images `border-radius: 8px; border: 1px solid hsl(var(--border))`.
Cover image `aspect-ratio: 16/9; border-radius: 12px; border: 1px solid hsl(var(--border)); object-fit: cover`.

---

## 8. The AI mark — the Sparkle (paste)

The 4‑point star is *the* AI signifier (kickers, badges, CTAs). `fill: currentColor`;
colour it with `--primary` (or white on a solid brand button).

```html
<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" style="display:block">
  <path fill="currentColor"
    d="M12 0 C12.9 7.2 16.8 11.1 24 12 C16.8 12.9 12.9 16.8 12 24 C11.1 16.8 7.2 12.9 0 12 C7.2 11.1 11.1 7.2 12 0 Z"/>
</svg>
```

---

## 9. Motion

- **Signature easing:** `cubic-bezier(0.22, 0.61, 0.36, 1)` — buttons, nav, sheets, reveals.
- **Reveal on scroll:** from `{opacity:0; transform:translateY(22px)}` → `{opacity:1; translateY(0)}`, `duration 0.6s`, trigger when ~60px into view, **once**. Stagger siblings by `0.06s`.
- **UI feedback:** `duration 200ms`; pressables `active: scale(0.98)`.
- Always honour `@media (prefers-reduced-motion: reduce)` — render content in its final state, no transforms.

> ⚠️ **Effect footgun (caused a real production outage):** if you drive reveals
> with JS effects (React `useEffect` etc.), **never** use an implicit‑return
> callback that returns a DOM call — e.g. `useEffect(() => window.scrollTo(0,0), [])`.
> The return value becomes a "cleanup", and browser extensions that patch
> `window.scrollTo` to return a value crash the tree. Always use a block body:
> `useEffect(() => { window.scrollTo(0,0); }, [])`.

---

## 10. Tailwind users — config snippet

If the new project uses Tailwind, map the tokens so `bg-card`, `text-primary`,
`rounded-xl`, `font-mono`, etc. work. Put the `theme.css` from §2 in your global
stylesheet, then:

```ts
// tailwind.config.ts
export default {
  darkMode: ["class"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["Roboto Mono", "ui-monospace", "monospace"],
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        surface: { 1: "hsl(var(--surface-1))", 2: "hsl(var(--surface-2))", 3: "hsl(var(--surface-3))" },
        rating: "hsl(var(--rating))",
      },
      borderRadius: { lg: "var(--radius)", md: "calc(var(--radius) - 2px)", sm: "calc(var(--radius) - 4px)" },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
};
```

*(shadcn/ui components drop straight onto these token names.)*

---

## 11. Accessibility & quality bar

- Focus always visible: 2px ring in `--ring` with a `--background` offset.
- Icon‑only controls get `aria-label`; decorative SVGs `aria-hidden`.
- Body text on `--background` and on `--card` meets WCAG AA in both themes.
- Ship both themes; test the toggle. Honour `prefers-reduced-motion`.
- Tap targets ≥ 44×44px on touch. Inputs use 16px font (no iOS zoom‑on‑focus).
- Explicit media dimensions / aspect‑ratio to avoid layout shift; lazy‑load below the fold.

---

## 12. Re‑skinning the brand hue

To switch royal blue for another brand colour, edit **only** these tokens in
both `:root` and `.light`, and leave everything else (neutrals, radius, type,
components) untouched:

```
--primary  --accent  --ring
--gradient-start  --gradient-end  --gradient-primary  --gradient-secondary  --gradient-accent
--glow-primary  --glow-secondary  --glow-accent
```

Every component inherits it automatically.

---

## Quick checklist (the 12 things to get right)

1. Cards = `rounded-xl`, `border` hairline, `bg-card/60`, hover border `primary/40`.
2. Buttons = `rounded-md`; primary CTA = the **glow** variant (accent + blue glow).
3. Pills / badges / kickers / tags / toggles = `rounded-full`.
4. Big CTA / hero panels = `rounded-2xl`; nothing rounder.
5. Headings = Inter bold, negative tracking (`-0.02/-0.03em`), colour `--foreground`.
6. Eyebrows / labels / dates = `.caption` (mono, uppercase). Big numbers = `.folio`.
7. Brand hue only via `--primary`/`--accent` — never hardcode.
8. Tints: fill `primary/12`, ring `primary/20`, hover border `primary/40`.
9. Shadows only from `--elevation-1/2/3`.
10. Motion eases with `cubic-bezier(0.22,0.61,0.36,1)`; reveals `y:22→0, 0.6s`.
11. Section padding `py-20 sm:py-28`; page top `pt-32 sm:pt-40`; container `max-w-6xl`, `px-4 sm:px-6`.
12. The sparkle is the AI mark — colour it `--primary`. Design dark‑first, verify light.
```
