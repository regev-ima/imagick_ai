import { useEffect, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { Seo } from "@/components/marketing/Seo";
import { Kicker } from "@/components/marketing/Reveal";
import { SITE } from "@/components/marketing/data";

interface LegalPageLayoutProps {
  title: string;
  lastUpdated: string;
  path: string;
  description: string;
  children: ReactNode;
}

/**
 * Shell for the public legal pages — same LIGHTROOM chrome as the rest of the
 * marketing site (glass nav, footer, dark-first). Keeps a subtle "draft"
 * disclaimer so we never present un-reviewed boilerplate as vetted, without
 * shouting it in a giant banner.
 */
export default function LegalPageLayout({
  title,
  lastUpdated,
  path,
  description,
  children,
}: LegalPageLayoutProps) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [path]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Seo title={`${title} — ${SITE.name}`} description={description} path={path} />
      <MarketingNav />

      <main className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.12) 0%, transparent 70%)" }}
        />
        <div className="relative mx-auto max-w-3xl px-4 pt-32 pb-20 sm:px-6 sm:pt-40">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>

          <header className="mt-8">
            <div className="mb-4">
              <Kicker>Legal</Kicker>
            </div>
            <h1 className="font-sans text-3xl font-bold tracking-[-0.02em] text-foreground sm:text-4xl">{title}</h1>
            <p className="mt-3 caption !normal-case !tracking-normal text-muted-foreground">
              Last updated {lastUpdated}
            </p>
          </header>

          <div className="mt-6 flex items-center gap-2.5 rounded-xl border border-border bg-surface-1 px-4 py-3">
            <span className="h-2 w-2 shrink-0 rounded-full bg-rating" />
            <p className="caption !normal-case !tracking-normal text-muted-foreground">
              Draft — a starting point, not yet reviewed by counsel. Please consult a lawyer before relying on it.
            </p>
          </div>

          <hr className="aura-hairline my-8" />

          <article className="space-y-8 text-[15px] leading-relaxed text-muted-foreground [&_a]:text-primary [&_a]:underline-offset-4 hover:[&_a]:underline [&_h2]:text-foreground [&_li]:marker:text-primary/50 [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
            {children}
          </article>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
