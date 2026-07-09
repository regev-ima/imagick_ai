// Import the exported imagick.ai blog (158 posts) into the new site's blog
// system. Reads the uploaded blog-export.json, sanitizes each article's HTML,
// applies systematic SEO hardening, preserves every URL, and writes
// src/components/marketing/blog-data.json.
//
//   node scripts/import-blog-json.mjs <path-to-blog-export.json>

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const SRC = process.argv[2] || process.env.BLOG_EXPORT;
if (!SRC) {
  console.error("Usage: node scripts/import-blog-json.mjs <blog-export.json>");
  process.exit(1);
}
const DIR = resolve(process.cwd(), "src/components/marketing");
const OUT_INDEX = resolve(DIR, "blog-index.json"); // metadata only (small)
const OUT_CONTENT = resolve(DIR, "blog-content.json"); // { slug: contentHtml }
const BRAND = "Imagick.ai";

/* ── helpers ─────────────────────────────────────────────────────── */

const decode = (s = "") =>
  s
    .replace(/&#8217;|&#039;|&#39;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/&#8211;|&#8212;/g, "–")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

const stripTags = (html = "") => decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

// Build-time sanitize: remove script/style/iframe, event handlers and js: URLs,
// and a duplicate leading <h1> (the page renders the title as the H1).
function sanitize(html = "") {
  let h = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/(href|src)\s*=\s*"javascript:[^"]*"/gi, '$1="#"')
    .replace(/^\s*<h1[^>]*>[\s\S]*?<\/h1>/i, "");
  return h.trim();
}

function truncate(s, n) {
  if (!s) return "";
  s = s.trim();
  if (s.length <= n) return s;
  const cut = s.slice(0, n);
  const at = cut.lastIndexOf(" ");
  return (at > n * 0.6 ? cut.slice(0, at) : cut).replace(/[\s,.;:–-]+$/, "") + "…";
}

const isoDate = (d) => (d ? String(d).slice(0, 10) : "");

function readingMins(html, given) {
  if (given && Number(given) > 0) return Number(given);
  const words = stripTags(html).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/* ── run ─────────────────────────────────────────────────────────── */

const raw = JSON.parse(readFileSync(SRC, "utf8"));
const posts = raw.posts || [];

const out = posts.map((p) => {
  const contentHtml = sanitize(p.contentHtml || "");
  const text = stripTags(p.contentHtml || "");
  const title = decode(p.title || "").trim();

  // SEO title: keep theirs; add brand suffix when it fits and isn't present.
  let metaTitle = (p.metaTitle || title).trim();
  if (!/imagick/i.test(metaTitle) && metaTitle.length <= 47) metaTitle = `${metaTitle} | ${BRAND}`;

  // SEO description: theirs, else first ~155 chars of the article.
  let metaDescription = (p.metaDescription || "").trim();
  if (metaDescription.length < 50) metaDescription = truncate(text, 155);
  else metaDescription = truncate(metaDescription, 158);

  const tags = Array.isArray(p.tags) ? p.tags.filter(Boolean) : [];
  const categories = Array.isArray(p.categories) ? p.categories.filter(Boolean) : [];

  return {
    slug: p.slug,
    url: p.url, // preserved verbatim
    title,
    metaTitle,
    metaDescription,
    description: metaDescription,
    date: isoDate(p.date),
    modified: isoDate(p.modified) || isoDate(p.date),
    author: (p.author || BRAND).trim(),
    category: categories[0] || "Article",
    categories,
    tags,
    keywords: tags.length ? tags : categories,
    cover: p.coverImage || null,
    coverAlt: (p.coverAlt || title).trim(),
    readMins: readingMins(p.contentHtml, p.readingMinutes),
    contentHtml,
  };
});

// Newest first.
out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

// Split: lightweight metadata index (bundled everywhere the blog list shows)
// and a slug→HTML content map (loaded only on a post page).
const content = {};
const index = out.map(({ contentHtml, ...meta }) => {
  content[meta.slug] = contentHtml;
  return meta;
});

writeFileSync(OUT_INDEX, JSON.stringify(index), "utf8");
writeFileSync(OUT_CONTENT, JSON.stringify(content), "utf8");

const withCover = index.filter((p) => p.cover).length;
console.log(`[import] ${index.length} posts`);
console.log(`[import] ${withCover}/${index.length} have a cover image`);
console.log(`[import] index  → ${OUT_INDEX} (${(Buffer.byteLength(JSON.stringify(index)) / 1024).toFixed(0)} KB)`);
console.log(`[import] content→ ${OUT_CONTENT} (${(Buffer.byteLength(JSON.stringify(content)) / 1024).toFixed(0)} KB)`);
console.log(`[import] sample: ${index[0].url}`);
