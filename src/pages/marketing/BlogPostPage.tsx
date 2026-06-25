import { useEffect } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { Seo } from "@/components/marketing/Seo";
import { Sparkle } from "@/components/marketing/Sparkle";
import { AppCta } from "@/components/marketing/AppCta";
import { getPost, type Block } from "@/components/marketing/content";
import { SITE } from "@/components/marketing/data";

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

function renderBlock(block: Block, i: number) {
  switch (block.type) {
    case "h2":
      return (
        <h2 key={i} className="mt-10 text-2xl font-bold tracking-tight text-foreground">
          {block.text}
        </h2>
      );
    case "p":
      return (
        <p key={i} className="mt-5 text-[17px] leading-[1.75] text-muted-foreground">
          {block.text}
        </p>
      );
    case "ul":
      return (
        <ul key={i} className="mt-5 space-y-2.5">
          {block.items.map((it) => (
            <li key={it} className="flex items-start gap-3 text-[17px] leading-[1.6] text-muted-foreground">
              <Sparkle size={12} className="mt-2 shrink-0 text-primary" />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      );
    case "quote":
      return (
        <blockquote
          key={i}
          className="my-8 border-l-2 border-primary pl-5 text-xl font-medium leading-relaxed text-foreground"
        >
          "{block.text}"
        </blockquote>
      );
  }
}

export default function BlogPostPage() {
  const { slug } = useParams();
  const post = getPost(slug);

  useEffect(() => window.scrollTo(0, 0), [slug]);

  if (!post) return <Navigate to="/blog" replace />;

  const url = `${SITE.url}/blog/${post.slug}`;
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.title,
      description: post.description,
      datePublished: post.date,
      dateModified: post.updated ?? post.date,
      ...(post.cover ? { image: [`${SITE.url}${post.cover}`] } : {}),
      ...(post.keywords?.length ? { keywords: post.keywords.join(", ") } : {}),
      ...(post.category ? { articleSection: post.category } : {}),
      inLanguage: "en",
      author: { "@type": "Organization", name: post.author ?? SITE.name },
      publisher: {
        "@type": "Organization",
        name: SITE.name,
        logo: { "@type": "ImageObject", url: `${SITE.url}/favicon.png` },
      },
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
        title={`${post.title} | Imagick.ai`}
        description={post.description}
        path={`/blog/${post.slug}`}
        image={post.cover}
        jsonLd={jsonLd}
      />
      <MarketingNav />

      <main className="mx-auto max-w-2xl px-4 pt-32 pb-20 sm:px-6 sm:pt-40">
        <Link
          to="/blog"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> All posts
        </Link>

        <article className="mt-6">
          <div className="flex items-center gap-3 caption">
            <span className="rounded-full bg-primary/12 px-2 py-0.5 !text-primary">{post.tag}</span>
            <span>{fmtDate(post.date)}</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" /> {post.readMins} min read
            </span>
          </div>

          <h1 className="mt-4 font-sans text-3xl font-bold leading-[1.1] tracking-[-0.02em] text-foreground sm:text-4xl">
            {post.title}
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{post.description}</p>

          {post.cover && (
            <figure className="mt-7 overflow-hidden rounded-xl border border-border">
              <img
                src={post.cover}
                alt={post.coverAlt ?? post.title}
                className="aspect-[16/9] w-full object-cover"
                loading="eager"
                decoding="async"
              />
            </figure>
          )}

          <hr className="aura-hairline my-8" />

          {post.contentHtml ? (
            <div
              className="prose prose-lg max-w-none dark:prose-invert prose-headings:tracking-tight prose-img:rounded-lg prose-a:text-primary"
              dangerouslySetInnerHTML={{ __html: post.contentHtml }}
            />
          ) : (
            <div>{post.body?.map(renderBlock)}</div>
          )}
        </article>

        {/* CTA */}
        <div className="mt-12 overflow-hidden rounded-2xl border border-primary/30 bg-surface-1 p-8 text-center">
          <div className="flex justify-center">
            <Sparkle size={20} className="text-primary" />
          </div>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground">
            Try it on your next shoot
          </h2>
          <p className="mx-auto mt-2 max-w-md text-muted-foreground">
            Train your style, cull in minutes and deliver a gallery clients love. Free
            to start.
          </p>
          <Button asChild variant="glow" size="lg" className="mt-6">
            <AppCta to="/auth?mode=signup">
              Start for free <ArrowRight className="h-4 w-4" />
            </AppCta>
          </Button>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
