import { useEffect, useMemo, useState } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Clock, Calendar, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { Seo } from "@/components/marketing/Seo";
import { Sparkle } from "@/components/marketing/Sparkle";
import { AppCta } from "@/components/marketing/AppCta";
import { getPost, BLOG_POSTS } from "@/components/marketing/blog";
import { SmartImage } from "@/components/marketing/img";
import blogContent from "@/components/marketing/blog-content.json";
import { SITE } from "@/components/marketing/data";

const fmtDate = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "";

const PROSE_CLASS =
  "prose prose-lg max-w-none dark:prose-invert prose-headings:font-sans prose-headings:font-semibold prose-headings:tracking-tight prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-img:rounded-lg prose-img:border prose-img:border-border";

/** Split the article after ~3 paragraphs so we can drop an inline CTA mid-read. */
function splitForCta(html: string): [string, string] {
  const marker = "</p>";
  const idxs: number[] = [];
  let i = html.indexOf(marker);
  while (i !== -1) {
    idxs.push(i);
    i = html.indexOf(marker, i + marker.length);
  }
  if (idxs.length < 6) return [html, ""]; // too short to interrupt
  const cut = idxs[Math.min(2, idxs.length - 3)] + marker.length;
  return [html.slice(0, cut), html.slice(cut)];
}

/** Thin brand progress bar pinned to the very top as the reader scrolls. */
function ReadingProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement;
      const max = el.scrollHeight - el.clientHeight;
      setP(max > 0 ? Math.min(1, Math.max(0, el.scrollTop / max)) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <div className="fixed inset-x-0 top-0 z-[60] h-0.5 bg-transparent" aria-hidden="true">
      <div className="h-full bg-primary transition-[width] duration-150 ease-out" style={{ width: `${p * 100}%` }} />
    </div>
  );
}

/** Sticky sign-up card in the article sidebar (desktop). */
function SignupAside() {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--elevation-1)]">
      <div className="flex items-center gap-2">
        <Sparkle size={14} className="text-primary" />
        <span className="caption !text-primary">Try Imagick free</span>
      </div>
      <h3 className="mt-3 font-sans text-lg font-semibold tracking-tight text-foreground">
        Edit your next shoot in your own style
      </h3>
      <ul className="mt-4 space-y-2.5">
        {["Train the AI on your own edits", "Cull thousands of frames in minutes", "Deliver galleries clients love"].map(
          (t) => (
            <li key={t} className="flex items-start gap-2 text-sm text-muted-foreground">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {t}
            </li>
          ),
        )}
      </ul>
      <Button asChild variant="glow" className="mt-5 w-full">
        <AppCta to="/auth?mode=signup">
          Start for free <ArrowRight className="h-4 w-4" />
        </AppCta>
      </Button>
      <p className="mt-3 text-center caption !normal-case !tracking-normal">No credit card · 3,000 free edits</p>
    </div>
  );
}

/** Inline conversion banner placed inside the article body. */
function InlineCta() {
  return (
    <div className="my-10 overflow-hidden rounded-xl border border-primary/30 bg-primary/[0.06] p-6 sm:flex sm:items-center sm:justify-between sm:gap-6">
      <div className="flex items-start gap-3">
        <Sparkle size={18} className="mt-0.5 shrink-0 text-primary" />
        <div>
          <div className="font-semibold text-foreground">Stop editing one photo at a time.</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Train Imagick on your style and edit a whole shoot in minutes.
          </p>
        </div>
      </div>
      <Button asChild variant="glow" className="mt-4 w-full shrink-0 sm:mt-0 sm:w-auto">
        <AppCta to="/auth?mode=signup">
          Try it free <ArrowRight className="h-4 w-4" />
        </AppCta>
      </Button>
    </div>
  );
}

/** Fixed conversion bar for mobile (the sidebar is hidden there). */
function MobileStickyCta() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/85 p-3 backdrop-blur-xl lg:hidden">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-1">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-foreground">Edit in your own style</div>
          <div className="caption !normal-case !tracking-normal">Free · 3,000 edits</div>
        </div>
        <Button asChild variant="glow" size="sm" className="shrink-0">
          <AppCta to="/auth?mode=signup">
            Start free <ArrowRight className="h-4 w-4" />
          </AppCta>
        </Button>
      </div>
    </div>
  );
}

