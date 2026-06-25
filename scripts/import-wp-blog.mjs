// ════════════════════════════════════════════════════════════════════
// Import the existing imagick.ai blog (WordPress) into the new marketing
// blog system — posts, content, dates, categories, featured images and
// Yoast SEO fields — then it's SEO-reviewed per article in code.
//
// PREREQUISITE: this environment's network policy must allow `imagick.ai`
// (otherwise every request is blocked with `x-deny-reason: host_not_allowed`).
// Once allowed, run:  node scripts/import-wp-blog.mjs
//
// Output:
//   public/blog/<slug>.<ext>                 — downloaded featured images
//   src/components/marketing/imported-posts.json — structured posts for the app
// ════════════════════════════════════════════════════════════════════

import { writeFileSync, mkdirSync, createWriteStream } from "node:fs";
import { resolve } from "node:path";
import { Readable } from "node:stream";

const BASE = process.env.WP_BASE || "https://imagick.ai";
const ROOT = process.cwd();
const IMG_DIR = resolve(ROOT, "public/blog");
const OUT = resolve(ROOT, "src/components/marketing/imported-posts.json");

const stripHtml = (html = "") =>
  html.replace(/<[^>]+>/g, "").replace(/&#8217;/g, "'").replace(/&#8211;/g, "–").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

const extOf = (url) => {
  const m = /\.(jpe?g|png|webp|avif|gif)(?:\?|$)/i.exec(url);
  return m ? m[1].toLowerCase().replace("jpeg", "jpg") : "jpg";
};

async function fetchJson(url) {
  const res = await fetch(url, { headers: { "User-Agent": "imagick-blog-importer" } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

async function downloadImage(url, slug) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const file = `${slug}.${extOf(url)}`;
    await new Promise((ok, err) => {
      const ws = createWriteStream(resolve(IMG_DIR, file));
      Readable.fromWeb(res.body).pipe(ws).on("finish", ok).on("error", err);
    });
    return `/blog/${file}`;
  } catch {
    return null;
  }
}

async function fetchAll(type) {
  const out = [];
  for (let page = 1; page <= 20; page++) {
    let batch;
    try {
      batch = await fetchJson(`${BASE}/wp-json/wp/v2/${type}?per_page=100&page=${page}&_embed=1`);
    } catch (e) {
      if (page === 1) console.warn(`[import] ${type}: ${e.message}`);
      break;
    }
    if (!Array.isArray(batch) || batch.length === 0) break;
    out.push(...batch);
    if (batch.length < 100) break;
  }
  return out;
}

async function main() {
  mkdirSync(IMG_DIR, { recursive: true });

  const posts = await fetchAll("posts");
  if (posts.length === 0) {
    console.warn("[import] No posts returned. Is imagick.ai allowed by the network policy, and is the WP REST API enabled?");
    return;
  }
  console.log(`[import] Fetched ${posts.length} posts.`);

  const imported = [];
  for (const p of posts) {
    const slug = p.slug;
    const media = p._embedded?.["wp:featuredmedia"]?.[0];
    const featuredUrl = media?.source_url || null;
    const cover = featuredUrl ? await downloadImage(featuredUrl, slug) : null;

    const terms = (p._embedded?.["wp:term"] || []).flat();
    const categories = terms.filter((t) => t?.taxonomy === "category").map((t) => t.name);
    const tags = terms.filter((t) => t?.taxonomy === "post_tag").map((t) => t.name);

    const yoast = p.yoast_head_json || {};

    imported.push({
      slug,
      title: stripHtml(p.title?.rendered || ""),
      date: (p.date || "").slice(0, 10),
      modified: (p.modified || "").slice(0, 10),
      excerpt: stripHtml(p.excerpt?.rendered || "").slice(0, 200),
      contentHtml: p.content?.rendered || "",
      cover,
      coverAlt: media?.alt_text || stripHtml(p.title?.rendered || ""),
      categories,
      tags,
      // SEO fields (prefer Yoast, fall back to derived)
      seoTitle: yoast.title || stripHtml(p.title?.rendered || ""),
      seoDescription: yoast.og_description || yoast.description || stripHtml(p.excerpt?.rendered || "").slice(0, 155),
      ogImage: yoast.og_image?.[0]?.url || featuredUrl || null,
    });
  }

  imported.sort((a, b) => (a.date < b.date ? 1 : -1));
  writeFileSync(OUT, JSON.stringify(imported, null, 2), "utf-8");
  console.log(`[import] Wrote ${imported.length} posts → ${OUT}`);
  console.log(`[import] Images saved under public/blog/. Next: SEO review + wire rendering.`);
}

main().catch((e) => {
  console.error("[import] failed:", e.message);
  process.exit(1);
});
