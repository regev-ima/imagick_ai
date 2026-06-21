// ════════════════════════════════════════════════════════════════════
// Best-effort static prerender of the public marketing routes.
//
// Runs in Node (no headless browser): builds an SSR bundle of the marketing
// pages, renders each route to HTML, and writes static files into dist/ so
// crawlers, social scrapers and LLM bots get full content + per-route meta
// without executing JS. The SPA still hydrates on top for real users.
//
// It is intentionally NON-FATAL: any failure logs a warning and exits 0 so a
// prerender hiccup can never break the production deploy (Vercel falls back to
// the normal client-rendered SPA).
// ════════════════════════════════════════════════════════════════════

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const DIST = resolve(ROOT, "dist");
const SSR_DIR = resolve(ROOT, "dist-ssr");
const BASE = "https://imagick.ai";

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const ld = (o) => JSON.stringify(o).replace(/</g, "\\u003c");

async function main() {
  // 1. Bundle the SSR entry.
  execSync("npx vite build --ssr src/entry-prerender.tsx --outDir dist-ssr --logLevel warn", {
    cwd: ROOT,
    stdio: "inherit",
  });

  // 2. Shim browser globals the module graph touches at import time
  //    (the supabase client references localStorage as a value).
  const memory = new Map();
  globalThis.localStorage = {
    getItem: (k) => (memory.has(k) ? memory.get(k) : null),
    setItem: (k, v) => memory.set(k, String(v)),
    removeItem: (k) => memory.delete(k),
    clear: () => memory.clear(),
    key: () => null,
    length: 0,
  };

  // 3. Load the bundle + template.
  const { render, ROUTES } = await import(pathToFileURL(resolve(SSR_DIR, "entry-prerender.js")).href);
  const template = readFileSync(resolve(DIST, "index.html"), "utf-8");

  let ok = 0;
  for (const route of ROUTES) {
    try {
      const appHtml = render(route.url);
      const canonical = `${BASE}${route.url === "/" ? "/" : route.url}`;

      const head =
        route.jsonLd
          .map((b) => `<script type="application/ld+json" data-prerender="true">${ld(b)}</script>`)
          .join("\n    ") + "\n  </head>";

      let html = template
        .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(route.title)}</title>`)
        .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${esc(route.description)}" />`)
        .replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${canonical}" />`)
        .replace(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${canonical}" />`)
        .replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${esc(route.title)}" />`)
        .replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${esc(route.description)}" />`)
        .replace(/<meta name="twitter:title"[^>]*>/, `<meta name="twitter:title" content="${esc(route.title)}" />`)
        .replace(/<meta name="twitter:description"[^>]*>/, `<meta name="twitter:description" content="${esc(route.description)}" />`)
        .replace("</head>", `  ${head}`)
        .replace('<div id="root"></div>', `<div id="root">${appHtml}</div>`);

      const outPath = resolve(DIST, route.out);
      mkdirSync(dirname(outPath), { recursive: true });
      writeFileSync(outPath, html, "utf-8");
      ok++;
    } catch (err) {
      console.warn(`[prerender] skipped ${route.url}:`, err?.message || err);
    }
  }

  // 4. Regenerate the sitemap from the rendered routes (+ static extras).
  try {
    const extra = [
      { url: "/auth", priority: "0.5", changefreq: "monthly" },
      { url: "/legal/privacy", priority: "0.3", changefreq: "yearly" },
      { url: "/legal/terms", priority: "0.3", changefreq: "yearly" },
    ];
    const priorityFor = (u) =>
      u === "/" ? "1.0" : u === "/pricing" ? "0.9" : u.startsWith("/for/") ? "0.8" : u === "/blog" ? "0.7" : "0.6";
    const entries = [
      ...ROUTES.map((r) => ({ url: r.url, priority: priorityFor(r.url), changefreq: r.url === "/" || r.url === "/blog" ? "weekly" : "monthly" })),
      ...extra,
    ];
    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      entries
        .map(
          (e) =>
            `  <url><loc>${BASE}${e.url === "/" ? "/" : e.url}</loc><changefreq>${e.changefreq}</changefreq><priority>${e.priority}</priority></url>`,
        )
        .join("\n") +
      `\n</urlset>\n`;
    writeFileSync(resolve(DIST, "sitemap.xml"), xml, "utf-8");
  } catch (err) {
    console.warn("[prerender] sitemap skipped:", err?.message || err);
  }

  // 5. Clean up the SSR bundle so it isn't served.
  try {
    rmSync(SSR_DIR, { recursive: true, force: true });
  } catch {
    /* noop */
  }

  console.log(`[prerender] wrote ${ok}/${ROUTES.length} static routes.`);
}

main().catch((err) => {
  // Never fail the build — fall back to the client-rendered SPA.
  console.warn("[prerender] disabled this build:", err?.message || err);
  process.exit(0);
});