export default function BlogPostPage() {
  const { slug } = useParams();
  const post = getPost(slug);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  const html = post ? (blogContent as Record<string, string>)[post.slug] ?? "" : "";
  const [first, second] = useMemo(() => splitForCta(html), [html]);

  if (!post) return <Navigate to="/blog" replace />;

  const url = `${SITE.url}${post.url}`;
  const related = BLOG_POSTS.filter((p) => p.slug !== post.slug && p.category === post.category).slice(0, 3);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.title,
      description: post.metaDescription,
      ...(post.cover ? { image: [post.cover] } : {}),
      datePublished: post.date,
      dateModified: post.modified,
      author: { "@type": "Organization", name: post.author || SITE.name },
      publisher: {
        "@type": "Organization",
        name: SITE.name,
        logo: { "@type": "ImageObject", url: `${SITE.url}/favicon.png` },
      },
      ...(post.keywords?.length ? { keywords: post.keywords.join(", ") } : {}),
      mainEntityOfPage: url,
      url,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE.url },
        { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE.url}/blog` },
        { "@type": "ListItem", position: 3, name: post.title, item: url },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Seo
        title={post.metaTitle}
        description={post.metaDescription}
        path={post.url}
        image={post.cover ?? undefined}
        jsonLd={jsonLd}
      />
      <ReadingProgress />
      <MarketingNav />

      <main className="mx-auto max-w-6xl px-4 pt-28 pb-24 sm:px-6 sm:pt-36 lg:pb-20">
        <Link
          to="/blog"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> All posts
        </Link>

        <div className="mt-6 gap-10 lg:grid lg:grid-cols-[minmax(0,1fr)_300px] xl:gap-14">
          {/* Article */}
          <article className="min-w-0">
            <div className="flex flex-wrap items-center gap-3 caption">
              <span className="rounded-full bg-primary/12 px-2 py-0.5 !text-primary">{post.category}</span>
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" /> {fmtDate(post.date)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" /> {post.readMins} min read
              </span>
            </div>

            <h1 className="mt-4 font-sans text-3xl font-bold leading-[1.12] tracking-[-0.02em] text-foreground sm:text-4xl">
              {post.title}
            </h1>
            {post.metaDescription && (
              <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{post.metaDescription}</p>
            )}

            {post.cover && (
              <SmartImage
                src={post.cover}
                alt={post.coverAlt}
                width={1200}
                height={675}
                widths={[640, 800, 1200, 1600]}
                sizes="(min-width: 1024px) 760px, 92vw"
                className="mt-7 aspect-[16/9] w-full rounded-xl border border-border object-cover"
                eager
                priority
              />
            )}

            <hr className="aura-hairline my-8" />

            <div className={PROSE_CLASS} dangerouslySetInnerHTML={{ __html: first }} />
            {second && (
              <>
                <InlineCta />
                <div className={PROSE_CLASS} dangerouslySetInnerHTML={{ __html: second }} />
              </>
            )}

            {post.tags?.length > 0 && (
              <div className="mt-10 flex flex-wrap gap-2">
                {post.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-border bg-card/60 px-3 py-1 caption !normal-case !tracking-normal text-muted-foreground"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}

            {/* Full-width closing CTA */}
            <div className="mt-12 overflow-hidden rounded-2xl border border-primary/30 bg-surface-1 p-8 text-center">
              <div className="flex justify-center">
                <Sparkle size={20} className="text-primary" />
              </div>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground">
                Edit your next shoot in your style
              </h2>
              <p className="mx-auto mt-2 max-w-md text-muted-foreground">
                Train your AI, cull in minutes and deliver a gallery clients love. Free to start.
              </p>
              <Button asChild variant="glow" size="lg" className="mt-6">
                <AppCta to="/auth?mode=signup">
                  Start for free <ArrowRight className="h-4 w-4" />
                </AppCta>
              </Button>
            </div>
          </article>

          {/* Sidebar — sticky conversion */}
          <aside className="mt-12 lg:mt-0">
            <div className="lg:sticky lg:top-28">
              <SignupAside />
            </div>
          </aside>
        </div>

        {/* Related */}
        {related.length > 0 && (
          <section className="mt-14">
            <h2 className="mb-5 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              More in {post.category}
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  to={r.url}
                  className="group rounded-xl border border-border bg-card/60 p-4 transition-colors duration-200 hover:border-primary/40"
                >
                  <div className="caption text-muted-foreground">{fmtDate(r.date)}</div>
                  <div className="mt-1.5 text-sm font-medium leading-snug text-foreground group-hover:text-primary">
                    {r.title}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      <MobileStickyCta />
      <MarketingFooter />
    </div>
  );
}
