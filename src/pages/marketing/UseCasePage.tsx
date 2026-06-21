import { useEffect } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { Seo } from "@/components/marketing/Seo";
import { Reveal, Kicker, EASE } from "@/components/marketing/Reveal";
import { BeforeAfter } from "@/components/marketing/BeforeAfter";
import { ClientGalleryMockup } from "@/components/marketing/ProductMockups";
import { PricingTiers } from "@/components/marketing/PricingTiers";
import { getUseCase, USE_CASES } from "@/components/marketing/content";
import { SITE } from "@/components/marketing/data";
import hero1 from "@/assets/hero-gallery-1.jpg";

export default function UseCasePage() {
  const { slug } = useParams();
  const useCase = getUseCase(slug);

  useEffect(() => window.scrollTo(0, 0), [slug]);

  if (!useCase) return <Navigate to="/" replace />;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE.url },
      { "@type": "ListItem", position: 2, name: useCase.niche, item: `${SITE.url}/for/${useCase.slug}` },
    ],
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Seo
        title={useCase.metaTitle}
        description={useCase.metaDescription}
        path={`/for/${useCase.slug}`}
        jsonLd={jsonLd}
      />
      <MarketingNav />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden pt-32 pb-12 sm:pt-40">
          <div
            className="pointer-events-none absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.16) 0%, transparent 70%)" }}
          />
          <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE }}
              className="flex justify-center"
            >
              <Kicker>{useCase.eyebrow}</Kicker>
            </motion.div>
            <h1 className="mt-5 font-sans text-4xl font-bold leading-[1.02] tracking-[-0.03em] text-foreground sm:text-5xl">
              {useCase.h1}
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              {useCase.intro}
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild variant="glow" size="lg" className="w-full sm:w-auto">
                <Link to="/auth?mode=signup">
                  Start for free <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
                <Link to="/pricing">View pricing</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Pains → benefits */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-start">
            <Reveal>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">The grind today</h2>
              <ul className="mt-6 space-y-4">
                {useCase.pains.map((p) => (
                  <li key={p} className="flex items-start gap-3 text-muted-foreground">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-destructive/15 text-destructive">
                      <X className="h-3 w-3" strokeWidth={3} />
                    </span>
                    {p}
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={0.1}>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                With <span className="text-primary">Imagick</span>
              </h2>
              <div className="mt-6 space-y-4">
                {useCase.benefits.map((b) => (
                  <div key={b.title} className="rounded-xl border border-border bg-card/60 p-5">
                    <div className="flex items-center gap-2">
                      <span className="grid h-5 w-5 place-items-center rounded-full bg-primary/15 text-primary">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                      <h3 className="font-semibold text-foreground">{b.title}</h3>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{b.body}</p>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* Visual proof */}
        <section className="border-y border-border bg-surface-1/40">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2">
            <Reveal>
              <Kicker>See it</Kicker>
              <h2 className="mt-4 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Your style, applied — then proofed by the client
              </h2>
              <p className="mt-3 text-muted-foreground">
                Drag to see one trained model do the grading, then hand clients a
                branded, face-searchable gallery.
              </p>
              <div className="mt-6">
                <BeforeAfter src={hero1} alt={`${useCase.niche} photo before and after an AI edit`} ratio="aspect-[4/3]" />
              </div>
            </Reveal>
            <Reveal delay={0.1}>
              <ClientGalleryMockup />
            </Reveal>
          </div>
        </section>

        {/* Pricing */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="font-sans text-3xl font-bold tracking-[-0.02em] text-foreground">
              Start free, scale when it pays for itself
            </h2>
            <p className="mt-3 text-muted-foreground">
              3,000 AI edits free. Every paid plan is unlimited.
            </p>
          </Reveal>
          <div className="mt-12">
            <PricingTiers idPrefix={`uc-${useCase.slug}`} />
          </div>
        </section>

        {/* Other niches */}
        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <h2 className="mb-6 text-center caption">Built for every kind of shoot</h2>
          <div className="flex flex-wrap justify-center gap-2">
            {USE_CASES.filter((u) => u.slug !== useCase.slug).map((u) => (
              <Link
                key={u.slug}
                to={`/for/${u.slug}`}
                className="rounded-full border border-border bg-card/60 px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                {u.niche} photographers
              </Link>
            ))}
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
