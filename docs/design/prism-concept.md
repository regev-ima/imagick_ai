# PRISM — Imagick.ai design system

> A complete redesign. **Not** an evolution of AURA — a new visual language.
> Direction chosen with the founder: **Google / Gemini** — clean, futuristic,
> friendly, **dark-first**, with **dynamic color** and a **Gemini spectral**
> signature reserved for AI. Audience: photographers + their clients ("media
> consumers"). The photo is the product; the UI gets out of its way.

## Principles

1. **The photo is the hero.** Neutral graphite surfaces, generous space, the
   imagery supplies the color. Chrome recedes.
2. **AI is light — and it's special.** The Gemini spectral gradient
   (blue → purple → pink, `#4285F4 → #9B72CB → #D96570`) appears **only** on
   AI moments: the Aura assistant, processing, suggestions, "generate". Manual
   controls stay calm and neutral, so intelligence always reads as distinct.
3. **Dynamic color (Material You).** A gallery/photo's dominant hue tints its
   own surfaces via `--dynamic-primary`. The product feels alive to *your*
   photos, not to a fixed brand color.
4. **Material 3 shape & elevation.** Rounded, friendly geometry; tonal surface
   elevation + soft shadows instead of heavy neon glass.
5. **Motion = meaning.** Emphasized easing (`cubic-bezier(0.2,0,0,1)`). Animate
   only to communicate state (processing, AI thinking, container transforms).

## Tokens (the contract — see `src/index.css`)

Token **names are unchanged from AURA** so every existing screen inherits the
new language for free; only values + shared utilities changed.

| Token | Dark | Role |
|---|---|---|
| `--background` | `225 7% 9%` | Neutral graphite app bg |
| `--card` / `--surface-1..3` | `222 8% 13/16/19%` | Material tonal elevation |
| `--primary` | `217 89% 61%` (#4285F4) | Google blue — primary action |
| `--secondary` | `137 53% 45%` | Google green — also "ready/success" |
| `--accent` | `280 44% 62%` (#9B72CB) | Gemini purple — spectral mid |
| `--destructive` | `4 80% 58%` (#EA4335) | Google red |
| `--rating` | `42 96% 60%` | Amber stars (theme-invariant) |
| `--dynamic-primary` | `var → primary` | Material You per-context tint |
| `--neon-blue/purple/pink` | spectral poles | Legacy names → Gemini hues |
| `--gradient-primary` | blue→purple→pink | **The AI signature** |

Light mode is the Google "daylight" counterpart (porcelain + `#1a73e8`).

## Type

- **Inter** — UI / body (`font-sans`)
- **Figtree** — display / headings (`font-display`), Google-Sans-like warmth
- **Roboto Mono** — telemetry / counts / labels (`font-mono`)

## Shared utilities (restyled, same names)

- `.glass-card` → Material tonal surface (faint blur + `--elevation-1`)
- `.surface-1/2/3` → solid elevation surfaces
- `.text-gradient*` → spectral text
- `.gradient-border` / `.aura-ai-border` → spectral border + bloom (AI only)
- `.aura-orb*` → spectral "gem" (the Aura assistant mark)
- `.aura-chip / .aura-led / .aura-gauge / .aura-microlabel / .aura-hairline`
  → telemetry kit in spectral hues + Roboto Mono
- `.dynamic-tint` → soft Material You wash from `--dynamic-primary`

## Rollout (vertical slice → full system)

Approved plan: ship the language foundation (this), then rebuild the flagship
layouts — **Dashboard, Collections, Client Gallery** — for approval, then roll
the language across all ~40 screens (auth, gallery editor, styles, billing,
settings, the 21 admin pages). **No function is dropped**; functions may move
between areas where it improves the flow. The full functional inventory that
guides the rollout lives in the redesign working notes.
