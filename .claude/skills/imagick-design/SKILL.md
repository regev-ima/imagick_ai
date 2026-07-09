---
name: imagick-design
description: "Imagick.ai's own LIGHTROOM design system — the exact, ship-accurate visual language of imagick.ai (marketing site + app). Load this whenever building, restyling, reviewing or extending ANY imagick.ai UI: landing page, pricing, blog, marketing pages, admin, app screens, components, cards, buttons, nav, badges, CTAs. Covers the precise colour tokens (royal-blue #2B50F0 on graphite, dark-first + light), the radius ladder (buttons rounded-md, cards rounded-xl, pills rounded-full, big CTAs rounded-2xl), Inter + Roboto Mono type ramp, the .caption/.folio mono voice, the Sparkle AI mark + Aura kit, elevation, gradients, motion easing cubic-bezier(0.22,0.61,0.36,1), and copy-verbatim component recipes. Use it so every new pixel is indistinguishable from what already ships and brand re-skins stay a token swap."
---

# Imagick.ai — LIGHTROOM Design System skill

**Purpose:** keep every design decision on imagick.ai precise and consistent
with what already ships. Do not invent values — reuse the tokens and component
recipes below.

## How to use this skill

1. **Read the full reference first:** [`docs/design/DESIGN-SYSTEM.md`](../../../docs/design/DESIGN-SYSTEM.md).
   It is the single source of truth and mirrors the live code
   (`src/index.css`, `tailwind.config.ts`, `src/components/marketing/*`,
   `src/pages/*`). Every token, radius, type ramp, motion curve and component
   recipe there is copied from what ships.
2. **Match the recipes verbatim.** When you build a card, button, badge, nav,
   CTA, section or blog surface, copy the exact class recipe from §5 of the
   reference rather than approximating it.
3. **Keep the token discipline** (§0): never hardcode a brand colour in a
   component — reference `--primary`/`--accent`/etc. This is what makes a brand
   re‑skin a ~15‑line token edit instead of a component rewrite.
4. **Verify in both themes** (dark default + light) and honour
   `prefers-reduced-motion`.

## The essentials (full detail in the reference)

- **Brand:** royal blue `--primary: 227 88% 56%` (`#2B50F0`), AI accent
  `--accent: 227 100% 62%`. Graphite neutrals. Dark‑first; light fully supported.
- **Radius ladder:** buttons `rounded-md` (6px) · cards/panels/nav `rounded-xl`
  (12px) · pills/badges/kickers/tags `rounded-full` · large CTA/hero panels
  `rounded-2xl` (16px). Nothing rounder than `2xl`.
- **Type:** Inter for everything (`font-sans`, bold headings, tracking
  `-0.02em`/`-0.03em`), Roboto Mono for the instrument voice via `.caption`
  (uppercase eyebrows/labels) and `.folio` (big tabular numbers).
- **Card:** `rounded-xl border border-border bg-card/60 p-6 transition-colors
  duration-200 hover:border-primary/40`.
- **Primary CTA:** `<Button variant="glow">` (accent fill + blue glow).
- **AI mark:** the 4‑point `Sparkle` (`text-primary`); Aura kit for AI surfaces.
- **Motion:** easing `cubic-bezier(0.22,0.61,0.36,1)`; scroll reveals
  `opacity:0,y:22 → 1,0` over `0.6s`; UI feedback `duration-200`,
  `active:scale-[0.98]`.
- **Elevation:** only `--elevation-1/2/3`. **Tints:** `bg-primary/12`, ring
  `ring-primary/20`, hover border `/40`.

## Re‑skinning the brand hue

To change the brand colour, edit only the hue tokens listed in §0 of the
reference (`--primary`, `--accent`, `--ring`, `--gradient-*`, `--glow-*`,
`--sidebar-primary/ring`, `--dynamic-*`, legacy `--neon-*`) across `:root`,
`.dark` and `.light`. Every component — landing, pricing, blog, admin, app —
inherits it automatically. Leave neutrals, the radius scale, the type ramp and
component recipes untouched.
