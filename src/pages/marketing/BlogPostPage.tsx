import { useEffect } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Clock, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { Seo } from "@/components/marketing/Seo";
import { Sparkle } from "@/components/marketing/Sparkle";
import { AppCta } from "@/components/marketing/AppCta";
import { getPost, BLOG_POSTS } from "@/components/marketing/blog";
import blogContent from "@/components/marketing/blog-content.json";
import { SITE } from "@/components/marketing/data";

const fmtDate = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "";

export default function BlogPostPage() {
  const { slug } = useParams();
  const post = getPost(slug);

  useEffect(() => window.scrollTo(0, 0), [slug]);

  if (!post) return <Navigate to="/blog" replace />;

  const html = (blogContent as Record<string, string>)[post.slug] ?? "";
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
      <MarketingNav />

      <main className="mx-auto max-w-3xl px-4 pt-32 pb-20 sm:px-6 sm:pt-40">
        <Link
          to="/blog"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> All posts
        </Link>

        <article className="mt-6">
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
            <img
              src={post.cover}
              alt={post.coverAlt}
              width={1200}
              height={675}
              className="mt-7 aspect-[16/9] w-full rounded-xl border border-border object-cover"
              loading="eager"
              decoding="async"
            />
          )}

          <hr className="aura-hairline my-8" />

          <div
            className="prose prose-lg max-w-none dark:prose-invert prose-headings:font-sans prose-headings:font-semibold prose-headings:tracking-tight prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-img:rounded-lg prose-img:border prose-img:border-border"
            dangerouslySetInnerHTML={{ __html: html }}
          />

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
        </article>

        {/* CTA */}
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

      <MarketingFooter />
    </div>
  );
}
