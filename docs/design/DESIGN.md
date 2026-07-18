# LIGHTROOM — imagick.ai design system (portable spec)

A single, self-contained specification for rebuilding the imagick.ai visual
language in **any** project so it looks identical. This is the source of truth,
copied from the product's `src/index.css`, `tailwind.config.ts` and the shadcn
primitives — not a re-interpretation.

**This spec ships with two companion files in `docs/design/`:**

| File | What it's for |
|---|---|
| **`theme.css`** | Drop-in stylesheet: all tokens + base component classes (`.lr-*`). Link it and you have the language. |
| **`ui-kit.html`** | Live visual reference — every component rendered. Open it, or the hosted UI Kit, to *see* the target. |
| **`DESIGN.md`** (this) | The rules an implementer follows: tokens, values, component specs, do/don't. |

> **Golden rule:** never invent visual values. Every radius, color, font and
> spacing choice comes from a token below. If a value isn't traceable to a
> token, it's wrong.

---

## 0. The idea in one paragraph

The product is a **photographer's AI tool**. The design goal: make photographers
feel they're inside a professional editor — *Lightroom / Capture One*. So:
**dark-first**, neutral graphite panels, brand **royal blue (#2B50F0)** reserved
for **AI and selection only**, a **4-point sparkle** as the AI mark, and
**monospace readouts** for precision. Crisp and instrument-like — *not* soft,
rounded, or "friendly SaaS." Light mode exists as a "soft-proofing" daylight
theme (cool white + navy).

---

## 1. Non-negotiable principles

1. **Crisp, not soft.** Base radius is **6px**. Corners read like an instrument.
   Never `border-radius: 12px`+ on chrome. The only fully-round things are
   pills, toggles, avatars, LEDs.
2. **Royal blue is earned.** Blue (`--primary` / `--accent`) means **AI or
   selection**. Never use it for ordinary borders, plain text, or decoration —
   a neutral element stays graphite.
3. **Monospace = precision.** Labels, counts, timestamps, status use **Roboto
   Mono**, uppercase, letter-spaced. Body copy is **Inter**. This split is the
   system's signature.
4. **Panels, not glass.** The panel is a *solid* graphite surface (#1F2024) with
   a hairline border and a soft shadow — despite the class name `glass-card`, it
   is **not** translucent or blurred.
5. **Calm workspaces.** Dense operational screens have no ambient
   particles/orbs. Reserve motion for AI moments and celebration.
6. **The photo is the hero.** Chrome recedes (graphite, hairlines, mono labels)
   so imagery pops. Thumbnails get an inset keyline, never a heavy border.
7. **Style through tokens.** Everything is authored for dark; light redefines the
   same tokens. Never hard-code a hex — reference the token so both themes work.

---

## 2. Color tokens

Stored as **HSL triples** in CSS custom properties, consumed as
`hsl(var(--x))` (or, with alpha, `hsl(var(--x) / 0.5)`). In Tailwind they map to
utilities of the same name (`bg-primary`, `text-muted-foreground`, …).

### Dark (default)

| Token | HSL | Hex | Meaning |
|---|---|---|---|
| `--background` | `228 8% 9%` | `#16171A` | app canvas |
| `--foreground` | `228 13% 92%` | `#E8E9ED` | primary text |
| `--card` / `--surface-1` | `228 8% 13%` | `#1F2024` | panels |
| `--popover` / `--surface-2` | `228 8% 16%` | `#26272C` | raised menus, insets, chips, inputs |
| `--surface-3` | `228 8% 20%` | `#2F3037` | raised inset |
| `--primary` | `227 88% 56%` | `#2B50F0` | **selection, key action, AI** |
| `--accent` | `227 100% 62%` | `#3A63FF` | **brighter AI blue — sparkle, glow CTA** |
| `--secondary` | `152 46% 45%` | `#3EA776` | ready / success |
| `--destructive` | `358 72% 58%` | `#E14954` | errors, delete |
| `--rating` | `38 85% 56%` | `#EFA83A` | amber — star, **non-blocking** warning |
| `--muted` | `228 7% 17%` | `#282A2F` | quiet fills |
| `--muted-foreground` | `228 6% 58%` | `#8A8C94` | secondary text, labels |
| `--border` | `228 7% 21%` | `#33343A` | hairlines |
| `--input` | `228 7% 18%` | `#2B2C31` | input borders |
| `--ring` | `227 88% 56%` | `#2B50F0` | focus ring |
| `*-foreground` (primary/accent/secondary/destructive) | `0 0% 100%` | `#FFFFFF` | text on those fills |

**Semantic colors are separate from the accent.** `secondary` = good,
`rating` = amber caution, `destructive` = critical. None of them ever substitute
for the blue accent, and the accent never substitutes for them.

### Light ("soft proofing")

Same token names, redefined: `--background 222 36% 97%` (#F5F7FC),
`--foreground 224 62% 14%` (navy #0E1A3A), `--card #FFFFFF`, `--surface-2
222 30% 96%`, `--primary 227 86% 52%`, `--accent 227 90% 56%`, `--border
222 24% 88%`, `--muted-foreground 224 14% 42%`, `--rating 38 82% 48%`. Because you
style through tokens, components adapt for free.

### Gradients, glows, elevation (AI signature — sparing)

- `--gradient-primary`: `linear-gradient(115deg, #2B50F0 0%, #3A63FF 60%, #4A66FA 100%)` — the `gradient` button, royal-blue gradient text.
- `.lr-glow-primary`: `0 0 0 1px hsl(var(--primary)/.5), 0 0 24px -6px hsl(var(--primary)/.5)`.
- Elevation (prefer over ad-hoc shadows): `--elevation-1` panels · `--elevation-2` raised/hover · `--elevation-3` modals.

---

## 3. Radius scale

`--radius: 0.375rem` = **6px**.

| Step | Value | Use |
|---|---|---|
| lg | **6px** (`--radius`) | cards, panels, dropzones, **buttons** wrapper radius* |
| md | **4px** (`--radius` − 2px) | inputs, chips, small controls, thumbnails, buttons |
| sm | **2px** (`--radius` − 4px) | tiny tags, image cells |
| full | 999px | pills, toggles, LEDs, avatars, orbs |

\* Buttons in the product use the **4px (md)** radius. Never `12px`+ on chrome.

---

## 4. Typography

Two families:

- **Inter** — all prose, headings, buttons, inputs. Weights 400/500/600/700/800.
- **Roboto Mono** — all labels, readouts, counts, timestamps, status. Weights 400/500/600.

### Named helpers (see `theme.css`)

| Class | Spec | Use |
|---|---|---|
| `.lr-caption` | Mono · 11px · 500 · `+0.12em` · UPPERCASE · muted | section labels, inline readouts |
| `.lr-microlabel` | Mono · 10px · 500 · `+0.18em` · UPPERCASE · muted | eyebrow above a title, group headers |
| `.lr-chip` | Mono · 10px readout chip, `surface-2` fill, 4px radius | telemetry ("Training · 62%") |
| `.lr-folio` | tabular lining nums · 700 · `−0.02em` | big numbers/counts that must align |

Tint an eyebrow "AI-blue" by adding `color: hsl(var(--accent))`.

### Heading scale (Inter, `letter-spacing: -0.02em`)

| Role | Size / weight |
|---|---|
| Page H1 (workspace) | 24px / 800 (up to 40–46px / 800 on hero pages) |
| Section H2 | 20px / 600 |
| Card title | 14px / 600 (dense) · 17–18px / 600 (roomy) |
| Body | 14–15px / 400, muted variant `--muted-foreground` |
| Micro / help | 11–13px `--muted-foreground` (or `.lr-caption`) |

---

## 5. Layout & spacing

- **Page shell:** full-bleed background wrapper with padding, then a centered
  max-width container. `padding: 24px 16px` on mobile → `32px` desktop.
- **Container widths** (fixed by page type): create/workspace **1152px**;
  list/detail/admin **1320px**; media grids **1600px**; settings **1100px**;
  standard modal **~512px**. *Sibling screens share a width* — don't shrink one
  because it "feels smaller."
- **Spacing scale:** stack sections `16px` (dense) / `24px` (roomy) / `32px`
  (hero). Card padding `20px` (compact `12–16px`). Inline gaps `6px`
  (chips/icon+label), `8px` (button icon, chip rows), `12px` (form rows).
  Label → control `8px`.
- **Z-index:** only `10` (in-card overlays), `20` (labels over media), `50`
  (modals, fixed bars). Don't invent values between.
- **Numbers:** `font-variant-numeric: tabular-nums` wherever digits align.

---

## 6. Component specs

Every component below has a ready class in `theme.css` (prefixed `.lr-`) and is
rendered in `ui-kit.html`. Exact anatomy:

### Buttons — `.lr-btn` + variant + size
Base: 4px radius · `font-weight: 600` · 14px · `gap: 8px` · icon 16px ·
`active: scale(0.98)` · 200ms ease `cubic-bezier(.22,.61,.36,1)`.

| Variant | Look | Use |
|---|---|---|
| `--default` | `primary` fill, white | standard primary action |
| `--glow` | `accent` fill + blue glow shadow | **the AI / "create & start" CTA** (one per screen) |
| `--gradient` | royal-blue gradient + glow | premium AI action |
| `--secondary` | green fill | success action |
| `--outline` | `border` + `card` bg, hover lifts border | secondary |
| `--ghost` | transparent, hover `muted` | tertiary / icon buttons |
| `--destructive` | `destructive/40` border, `/10` bg, red text | delete |
| `--glass` | panel button | on busy backgrounds |
| `--link` | `accent` text, underline on hover | inline link |

Sizes: `sm` h36 · default h40 · `lg` h48 · `xl` h56 · `icon` 40×40. Workspace
CTA = `--glow --lg`. **Copy says what happens** ("Create & start training", not
"Submit").

### Badges & pills
- **`.lr-badge`** (status/tags): fully-round, 1px border, `12px` / 600. Variants
  `default` (blue tint), `secondary` (green), `destructive`, `outline`. Use for
  "Ready" / "Training" / "Failed" / "No model".
- **`.lr-pill`** (live-summary chips): fully-round, `12px` / 500. `--accent` for
  the headline metric (credits), `--danger` for an over-limit metric, neutral
  otherwise.
- **`.lr-chip`** (`.lr-led` inside): mono telemetry readout with a glowing status
  dot. Set the dot color via `--led` (e.g. `--led: var(--rating)`).

### Form controls
Prefer the crisp **`.lr-field`** (4px, `surface-2/40` fill, inset hairline,
blue focus ring). Error = red inset ring (`.lr-field--error`). Select adds a
chevron. Checkbox/radio: 18px, checked fills `primary`. **`.lr-switch`**: 44×24
track, 18px knob that slides; on = `primary`. Slider: `surface-3` track,
`primary` fill, white thumb ringed `primary`. Label = `.lr-label` (14px / 500).

### Tables — `.lr-table`
Mono uppercase headers on `surface-2`, hairline rows, hover `surface-2/40`,
right-aligned tabular numerics, ghost row actions. Wrap in a container with
`overflow-x: auto` so it scrolls instead of breaking the page on mobile.

### Feedback
`.lr-alert--error` (destructive) · `--warn` (amber `rating`, **non-blocking**) ·
`--ok` (green) · **`--tip`** (blue, lightbulb icon, "Tip:", encouraging — never
an alarm). Toasts (`.lr-toast`) are a panel with an icon and **past-tense** copy
("Training started"). Errors are specific, blameless, near the problem, with the
fix.

### Overlays
`.lr-dialog` on `--popover` with `elevation-3`; footer puts the dangerous action
on the right. `.lr-popover` menu, `.lr-tooltip` (inverted foreground/background).

### Navigation
`.lr-tabs` segmented control (active tab = `card` bg + shadow). Icon rail: 40px
targets, active = `primary` fill. Breadcrumb with chevrons. `.lr-pager` (active =
`primary`).

### Media (the photo is the hero)
Thumbnails get **`.lr-plate-keyline`** (inset 6% white keyline), never a heavy
border. Selectable "look" tile: aspect `4/3`, cover `object-cover`, **selected =
`primary` border + inset ring + `0 0 0 3px primary/10`**, name over a bottom
black gradient with a small sparkle, round check top-right, optional "Pick"
badge; a cover with no image gets a graphite tile + blue wash + centered
sparkle. **RAW/HEIC can't decode in-browser — render `.lr-raw-tile` (graphite +
mono "RAW"), never a broken `<img>`.** Dropzone `.lr-dropzone` (dashed, hover
blue). Loading tile = shimmer.

### AI kit (royal-blue, earned)
- **Sparkle** — the AI mark, 4-point star, tinted `currentColor` (usually
  accent). Inline SVG path in `theme.css`.
- **`.lr-ai-border`** — rotating royal keyline + bloom. Wrap the ONE primary AI
  panel per screen ("Choose your AI look").
- **`.lr-orb`** (halo/ring/core) — the luminous AI avatar.
- **`.lr-gauge`** (`--gauge: 0–100`) — conic ring gauge.
- **`.lr-progress`**, `.lr-led` (+ pulse), thinking dots.

---

## 7. Signature patterns (copy, don't re-derive)

- **Plan-first workspace header:** a mono eyebrow on its own line, then one row —
  back button · **inline-editable title** (large, `surface-2/40` field with a
  trailing pencil) · **live-summary pills** pushed right that recalculate as the
  user works.
- **Spanning footer:** a live cost/plan panel on the left (progress + caption)
  and the primary `--glow --lg` CTA on the right in a fixed ~320px column, with a
  tiny muted sub-line beneath it.
- **Empty state:** centered panel, a muted icon in a `muted` tile, a
  `17px / 600` line, a muted explainer, one action.

---

## 8. Motion & icons

- Micro-interactions **150–250ms**; ease `cubic-bezier(0.22, 1, 0.36, 1)`.
  Buttons `active: scale(0.98)`. Prefer transform/opacity. Always honor
  `prefers-reduced-motion`. No ambient loops on dense screens.
- Icons: **lucide** (or any clean 1.75px-stroke line set), sizes 12/14/16/20px.
  The AI mark is the custom **sparkle SVG**, not a line icon. No emoji as icons.

---

## 9. Do / Don't

| Do | Don't |
|---|---|
| Radius 6 / 4 / 2 / full | `12px`+ on chrome; random radii |
| Royal blue for AI + selection only | blue as decorative borders/text |
| Roboto Mono UPPERCASE for labels/counts | mono for body; sentence-case labels |
| Solid graphite panels + hairline dividers | translucent "glass", heavy borders |
| `--glow` button for the AI CTA | a hand-rolled blue button |
| Inset keyline on thumbnails; "RAW" tile for RAW | thick photo borders; broken `<img>` for RAW |
| Style through tokens (works light + dark) | hard-coded hex |
| Semantic colors distinct from the accent | amber/green standing in for blue |

---

## 10. Wiring it into another project

**Plain HTML/CSS:** `<link rel="stylesheet" href="theme.css">`, add class `lr` to
`<body>`, use the `.lr-*` classes. Toggle theme with
`document.documentElement.dataset.theme = 'light' | 'dark'` (omit to follow the OS).

**Tailwind:** map the tokens in `tailwind.config` so utilities resolve to them —
e.g. `colors.primary = 'hsl(var(--primary) / <alpha-value>)'`, and set
`borderRadius.DEFAULT = 'var(--radius)'`. Then paste the `:root` / light token
blocks from `theme.css` into your global stylesheet. This is exactly how the
product is wired.

**React / shadcn:** the token names already match shadcn's convention
(`--primary`, `--muted-foreground`, `--ring`, …), so shadcn components inherit
the language once the tokens are in place. Set the Button's base radius to
`rounded-md` and add the `glow` / `gradient` variants from §6.
