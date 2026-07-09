import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Clock } from "lucide-react";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { Seo } from "@/components/marketing/Seo";
import { Reveal, Kicker } from "@/components/marketing/Reveal";
import { BLOG_POSTS } from "@/components/marketing/blog";
import { SITE } from "@/components/marketing/data";

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

export default function BlogIndexPage() {
  useEffect(() => window.scrollTo(0, 0), []);

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
      url: `${SITE.url}/blog/${p.slug}`,
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
        <section className="relative overflow-hidden pt-32 pb-10 sm:pt-40">
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

        <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-16">
          <div className="grid gap-6 sm:grid-cols-2">
            {BLOG_POSTS.map((p, i) => (
              <Reveal key={p.slug} delay={(i % 2) * 0.08}>
                <Link
                  to={`/blog/${p.slug}`}
                  className="group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card/60 transition-colors duration-200 hover:border-primary/40"
                >
                  {p.cover && (
                    <div className="aspect-[16/9] overflow-hidden border-b border-border">
                      <img
                        src={p.cover}
                        alt={p.coverAlt ?? p.title}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    </div>
                  )}
                  <div className="flex flex-1 flex-col p-6">
                  <div className="flex items-center gap-3 caption">
                    <span className="rounded-full bg-primary/12 px-2 py-0.5 !text-primary">{p.category}</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {p.readMins} min
                    </span>
                  </div>
                  <h2 className="mt-4 text-xl font-semibold tracking-tight text-foreground group-hover:text-primary">
                    {p.title}
                  </h2>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                    {p.description}
                  </p>
                  <div className="mt-5 flex items-center justify-between">
                    <span className="caption !normal-case !tracking-normal text-muted-foreground">
                      {fmtDate(p.date)}
                    </span>
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                      Read <ArrowUpRight className="h-4 w-4" />
                    </span>
                  </div>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
