# IMAGICK // AURA — futuristic redesign concept (v2)

**Status:** v3 — AURA is now applied to the ENTIRE app on this branch
(global tokens, shadcn primitives, dashboard shell), so the Vercel branch
preview is the full product in the new design. Sign in there to evaluate
it with real data. Production (`main`) remains untouched until this PR is
approved and merged.

**Live render:** run the app and open `/design-preview` (lazy route, mock
data only — no Supabase, no auth).

**Supersedes:** NEXUS (v1, in git history). Review feedback on v1: the
square HUD corner brackets clashed with the rounded cards, and the concept
needed more explicitly *AI-feeling* effects. v2 answers both.

---

## Intent

One soft, continuous geometry — and the intelligence expressed as **light**.
Instead of technical line-work (brackets, grids, scanline HUDs), the AI
presence is carried by living gradients: borders that slowly rotate through
the spectrum, a breathing core with orbiting particles, sparkles where the
engine touches photos, and a frame that glows at its edges while jobs run
(the Apple-Intelligence / Gemini visual language, tuned to the Imagick
brand).

## Pillars

1. **One geometry** — concentric radius scale (28 / 20 / 14 px), pill
   buttons/chips/inputs, zero square accents. Inner radii always derive
   from outer ones, so nesting looks engineered.
2. **The AI is light** — an animated tri-hue signature gradient
   (violet → fuchsia → champagne → aqua) is *reserved* for intelligence:
   the prompt bar, the engine card, Aura's suggestions, generate actions.
   Human/manual controls stay calm glass. The hierarchy is the meaning.
3. **Bioluminescent palette** — violet-black void (`258 30% 4%`), glass
   surfaces with 3% photographic grain, aura violet (`272 96% 66%`) as the
   primary hue, legacy brand magenta kept as the fuchsia pole, champagne
   gold for premium-tier accents.
4. **Conversation-first** — the dashboard is built around an Aura prompt
   bar ("cull the Cohen wedding, apply Film Noir 02, deliver the top 200")
   with suggestion chips; the engine talks back through inline suggestion
   cards with its orb avatar, not buried menus.
5. **Living feedback** — cursor-following glow on cards, scan beams and
   shimmer + sparkles on frames being enhanced, comet-head progress bars,
   edge-glow on the whole frame while the engine works.
6. **Type** — Sora (headings/body: geometric but warm), Unbounded
   (wordmark + hero moments only), JetBrains Mono (scores, counts,
   timestamps).

## AI-effect inventory (all CSS, reduced-motion safe)

| Effect | Where |
|---|---|
| Rotating conic border + bloom (`.au-ai-border`, `@property --au-angle`) | Prompt bar, engine tile, Aura suggestions, pick badges |
| Edge glow (`.au-edge-glow`) | Whole dashboard frame while jobs run |
| Breathing orb + orbiting particles (`.au-orb*`) | Engine avatar everywhere |
| Sparkles ✦ (`.au-spark`) | Anywhere the engine just acted |
| Cursor-following glow (`.au-mouse-glow`, JS sets `--mx/--my`) | Telemetry + collection cards |
| Scan beam (`.au-scan`) / iridescent shimmer (`.au-shimmer`) | Frames being scored / generated |
| Comet-head progress (`.au-progress`) | Uploads, jobs, style match |
| Animated holo text / gradient buttons | Wordmark, "Generate", Aura's name |

## What the preview shows

| Section | Contents |
|---|---|
| Hero | AURA wordmark, floating 3D photo deck around the orb |
| 01 Dashboard | Pill rail, Aura prompt bar + suggestion chips, telemetry pills, collections, engine queue |
| 02 Gallery | Living cull: score pills, iridescent pick rings, dissolving rejects, enhancing tiles, Aura suggestion bar, RAW vs. retouch with glowing handle |
| 03 Tokens | Signature gradient, palette, type, concentric-geometry demo |
| 04 Components | Buttons, status chips, inputs/switches, progress, Aura voice toasts, generative skeletons |

## v2.1 refinement (design-skills pass)

Two installed design skills were applied on top of v2:

