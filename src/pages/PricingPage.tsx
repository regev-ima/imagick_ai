import { useEffect } from "react";
import { appHref } from "@/lib/domains";
import { AppCta } from "@/components/marketing/AppCta";
import { Check, Minus, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { Seo } from "@/components/marketing/Seo";
import { Sparkle } from "@/components/marketing/Sparkle";
import { PricingTiers } from "@/components/marketing/PricingTiers";
import { Faq } from "@/components/marketing/Faq";
import { PLANS, FAQS, SITE } from "@/components/marketing/data";

const COLS = ["Free", "Starter", "Pro", "Studio"];

type Cell = string | boolean;
const ROWS: { label: string; cells: Cell[] }[] = [
  { label: "Monthly AI edits", cells: ["3,000", "Unlimited", "Unlimited", "Unlimited"] },
  { label: "AI culling & rating", cells: ["Basic", true, "Priority", "Priority"] },
  { label: "Face detection & grouping", cells: [true, true, true, true] },
  { label: "Pre-built AI styles", cells: ["5", "5", "30+", "30+"] },
  { label: "Custom AI models", cells: [false, false, "2  (+$15 ea)", "10  (+$10 ea)"] },
  { label: "Client galleries", cells: [true, "Unlimited", "Unlimited", "Unlimited"] },
  { label: "Cloud storage", cells: ["5 GB", "50 GB", "500 GB", "2 TB"] },
  { label: "Priority processing", cells: [false, false, true, true] },
  { label: "Team members", cells: [false, false, false, "Up to 10"] },
  { label: "API access", cells: [false, false, false, true] },
  { label: "Support", cells: ["Standard", "Email", "Chat + email", "Dedicated manager"] },
];

function CellValue({ value, highlight }: { value: Cell; highlight: boolean }) {
  if (value === true)
    return (
      <Check
        className={`mx-auto h-4 w-4 ${highlight ? "text-primary" : "text-secondary"}`}
        strokeWidth={2.5}
      />
    );
  if (value === false) return <Minus className="mx-auto h-4 w-4 text-muted-foreground/40" />;
  return <span className="text-sm text-foreground/90">{value}</span>;
}

export default function PricingPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE.url },
        { "@type": "ListItem", position: 2, name: "Pricing", item: `${SITE.url}/pricing` },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: `${SITE.name} subscription`,
      description: SITE.description,
      brand: { "@type": "Brand", name: SITE.name },
      offers: PLANS.map((p) => ({
        "@type": "Offer",
        name: p.name,
        price: String(p.monthly),
        priceCurrency: "USD",
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQS.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Seo
        title="Pricing — Imagick.ai | Start free, scale your photo editing"
        description="Imagick.ai pricing: a free-forever plan with 3,000 AI edits, plus unlimited Starter, Pro and Studio plans from $19/mo. Train custom AI styles, cull faster, deliver client galleries."
        path="/pricing"
        jsonLd={jsonLd}
      />
      <MarketingNav />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden pt-32 pb-10 sm:pt-40">
          <div
            className="pointer-events-none absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.16) 0%, transparent 70%)" }}
          />
          <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-surface-2 px-3 py-1.5">
              <Sparkle size={11} className="text-primary" />
              <span className="caption !tracking-[0.14em] text-muted-foreground">Pricing</span>
            </div>
            <h1 className="font-sans text-4xl font-bold tracking-[-0.03em] text-foreground sm:text-6xl">
              Pricing that pays for itself{" "}
              <span className="text-primary">in one shoot</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
              Start free forever. Every paid plan is unlimited edits, unlimited
              galleries and unlimited culling.
            </p>
          </div>
        </section>

        {/* Tiers */}
        <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <PricingTiers />
        </section>

        {/* Comparison table */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <h2 className="mb-8 text-center font-sans text-3xl font-bold tracking-[-0.02em] text-foreground">
            Compare every plan
          </h2>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[680px] border-collapse text-left">
              <thead>
                <tr className="border-b border-border bg-surface-2">
                  <th className="px-4 py-4 text-sm font-semibold text-muted-foreground">
                    Features
                  </th>
                  {COLS.map((c) => (
                    <th
                      key={c}
                      className={`px-4 py-4 text-center text-sm font-semibold ${
                        c === "Pro" ? "text-primary" : "text-foreground"
                      }`}
                    >
                      {c}
                      {c === "Pro" && (
                        <span className="ml-1.5 align-middle caption !text-primary">Popular</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row, ri) => (
                  <tr
                    key={row.label}
                    className={`border-b border-border last:border-0 ${ri % 2 ? "bg-card/40" : ""}`}
                  >
                    <th
                      scope="row"
                      className="px-4 py-3.5 text-left text-sm font-medium text-foreground/90"
                    >
                      {row.label}
                    </th>
                    {row.cells.map((cell, ci) => (
                      <td
                        key={ci}
                        className={`px-4 py-3.5 text-center ${
                          COLS[ci] === "Pro" ? "bg-primary/[0.04]" : ""
                        }`}
                      >
                        <CellValue value={cell} highlight={COLS[ci] === "Pro"} />
                      </td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <td className="px-4 py-4" />
                  {PLANS.map((p) => (
                    <td key={p.slug} className={`px-4 py-4 text-center ${p.highlight ? "bg-primary/[0.04]" : ""}`}>
                      <Button
                        asChild
                        size="sm"
                        variant={p.highlight ? "glow" : "outline"}
                        className="w-full"
                      >
                        {p.slug === "studio" ? (
                          <a href={`mailto:${SITE.email}?subject=Imagick.ai%20Studio`}>{p.cta}</a>
                        ) : (
                          <a href={appHref("/auth?mode=signup")}>{p.cta}</a>
                        )}
                      </Button>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16 sm:px-6 sm:py-20">
          <h2 className="mb-10 text-center font-sans text-3xl font-bold tracking-[-0.02em] text-foreground">
            Pricing questions
          </h2>
          <Faq />
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
          <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-surface-1 px-6 py-14 text-center">
            <div
              className="pointer-events-none absolute inset-0"
              style={{ background: "radial-gradient(ellipse at center, hsl(var(--primary) / 0.14), transparent 70%)" }}
            />
            <div className="relative">
              <h2 className="font-sans text-3xl font-bold tracking-[-0.02em] text-foreground sm:text-4xl">
                Try it on a real shoot — free
              </h2>
              <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
                3,000 AI edits, no credit card. See your style come back in seconds.
              </p>
              <Button asChild variant="glow" size="lg" className="mt-7">
                <AppCta to="/auth?mode=signup">
                  Start for free <ArrowRight className="h-4 w-4" />
                </AppCta>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
