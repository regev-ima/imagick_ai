import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Clock, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { Seo } from "@/components/marketing/Seo";
import { Reveal, Kicker } from "@/components/marketing/Reveal";
import { Sparkle } from "@/components/marketing/Sparkle";
import { BLOG_POSTS, blogCategories, type BlogPost } from "@/components/marketing/blog";
import { SITE } from "@/components/marketing/data";

const PAGE = 12;

const fmtDate = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "";

/** Consistent cover block — falls back to a branded plate when a post has no image. */
function Cover({ post, className = "" }: { post: BlogPost; className?: string }) {
  if (post.cover) {
    return (
      <img
        src={post.cover}
        alt={post.coverAlt || post.title}
        loading="lazy"
        decoding="async"
        className={`h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03] ${className}`}
      />
    );
  }
  return (
    <div className="grid h-full w-full place-items-center bg-surface-2">
      <Sparkle size={28} className="text-primary/40" />
    </div>
  );
}

function PostCard({ post }: { post: BlogPost }) {
  return (
    <Link
      to={post.url}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card/60 transition-colors duration-200 hover:border-primary/40"
    >
      <div className="aspect-[16/9] overflow-hidden border-b border-border">
        <Cover post={post} />
      </div>
      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-center gap-3 caption">
          <span className="rounded-full bg-primary/12 px-2 py-0.5 !text-primary">{post.category}</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" /> {post.readMins} min
          </span>
        </div>
        <h2 className="mt-4 text-xl font-semibold tracking-tight text-foreground group-hover:text-primary">
          {post.title}
        </h2>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground line-clamp-3">
          {post.description}
        </p>
        <div className="mt-5 flex items-center justify-between">
          <span className="caption !normal-case !tracking-normal text-muted-foreground">{fmtDate(post.date)}</span>
          <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
            Read <ArrowUpRight className="h-4 w-4" />
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function BlogIndexPage() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);

  useEffect(() => window.scrollTo(0, 0), []);

  const cats = useMemo(() => blogCategories(), []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return BLOG_POSTS.filter((p) => {
      if (cat && p.category !== cat) return false;
      if (!needle) return true;
      const hay = [p.title, p.description, p.metaDescription, p.category, ...(p.tags || []), ...(p.keywords || [])]
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [q, cat]);

  // Reset the visible window whenever the filter/search changes.
  useEffect(() => setLimit(PAGE), [q, cat]);

  const isBrowsing = !q.trim() && !cat;
  const featured = isBrowsing ? filtered[0] : undefined;
  const rest = featured ? filtered.slice(1) : filtered;
  const shown = rest.slice(0, limit);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: `${SITE.name} Blog`,
    url: `${SITE.url}/blog`,
    blogPost: BLOG_POSTS.map((p) => ({
      "@type": "BlogPosting",
      headline: p.title,
      description: p.description,
      datePublished: p.date,
      url: `${SITE.url}${p.url}`,
    })),
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Seo
        title="Blog — workflow, editing & business for photographers | Imagick.ai"
        description="Practical guides on AI culling, editing in your own style, and delivering galleries faster — for working photographers."
        path="/blog"
        jsonLd={jsonLd}
      />
      <MarketingNav />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden pt-32 pb-8 sm:pt-40">
          <div
            className="pointer-events-none absolute left-1/2 top-0 h-80 w-80 -translate-x-1/2 rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.14) 0%, transparent 70%)" }}
          />
          <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
            <div className="flex justify-center">
              <Kicker>The Imagick blog</Kicker>
            </div>
            <h1 className="mt-5 font-sans text-4xl font-bold tracking-[-0.03em] text-foreground sm:text-5xl">
              Edit less. Shoot more.
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
              Field-tested guides on culling, editing and delivery for photographers.
            </p>
          </div>
        </section>

        {/* Search + filters */}
        <section className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search articles, guides, topics…"
              aria-label="Search the blog"
              className="h-12 w-full rounded-md border border-border bg-surface-1 pl-10 pr-10 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring/40"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ("")}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCat(null)}
              className={`rounded-full border px-3 py-1.5 caption !normal-case !tracking-normal transition-colors ${
                !cat
                  ? "border-primary/40 bg-primary/12 !text-primary"
                  : "border-border bg-surface-2 text-muted-foreground hover:border-primary/30 hover:text-foreground"
              }`}
            >
              All
            </button>
            {cats.map((c) => {
              const active = cat === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCat(active ? null : c)}
                  className={`rounded-full border px-3 py-1.5 caption !normal-case !tracking-normal transition-colors ${
                    active
                      ? "border-primary/40 bg-primary/12 !text-primary"
                      : "border-border bg-surface-2 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                  }`}
                >
                  {c}
                </button>
              );
            })}
          </div>

          <div className="mt-4 caption">
            {filtered.length} {filtered.length === 1 ? "article" : "articles"}
            {cat ? ` in ${cat}` : ""}
            {q.trim() ? ` matching “${q.trim()}”` : ""}
          </div>
        </section>

        {/* Featured */}
        {featured && (
          <section className="mx-auto mt-6 max-w-5xl px-4 sm:px-6">
            <Reveal>
              <Link
                to={featured.url}
                className="group grid overflow-hidden rounded-xl border border-border bg-card/60 transition-colors duration-200 hover:border-primary/40 md:grid-cols-2"
              >
                <div className="aspect-[16/10] overflow-hidden border-b border-border md:aspect-auto md:border-b-0 md:border-r">
                  <Cover post={featured} />
                </div>
                <div className="flex flex-col justify-center p-6 sm:p-8">
                  <div className="flex items-center gap-3 caption">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/12 px-2 py-0.5 !text-primary">
                      <Sparkle size={10} /> Featured
                    </span>
                    <span>{featured.category}</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {featured.readMins} min
                    </span>
                  </div>
                  <h2 className="mt-4 font-sans text-2xl font-bold tracking-tight text-foreground group-hover:text-primary sm:text-3xl">
                    {featured.title}
                  </h2>
                  <p className="mt-3 text-muted-foreground line-clamp-3">{featured.description}</p>
                  <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-primary">
                    Read article <ArrowUpRight className="h-4 w-4" />
                  </span>
                </div>
              </Link>
            </Reveal>
          </section>
        )}

        {/* Grid */}
        <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
          {shown.length > 0 ? (
            <>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {shown.map((p, i) => (
                  <Reveal key={p.slug} delay={(i % 3) * 0.05}>
                    <PostCard post={p} />
                  </Reveal>
                ))}
              </div>

              {shown.length < rest.length && (
                <div className="mt-12 flex justify-center">
                  <Button variant="outline" size="lg" onClick={() => setLimit((l) => l + PAGE)}>
                    Load more articles
                    <span className="text-muted-foreground">({rest.length - shown.length} more)</span>
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-xl border border-border bg-card/60 p-12 text-center">
              <div className="flex justify-center">
                <Sparkle size={20} className="text-primary/50" />
              </div>
              <p className="mt-3 text-muted-foreground">
                No articles matched. Try a different search or category.
              </p>
              <Button
                variant="outline"
                className="mt-5"
                onClick={() => {
                  setQ("");
                  setCat(null);
                }}
              >
                Clear filters
              </Button>
            </div>
          )}
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
