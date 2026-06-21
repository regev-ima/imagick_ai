# Launching the Imagick.ai marketing site

This repo now ships a full public sales site (landing, pricing, niche pages,
blog) plus an admin-managed tracking system, built in the LIGHTROOM design.
This is the checklist to take it live on **imagick.ai**.

## 1. Point the domain (Vercel)

The Vercel project (`imagick-ai`) already builds this repo. To serve it on the
apex domain:

1. Vercel → Project → **Settings → Domains** → add `imagick.ai` (and
   `www.imagick.ai`, redirecting to the apex).
2. At your DNS provider, add the records Vercel shows (an `A`/`ALIAS` for the
   apex, a `CNAME` for `www`).
3. Production deploys come from the `main` branch — merge this PR to publish.

The build command is set in `vercel.json`:
`vite build && node scripts/prerender.mjs` (prerender is best-effort and never
fails the deploy). Canonical URLs, `robots.txt` and `sitemap.xml` already point
at `https://imagick.ai`.

## 2. Environment variables

The site needs the same public Supabase vars the app uses (already in `.env`):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Make sure both are set in **Vercel → Settings → Environment Variables** for
Production.

## 3. Database migration (tracking settings)

The Tracking & Tags feature adds `public.public_site_settings`
(`supabase/migrations/20260621120000_public_site_settings.sql`). It deploys
automatically via the **Supabase Deploy** GitHub Action when this merges to
`main` (the workflow triggers on `supabase/**`). If you deploy migrations
manually, run that file in the Supabase SQL editor.

Until it's applied, the tracking injector simply stays disabled (it fails
safe), so nothing breaks before the migration lands.

## 4. Configure analytics & pixels (no code)

Sign in as an **admin** and go to **Dashboard → Admin → Tracking & Tags**
(`/dashboard/admin/marketing`). Paste any of:

- Google Tag Manager (`GTM-…`), Google Analytics 4 (`G-…`), Microsoft Clarity
- Meta Pixel, Google Ads (`AW-…`), TikTok, LinkedIn, Pinterest — ready for paid
  campaigns
- Google Search Console / Bing verification tokens (applied even when the master
  switch is off)
- A custom `<head>` / `<body>` escape hatch for anything else

Flip the master switch on and **Save** — tags go live for every visitor on the
next page load. IDs are public by design (they ship in page source); the values
live in a public-read, admin-write table.

## 5. Search Console & sitemap

1. Add `https://imagick.ai` as a property in **Google Search Console** (verify
   via the token field in Tracking & Tags, or DNS).
2. Submit the sitemap: `https://imagick.ai/sitemap.xml`.
3. Repeat in **Bing Webmaster Tools** if desired.

## 6. Before-launch polish (optional)

- **Testimonials** in `src/components/marketing/data.ts` are illustrative
  placeholders — swap for real, attributed quotes.
- **OG image**: `public/og-image.jpg` is a representative photo; a branded
  1200×630 design is provided at `public/og-image.svg` — rasterize it to PNG/JPG
  and replace `og-image.jpg` for a fully branded social card.
- Add more **blog posts** / **niche pages** by extending
  `src/components/marketing/content.ts` — they're picked up by routing, the
  footer, the sitemap and the prerender automatically.

## How SEO is handled

- Per-page `<Seo>` sets title/description/canonical/OG/Twitter + JSON-LD client
  side; `index.html` carries static defaults + a `<noscript>` fallback.
- **Prerendering** (`scripts/prerender.mjs`) writes static HTML for every
  marketing route at build time, so non-JS crawlers and social/LLM bots get full
  content and correct per-route metadata.
- Structured data: Organization, WebSite, SoftwareApplication (with offers),
  Product, FAQPage, BlogPosting and BreadcrumbList.
