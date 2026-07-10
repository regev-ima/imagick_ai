import { Users, Layers, Gauge, HeadphonesIcon, ShieldCheck, Building2 } from "lucide-react";
import { Reveal } from "@/components/marketing/Reveal";
import { PageShell, PageHero, PageSection, SectionHead, CtaPanel } from "@/components/marketing/PageShell";
import { SITE } from "@/components/marketing/data";

const FEATURES = [
  {
    icon: Users,
    title: "Multi-photographer teams",
    body: "Seats for every shooter and editor, shared galleries, and roles so the right people see the right work.",
  },
  {
    icon: Layers,
    title: "Shared studio styles",
    body: "One brand look, trained once, applied by everyone. Every gallery leaves the studio looking like the studio.",
  },
  {
    icon: Gauge,
    title: "Volume that scales",
    body: "Custom edit volume for busy season — school photo days, conference circuits, wedding-heavy summers.",
  },
  {
    icon: HeadphonesIcon,
    title: "Dedicated onboarding",
    body: "We migrate your styles, train your team and stay on-call through your first production cycles.",
  },
  {
    icon: ShieldCheck,
    title: "Privacy by contract",
    body: "Your styles and your clients' photos are never used to train anyone else's models. In writing.",
  },
  {
    icon: Building2,
    title: "Invoicing & procurement",
    body: "Annual invoicing, PO-friendly billing and the paperwork your finance team asks for.",
  },
];

export default function EnterprisePage() {
  const mailto = `mailto:${SITE.email}?subject=Imagick.ai%20Enterprise`;
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "Imagick.ai for studios & enterprise",
      url: `${SITE.url}/enterprise`,
    },
  ];

  return (
    <PageShell
      title="Studios & enterprise — Imagick.ai for teams"
      description="Imagick.ai for photography studios and high-volume teams: shared AI styles, multi-seat workflows, custom volume, dedicated onboarding and contractual privacy."
      path="/enterprise"
      jsonLd={jsonLd}
    >
      <PageHero
        kicker="Studios & teams"
        title={
          <>
            One look. Every shooter.
            <br className="hidden sm:block" /> Any volume.
          </>
        }
        lede="For studios, agencies and high-volume operations that need brand-consistent galleries at a pace no editing desk can match."
      />

      <PageSection>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 0.06}>
              <div className="group h-full rounded-xl border border-border bg-card/60 p-6 transition-colors duration-200 hover:border-primary/40">
                <div className="mb-4 inline-grid h-11 w-11 place-items-center rounded-lg bg-primary/12 text-primary ring-1 ring-primary/20">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold tracking-tight text-foreground">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </PageSection>

      <PageSection tint className="max-w-4xl">
        <SectionHead
          kicker="How it starts"
          title="A conversation, not a checkout"
          lede="Tell us how many shooters you run, what you shoot and your monthly volume — we'll come back with a plan and a live walkthrough."
        />
      </PageSection>

      <CtaPanel
        title="Talk to us about your studio"
        body={`Email ${SITE.email} with a line about your team — we reply within one business day.`}
        label="Contact enterprise"
        to={mailto}
        external
      />
    </PageShell>
  );
}
