# Imagick.ai — Site Completion Plan (execution-ready)

> **How to use this document:** work top-to-bottom, one phase at a time. Every
> task lists its files, exact requirements, and its verification step. Before
> writing ANY UI, load the design skill: `.claude/skills/imagick-design/SKILL.md`
> → which points to `docs/design/DESIGN-SYSTEM.md`. **Copy the component
> recipes verbatim** — do not invent new visual language. All work happens on
> branch `claude/busy-heisenberg-qml7b3` (PR #100).

## Ground rules (apply to every task)

1. **Design system**: tokens only (`--primary`, `bg-card/60`, etc.). Radius
   ladder: buttons `rounded-md`, cards `rounded-xl`, pills `rounded-full`,
   big CTAs `rounded-2xl`. Mono voice via `.caption`/`.folio`.
2. **⚠️ Effects rule (this caused a production outage):** NEVER write
   `useEffect(() => someCall(), deps)` with an implicit return. Always use a
   block body: `useEffect(() => { someCall(); }, deps)`. Browser extensions
   can patch globals (e.g. `window.scrollTo`) to return values; React treats
   a returned value as a cleanup function and crashes with
   `TypeError: n is not a function` → blank page. See commit `58391ec`.
3. **SEO**: every page gets `<Seo>` (title ≤60ch, description ≤158ch, path,
   JSON-LD), a prerender entry in `src/entry-prerender.tsx` ROUTES, and a
   `<url>` in `public/sitemap.xml`.
4. **Every page must work on BOTH hosts** (combined preview + imagick.ai) —
   marketing pages belong in `isMarketingPath()` (`src/lib/domains.ts`).
5. **Verify after each phase** (see Phase V protocol at the bottom). Build
   must stay green; bundle-size gate `bun run size:check` must pass.

---

## Phase 0 — Confirm the navigation crash is dead (already fixed, verify only)

The fix shipped in `58391ec` (block-bodied scrollTo effects) after being
root-caused via sourcemaps (react-dom `commitHookEffectListUnmount` calling a
non-function cleanup). Verify on the **deployed preview** after it's Ready:
hard refresh → navigate home → pricing → blog → post → post. No blank, no
`n is not a function` in console.

**Hardening tasks (do these regardless):**

- [ ] **0.1 ESLint guard** so the pattern can never return. In
  `eslint.config.js` add for `**/*.{ts,tsx}`:
  ```js
  "no-restricted-syntax": [
    "error",
    {
      selector: "CallExpression[callee.name='useEffect'] > ArrowFunctionExpression[body.type!='BlockStatement']",
      message: "useEffect callback must have a block body — implicit returns become cleanup functions and crash if a browser extension patches the called API (see docs/SITE-COMPLETION-PLAN.md ground rule 2).",
    },
  ],
  ```
  Run `bun run lint`; fix any other instance it finds anywhere in src/.
- [ ] **0.2 Route-change error recovery** — the app must never stay blank even
  if a future bug throws. Inside `<BrowserRouter>` in `src/App.tsx`, add a
  small `<RouteErrorReset>` component: an error boundary (class component or
  Sentry.ErrorBoundary) whose `resetError`/state clears whenever
  `useLocation().pathname` changes, wrapping `<Routes>`. Fallback UI = the
  existing "Something went wrong / Try again" card, styled per design system.
  Test: throw deliberately in a page render (temporarily), navigate away →
  app recovers without reload.
- [ ] **0.3 Apply the tracking-tags migration in production Supabase.** Every
  page load logs `GET /rest/v1/public_site_settings?...marketing_tags 404`.
  The migration exists in `supabase/migrations/` (public_site_settings +
  RLS). Apply it to the production project (`supabase db push` or run the SQL
  in the dashboard). Until applied, tracking tags configured in the admin do
  nothing on the live site.

---

## Phase 1 — Missing pages (published site → new site, URLs preserved)

The published imagick.ai has these pages that the new site lacks. Each gets a
real page (not a stub): hero (Kicker + H1 + lede), content sections using the
card/section recipes, one conversion CTA block, `<Seo>` + JSON-LD, prerender
entry, sitemap entry, and a link in `MarketingNav`/`MarketingFooter` where
noted. Copy tone: confident, photographer-first, no hype; mirror the copy
style of `src/pages/LandingPage.tsx` / `src/components/marketing/content.ts`.

- [ ] **1.1 `/about`** — story of Imagick (why it exists: photographers lose
  nights to editing), values, the "your style stays yours" privacy stance,
  team/contact block. JSON-LD: `AboutPage` + `Organization`. Footer link
  under a new "Company" column.
- [ ] **1.2 `/ai-styles`** — explains trainable AI styles: train on 50–100 of
  your edits, consistency across lighting, multiple styles per studio; FAQ
  section (reuse `Faq` component patterns) + `FAQPage` JSON-LD. Nav: under
  Features anchor is fine; footer link under "Product".
- [ ] **1.3 `/ai-workflow`** — the end-to-end workflow page: ingest → cull →
  edit-in-your-style → deliver. Reuse `HOW_IT_WORKS` data + `ProductMockups`
  components (EditorMockup/CullingMockup/ClientGalleryMockup). `HowTo`
  JSON-LD. Footer "Product".
- [ ] **1.4 `/case-studies`** — grid of 3–6 case studies built from the
  `Testimonials` data expanded with metrics (hours saved/week, delivery time
  before/after). Card recipe from design system. Each study: niche, problem,
  result numbers in `.folio`. JSON-LD: `ItemList`. Footer "Company".
- [ ] **1.5 `/compare`** — honest comparison: Imagick vs generic presets vs
  human editor vs DIY (rows: consistency in your style, cost/shoot,
  turnaround, culling, gallery delivery). Table must be wrapped in
  `overflow-x-auto` for mobile. JSON-LD: `WebPage`. Footer "Product".
- [ ] **1.6 `/contact`** — contact page: mailto CTA to `SITE.email`, expected
  response time, links to start free / pricing. `ContactPage` JSON-LD +
  `Organization` with `contactPoint`. Footer "Company".
- [ ] **1.7 `/enterprise`** — studios/high-volume: multi-seat, custom volume,
  SLA, dedicated onboarding; CTA = `mailto:` (same pattern as Studio plan
  CTA in `PricingTiers`). JSON-LD `WebPage`. Footer "Company"; also link from
  the Studio plan card ("For studios →").
- [ ] **1.8 `/try-demo`** — interactive taste of the product without signup:
  reuse `BeforeAfter` slider with 2–3 sample pairs (assets exist in
  `src/assets/`), then a strong signup CTA (`variant="glow"`, AppCta to
  `/auth?mode=signup`). This page is a prime ad landing page — keep it fast
  (no heavy imports beyond BeforeAfter). Nav: add "Demo" button next to
  "Start free" on desktop. JSON-LD `WebPage`.
- [ ] **1.9 `/style-guide`** — the published site had it; keep the URL alive
  to preserve any links: implement as a lightweight brand page (logo usage,
  colors, the sparkle) OR 301 it to `/about` via `vercel.json` redirects.
  Decide by effort; a redirect is acceptable.
- [ ] **1.10 URL preservation for legal pages.** Published URLs are
  `/privacy-policy` and `/terms-of-service`; the new site uses
  `/legal/privacy` and `/legal/terms`. Add **301 redirects** in
  `vercel.json` (`/privacy-policy` → `/legal/privacy`, `/terms-of-service` →
  `/legal/terms`) so old backlinks and indexed URLs keep working.
- [ ] **1.11 Wire-up**: add all new routes to `src/App.tsx` (lazy),
  `isMarketingPath()` in `src/lib/domains.ts`, prerender ROUTES in
  `src/entry-prerender.tsx` (with per-page JSON-LD), `public/sitemap.xml`,
  and the app→marketing host redirects in `vercel.json` (one line per new
  path, mirroring `/blog`'s entry).

---

## Phase 2 — Flawless, futuristic mobile experience

Audit every marketing page at 390×844 (iPhone) and 360×800 (Android). The
bar: nothing overflows, everything is reachable with a thumb, motion is
smooth, and it feels like a product from the future — precise, luminous,
zero jank.

- [ ] **2.1 Nav (mobile)**: keep the glass bar; ensure the sheet opens ≤200ms,
  body scroll locks (already does), links are ≥44px tall, and add
  `pb-[env(safe-area-inset-bottom)]` where fixed bottom elements exist.
- [ ] **2.2 Sticky mobile CTA** (already on blog posts): extend the same
  pattern to `/pricing` (sticky "Start free" after scrolling past the
  tiers) and `/try-demo`. Respect safe-area insets; never overlap the footer
  (hide when footer is in view via IntersectionObserver — block-bodied
  effects!).
- [ ] **2.3 Typography scale**: hero H1 must not exceed 2 lines on 390px
  (`text-4xl` base is right; verify longest headlines). Body ≥16px
  (`text-base`) for readability; `.caption` stays 11px only for labels.
- [ ] **2.4 Touch targets**: all tappable elements ≥44×44 (checked: theme
  toggle 36px → bump to `h-10 w-10` on mobile, category chips `py-1.5` ok,
  verify tag chips and footer links spacing).
- [ ] **2.5 Performance / CWV on mobile**: hero images `fetchpriority` only on
  the LCP element; everything below the fold lazy; `content-visibility:auto`
  on long sections (blog article body wrapper) to speed first paint; verify
  no layout shift (all imgs have width/height or aspect classes).
- [ ] **2.6 Motion**: honor `prefers-reduced-motion` (Reveal must render
  content statically when set — verify framer `useReducedMotion` or a media
  check); scroll-linked effects (reading progress) passive listeners only.
- [ ] **2.7 Blog article on mobile**: `prose` line length comfortable
  (`prose-lg` may be too wide/large — verify), images rounded-lg and
  full-bleed within padding, inline CTA stacks vertically (it does — verify
  the button goes full-width), sticky bottom CTA doesn't cover the closing
  CTA (add bottom padding equal to bar height — exists via `pb-24`, verify).
- [ ] **2.8 Forms/search**: blog search input uses 16px font on mobile
  (prevents iOS zoom-on-focus) — set `text-base sm:text-sm`.
- [ ] **2.9 The futuristic touch** (tasteful, within tokens): subtle aura
  glow behind the mobile hero (existing radial pattern), pressed-state
  `active:scale-[0.98]` everywhere tappable (comes from Button), and the
  Sparkle marking AI moments. Nothing new outside the design system.

---

## Phase 3 — Performance & structure (carry-over items)

- [ ] **3.1 Split blog content per-post.** `BlogPostPage` currently imports
  the whole `blog-content.json` (~544KB source → one 557KB chunk). Change
  `scripts/import-blog-json.mjs` to ALSO emit
  `src/components/marketing/blog-content/<slug>.json` (one file per post),
  and in `BlogPostPage` load via
  `import(`./blog-content/${slug}.json`)` (Vite glob import
  `import.meta.glob("@/components/marketing/blog-content/*.json")`) inside
  `useEffect`/loader with a small skeleton while loading. Prerender
  (`entry-prerender.tsx`) must keep rendering full content — import the map
  eagerly there (SSR bundle size is irrelevant). Re-run the import script;
  verify `dist/assets/BlogPostPage-*.js` drops from ~557KB to <20KB and every
  prerendered post still contains its article text.
- [ ] **3.2 Preload the LCP cover** on blog posts: in prerender, inject
  `<link rel="preload" as="image" href="<cover-thumb-800>">` per post page.
- [ ] **3.3 Fonts**: self-host Inter + Roboto Mono (woff2 in `public/fonts/`,
  `@font-face` with `font-display: swap`) replacing the Google Fonts
  `@import` — removes a render-blocking cross-origin request.

---

## Phase 4 — SEO wrap-up

- [ ] **4.1 sitemap.xml**: regenerate to include the 9 new pages + verify all
  158 post URLs present (`scripts/` has the generator or extend prerender to
  emit it).
- [ ] **4.2 robots.txt**: unchanged, verify it references the sitemap.
- [ ] **4.3 Internal linking**: footer gains "Company" (About, Case studies,
  Contact, Enterprise) and "Product" (AI styles, AI workflow, Compare, Demo)
  columns; LandingPage gets one contextual link to /ai-workflow and
  /try-demo in existing sections (no new sections needed).
- [ ] **4.4 Per-page OG images** stay `/og-image.jpg` default; posts already
  use covers.

---

## Phase V — Verification protocol (run after EVERY phase)

```bash
bunx tsc -p tsconfig.app.json --noEmit     # type-clean (pre-existing Uppy errors in app code are known/allowed)
bun run lint                                # incl. the new useEffect rule
bun run build && node scripts/prerender.mjs # green build + 165+N routes written
bun run size:check                          # bundle gate
```

Then a Playwright smoke (headless chromium at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`,
`vite preview --host 127.0.0.1 --outDir dist`): visit every marketing route at
1280×800 AND 390×844, assert `#root` has children, `document.body.innerText.length > 100`,
zero `pageerror` events, then client-navigate between 5 pages. Abort image/font
requests to blocked hosts. (Reference script shape: see session history / the
repro scripts in scratchpad.)

Finally: commit per phase with a descriptive message, push
`claude/busy-heisenberg-qml7b3`, and confirm the Vercel preview deploy is
Ready before the next phase.
