import { useEffect } from "react";
import { SITE } from "./data";

type SeoProps = {
  title: string;
  description: string;
  /** Path only, e.g. "/pricing". Combined with the canonical site URL. */
  path?: string;
  /** Absolute or root-relative image URL for social cards. */
  image?: string;
  /** JSON-LD structured data (object or array). Injected into <head>. */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
};

const SEO_ATTR = "data-imagick-seo";

function upsertMeta(selector: string, attrs: Record<string, string>) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(SEO_ATTR, "true");
    document.head.appendChild(el);
  }
  Object.entries(attrs).forEach(([k, v]) => el!.setAttribute(k, v));
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    el.setAttribute(SEO_ATTR, "true");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

/**
 * Lightweight, dependency-free <head> manager for the marketing routes.
 * Sets the title, description, canonical, Open Graph / Twitter cards and
 * JSON-LD so each page is independently shareable and indexable.
 */
export function Seo({ title, description, path = "/", image, jsonLd }: SeoProps) {
  useEffect(() => {
    const url = `${SITE.url}${path === "/" ? "" : path}`;
    const img = image
      ? image.startsWith("http")
        ? image
        : `${SITE.url}${image}`
      : `${SITE.url}/og-image.jpg`;

    document.title = title;

    upsertMeta('meta[name="description"]', { name: "description", content: description });
    upsertLink("canonical", url);

    // Open Graph
    upsertMeta('meta[property="og:title"]', { property: "og:title", content: title });
    upsertMeta('meta[property="og:description"]', { property: "og:description", content: description });
    upsertMeta('meta[property="og:url"]', { property: "og:url", content: url });
    upsertMeta('meta[property="og:type"]', { property: "og:type", content: "website" });
    upsertMeta('meta[property="og:image"]', { property: "og:image", content: img });
    upsertMeta('meta[property="og:site_name"]', { property: "og:site_name", content: SITE.name });

    // Twitter
    upsertMeta('meta[name="twitter:card"]', { name: "twitter:card", content: "summary_large_image" });
    upsertMeta('meta[name="twitter:title"]', { name: "twitter:title", content: title });
    upsertMeta('meta[name="twitter:description"]', { name: "twitter:description", content: description });
    upsertMeta('meta[name="twitter:image"]', { name: "twitter:image", content: img });
    upsertMeta('meta[name="twitter:site"]', { name: "twitter:site", content: SITE.twitter });

    // JSON-LD — managed under a dedicated marker so we can clean it up.
    const existing = document.head.querySelectorAll('script[data-imagick-jsonld="true"]');
    existing.forEach((n) => n.remove());
    if (jsonLd) {
      const blocks = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
      blocks.forEach((block) => {
        const script = document.createElement("script");
        script.type = "application/ld+json";
        script.setAttribute("data-imagick-jsonld", "true");
        script.text = JSON.stringify(block);
        document.head.appendChild(script);
      });
    }
  }, [title, description, path, image, jsonLd]);

  return null;
}
