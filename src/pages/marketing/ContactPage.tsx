import { Mail, MessageCircle, Rocket } from "lucide-react";
import { Reveal } from "@/components/marketing/Reveal";
import { PageShell, PageHero, PageSection, CtaPanel } from "@/components/marketing/PageShell";
import { AppCta } from "@/components/marketing/AppCta";
import { Link } from "react-router-dom";
import { SITE } from "@/components/marketing/data";

const CHANNELS = [
  {
    icon: Mail,
    title: "Email us",
    body: "Product questions, billing, press, partnerships — one inbox, real humans, replies within one business day.",
    cta: { label: SITE.email, href: `mailto:${SITE.email}` },
  },
  {
    icon: Rocket,
    title: "Studios & enterprise",
    body: "Multi-seat teams, high-volume plans and custom onboarding — tell us about your studio and we'll tailor it.",
    cta: { label: "Enterprise inquiries", href: `mailto:${SITE.email}?subject=Imagick.ai%20Enterprise` },
  },
  {
    icon: MessageCircle,
    title: "Just exploring?",
    body: "The fastest answer to 'will it match my style?' is training one. It's free and takes about ten minutes.",
    cta: { label: "Start free", app: "/auth?mode=signup" },
  },
];

export default function ContactPage() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "ContactPage",
      name: `Contact ${SITE.name}`,
      url: `${SITE.url}/contact`,
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: SITE.name,
      url: SITE.url,
      contactPoint: {
        "@type": "ContactPoint",
        email: SITE.email,
        contactType: "customer support",
        availableLanguage: ["English"],
      },
    },
  ];

  return (
    <PageShell
      title="Contact — Imagick.ai"
      description="Talk to the Imagick.ai team: support, billing, studios & enterprise, press and partnerships. Real humans, replies within one business day."
      path="/contact"
      jsonLd={jsonLd}
    >
      <PageHero
        kicker="Contact"
        title="Talk to a human"
        lede="No ticket maze. Email us and a person who actually works on the product answers."
      />

      <PageSection>
        <div className="grid gap-4 md:grid-cols-3">
          {CHANNELS.map((c, i) => (
            <Reveal key={c.title} delay={i * 0.06}>
              <div className="group flex h-full flex-col rounded-xl border border-border bg-card/60 p-6 transition-colors duration-200 hover:border-primary/40">
                <div className="mb-4 inline-grid h-11 w-11 place-items-center rounded-lg bg-primary/12 text-primary ring-1 ring-primary/20">
                  <c.icon className="h-5 w-5" />
                </div>
                <h2 className="text-lg font-semibold tracking-tight text-foreground">{c.title}</h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{c.body}</p>
                {"app" in c.cta && c.cta.app ? (
                  <AppCta to={c.cta.app} className="mt-5 text-sm font-medium text-primary underline-offset-4 hover:underline">
                    {c.cta.label} →
                  </AppCta>
                ) : (
                  <a
                    href={(c.cta as { href: string }).href}
                    className="mt-5 break-all text-sm font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {c.cta.label} →
                  </a>
                )}
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-10 text-center">
          <p className="text-sm text-muted-foreground">
            Looking for pricing details? See <Link to="/pricing" className="text-primary hover:underline">plans & pricing</Link> —
            or the answers to common questions on <Link to="/ai-styles" className="text-primary hover:underline">AI styles</Link>.
          </p>
        </Reveal>
      </PageSection>

      <CtaPanel />
    </PageShell>
  );
}
