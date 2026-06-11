# IMAGICK // NEXUS — futuristic redesign concept

**Status:** concept v0.1 — awaiting design review. Lives only on a feature
branch; nothing here is deployed or linked from the product UI.

**Live render:** run the app and open `/design-preview` (lazy route, mock
data only — no Supabase, no auth).

---

## Intent

Evolve the current "neon pink on near-black" language into a *holographic
command-deck* aesthetic: the studio dashboard should feel like mission
control for a photography business, and the AI engine should feel
physically present — a living core, not a spinner.

Brand continuity is deliberate: today's magenta survives as one pole of the
new spectrum, so existing logos and marketing assets stay coherent.

## Pillars

1. **Deep-space surfaces** — indigo-black void (`248 36% 4%`) with a faint
   starfield, slow aurora blobs and a dotted micro-grid on work areas.
2. **Quantum spectrum** — primary action color shifts from magenta to
   **quantum cyan** (`187 100% 55%`); **ultraviolet** (`268 100% 68%`)
   bridges to the legacy **magenta** (`326 100% 60%`). Plasma green / signal
   amber are reserved for status only.
3. **Holographic glass** — translucent panels (blur 22–28px, saturate 140%)
   with a 1px specular top edge and deep soft shadows; hover = 3px lift +
   cyan energy ring.
4. **HUD telemetry** — JetBrains Mono micro-labels (10px, 0.2em tracking),
   corner brackets on data tiles, LED status dots, scores and counts always
   in mono. Space Grotesk for display type; Inter stays for body.
5. **Living AI core** — a rotating conic-gradient orb represents the Neural
   Engine everywhere (rail, telemetry tile, suggestion toasts). Processing
   imagery gets a cyan scanning beam instead of a generic spinner.
6. **Command-first navigation** — the wide sidebar collapses into a 76px
   icon rail; global ⌘K command bar handles search, navigation and direct
   engine prompts.

## What the preview shows

| Section | Contents |
|---|---|
| 01 Dashboard | Icon rail + orb, ⌘K command bar, bento telemetry (edits gauge, storage, collections sparkline, engine queue), collection cards, processing queue |
| 02 Gallery | AI culling deck: per-frame score chips, FOCUS/EYES checks, pick/reject states, scanning tiles, RAW vs. retouch split, style-match panel |
| 03 Tokens | Full palette with HSL values, typography stack, surface/effect recipes |
| 04 Components | Buttons, chips, inputs, switches, progress, toasts/engine suggestions |

## Implementation notes

- Everything is scoped under the `.nexus` class in
  `src/pages/design-preview.css`; the shadcn CSS variables are re-declared
  inside that scope, so plain Tailwind utilities render the new palette
  *only inside the preview*. Zero leakage into the production theme.
- The route chunk (page + CSS + fonts) is lazy-loaded; the main bundle is
  untouched, keeping the size budget green.
- All animations sit behind `prefers-reduced-motion: no-preference`.

## Proposed rollout (after approval)

1. Promote the token set into `index.css` behind a `.theme-nexus` class and
   a feature flag (per-account opt-in, e.g. "Try the new look").
2. Re-skin shell first (DashboardLayout → rail + command bar), then
   dashboard tiles, then gallery/culling surfaces.
3. Light-mode variant ("daylight deck": porcelain surfaces, same cyan
   accents) before general availability.
4. Remove the legacy theme once adoption is healthy.