- **emil-design-eng** (motion craft): UI feedback now uses strong custom
  easing (`cubic-bezier(0.23, 1, 0.32, 1)`) and stays under 250ms; buttons
  press to `scale(0.97)` in 140ms; hover effects are gated behind
  `(hover: hover) and (pointer: fine)`; one orchestrated page-load reveal
  (60ms cascade via `@starting-style`) instead of scattered entrances.
- **tasteskill** (anti-slop discipline): em/en-dashes removed from all
  visible copy; numbered section eyebrows dropped; hero stripped to one
  real status chip; the AI conic signature tightened to strictly three
  hues (champagne now appears only on premium-tier chips).
- **One demo photograph everywhere, deliberately:** photographers bring
  their own images, so the concept sells the platform chrome, not the
  photography. In the culling grid the repetition even reads true to
  life: a burst of near-identical frames being scored.

## Implementation notes

- Everything is scoped under `.aura` in `src/pages/design-preview.css`;
  the shadcn CSS variables are re-declared inside that scope, so Tailwind
  utilities render the new palette only inside the preview. Zero leakage.
- Route chunk (page + CSS + fonts) stays lazy — main bundle untouched.
- All animation behind `prefers-reduced-motion: no-preference`; the
  rotating border degrades to a static gradient where `@property` is
  unsupported.

## Implementation state (v3, this branch)

Done:
1. Global tokens in `index.css` (`:root`/`.dark` + "Daylight Aura"
   `.light`): violet primary, fuchsia accent, aqua secondary, violet-black
   surfaces, champagne rating, AURA gradients; legacy `--neon-*` names
   remapped so older code follows automatically.
2. Type stack: Sora (body/headings), Unbounded (display), JetBrains Mono
   (telemetry) wired through Tailwind `font-sans/display/mono`.
3. shadcn primitives restyled (button, card, input, badge, progress,
   switch, dialog, dropdown, popover, select, tabs, tooltip): pill
   buttons with 140ms press feedback, glass cards with specular edge,
   glow focus states. Every screen (incl. admin) inherits them.
4. Dashboard shell: glass sidebar with pill nav + glow active state,
   gradient credit bars, Aura command bar in the header (visual for now,
   engine wiring is a separate effort) and the living orb as the engine
   presence chip.
5. Uppy uploader, scrollbars, toasts and legacy glow/gradient utilities
   recolored via tokens.

## v4 — dashboard rebuilt from scratch (not a recolor)

Feedback on v3: recoloring the existing layout is not a redesign. The
dashboard home (`src/pages/dashboard/DashboardHome.tsx`) is now a
ground-up rebuild with a new composition, wired to the same real data:

- **Conversation-first:** an Aura command bar (rotating `aura-ai-border`
  + orb) is the centerpiece, with real action chips beneath it. The
  duplicate command bar was removed from the global header.
- **Bento telemetry** replaces the flat stat strip: a radial edits gauge,
  a storage bar, a tappable collections tile, and a live engine tile
  showing the real processing count via the orb.
- **"Aura is working on"** — a live queue built from galleries actually
  in `processing`/`uploading`, with real per-gallery progress.
- **Recent collections** restyled as editorial glass cards (status LED,
  live percent, hover lift).
- **Empty state** rebuilt as a command-deck welcome around the orb.
- Display type (Unbounded) on the greeting, JetBrains Mono on every
  number/label. All motion uses the strong ease-out curve.

## v5 — gallery creation flow rebuilt

Feedback: make the create-gallery flow clean, easy, and voiced as AI.
`CreateGalleryPage.tsx` rebuilt (all logic preserved verbatim — gallery
insert, Uppy upload + streamed processing, Drive transfer, edit-cost math):

- Stripped the visual noise: removed floating particles, drifting orbs,
  sparkle bursts and the heavy pulsing stepper.
- Calm segmented stepper (gradient fill + mono step numbers), centered
  single-column layout with real breathing room.
- Every step is now Aura talking, first person: "What are we working
  on?", "How should I edit them?", "Want me to cull first?", "Send me
  the photos." Buttons read "Hand it to Aura".
- AURA surfaces throughout: glass step card, pill tabs, rounded type
  tiles with press feedback, gradient progress, the orb as the culling
  and header avatar.

Next surfaces to rebuild the same way (pending direction approval):
collections index, gallery editor, billing, settings, then admin.
