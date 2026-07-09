// Blog data — imported from the existing imagick.ai blog (see
// scripts/import-blog-json.mjs). Metadata lives in blog-index.json (bundled
// wherever the post list renders); the article HTML lives in blog-content.json
// and is imported only by the post page.

import blogIndex from "./blog-index.json";

export type BlogPost = {
  slug: string;
  url: string; // preserved verbatim from the original site
  title: string;
  metaTitle: string;
  metaDescription: string;
  description: string;
  date: string; // ISO (published)
  modified: string; // ISO (last modified)
  author: string;
  category: string;
  categories: string[];
  tags: string[];
  keywords: string[];
  cover: string | null;
  coverAlt: string;
  readMins: number;
};

export const BLOG_POSTS = blogIndex as BlogPost[];

export function getPost(slug?: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}

/** Distinct categories, most common first, for filtering. */
export function blogCategories(): string[] {
  const counts = new Map<string, number>();
  for (const p of BLOG_POSTS) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
}
