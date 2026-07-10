import { useEffect } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarketingNav } from "./MarketingNav";
import { MarketingFooter } from "./MarketingFooter";
import { Seo } from "./Seo";
import { Sparkle } from "./Sparkle";
import { AppCta } from "./AppCta";
import { Kicker, Reveal } from "./Reveal";

/**
 * Shared scaffold for secondary marketing pages (about, ai-styles, compare…).
 * Keeps every page on the exact same LIGHTROOM recipes: fixed glass nav,
 * standard hero rhythm, closing CTA panel, footer.
 */
export function PageShell({
  title,
  description,
  path,
  jsonLd,
  children,
}: {
  title: string;
  description: string;
  path: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  children: React.ReactNode;
}) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [path]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Seo title={title} description={description} path={path} jsonLd={jsonLd} />
      <MarketingNav />
      <main>{children}</main>
      <MarketingFooter />
    </div>
  );
}

/** Standard sub-page hero: glow orb + kicker + H1 + lede. */
export function PageHero({
  kicker,
  title,
  lede,
}: {
  kicker: string;
  title: React.ReactNode;
  lede?: string;
}) {
  return (
    <section className="relative overflow-hidden pt-32 pb-12 sm:pt-40 sm:pb-16">
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-80 w-80 -translate-x-1/2 rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.14) 0%, transparent 70%)" }}
      />
      <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
        <div className="flex justify-center">
          <Kicker>{kicker}</Kicker>
        </div>
        <h1 className="mt-5 font-sans text-4xl font-bold leading-[1.05] tracking-[-0.03em] text-foreground sm:text-5xl">
          {title}
        </h1>
        {lede && <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">{lede}</p>}
      </div>
    </section>
  );
}

/** Closing conversion panel (the rounded-2xl recipe). */
export function CtaPanel({
  title = "Edit your next shoot in your style",
  body = "Train your AI, cull in minutes and deliver a gallery clients love. Free to start — no credit card.",
  label = "Start for free",
  to = "/auth?mode=signup",
  external,
}: {
  title?: string;
  body?: string;
  label?: string;
  to?: string;
  external?: boolean;
}) {
  return (
    <section className="mx-auto max-w-4xl px-4 pb-20 sm:px-6 sm:pb-24">
      <Reveal>
        <div className="overflow-hidden rounded-2xl border border-primary/30 bg-surface-1 p-8 text-center sm:p-10">
          <div className="flex justify-center">
            <Sparkle size={20} className="text-primary" />
          </div>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h2>
          <p className="mx-auto mt-2 max-w-md text-muted-foreground">{body}</p>
          <Button asChild variant="glow" size="lg" className="mt-6">
            {external ? (
              <a href={to}>
                {label} <ArrowRight className="h-4 w-4" />
              </a>
            ) : (
              <AppCta to={to}>
                {label} <ArrowRight className="h-4 w-4" />
              </AppCta>
            )}
          </Button>
        </div>
      </Reveal>
    </section>
  );
}

/** Standard content section wrapper with the site rhythm. */
export function PageSection({
  children,
  tint,
  className = "",
}: {
  children: React.ReactNode;
  /** Muted band variant (border-y + surface tint). */
  tint?: boolean;
  className?: string;
}) {
  return (
    <section className={tint ? "border-y border-border bg-surface-1/40" : ""}>
      <div className={`mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 ${className}`}>{children}</div>
    </section>
  );
}

/** Section heading pair used inside PageSection. */
export function SectionHead({
  kicker,
  title,
  lede,
}: {
  kicker?: string;
  title: string;
  lede?: string;
}) {
  return (
    <Reveal className="mx-auto mb-10 max-w-2xl text-center sm:mb-12">
      {kicker && (
        <div className="mb-4 flex justify-center">
          <Kicker>{kicker}</Kicker>
        </div>
      )}
      <h2 className="font-sans text-3xl font-bold tracking-[-0.02em] text-foreground sm:text-4xl">{title}</h2>
      {lede && <p className="mx-auto mt-3 max-w-xl text-muted-foreground">{lede}</p>}
    </Reveal>
  );
}
