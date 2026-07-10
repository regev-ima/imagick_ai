import { ShieldCheck, Zap, Camera } from "lucide-react";
import { Reveal } from "@/components/marketing/Reveal";
import { PageShell, PageHero, PageSection, SectionHead, CtaPanel } from "@/components/marketing/PageShell";
import { SITE } from "@/components/marketing/data";

const VALUES = [
  {
    icon: Camera,
    title: "Photographers first",
    body: "Every feature starts from a working photographer's week: the card that has to be culled tonight, the gallery that has to ship Friday. If it doesn't give you hours back, it doesn't ship.",
  },
  {
    icon: ShieldCheck,
    title: "Your style stays yours",
    body: "The AI you train on your edits belongs to you. We never share it, sell it, or use it to edit anyone else's photos. Your look is your business — literally.",
  },
  {
    icon: Zap,
    title: "Speed without compromise",
    body: "Fast is only useful if it's right. Imagick aims for edits you'd sign your name under — in your style, at your standard — just without the three late nights.",
  },
];

export default function AboutPage() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "AboutPage",
      name: `About ${SITE.name}`,
      url: `${SITE.url}/about`,
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: SITE.name,
      url: SITE.url,
      email: SITE.email,
      logo: `${SITE.url}/favicon.png`,
    },
  ];

  return (
    <PageShell
      title="About Imagick.ai — the AI editing studio for photographers"
      description="Why we built Imagick: photographers were losing nights to editing. Train an AI on your own style, cull in minutes, deliver galleries clients love."
      path="/about"
      jsonLd={jsonLd}
    >
      <PageHero
        kicker="Our story"
        title={
          <>
            Built by people who hated
            <br className="hidden sm:block" /> losing nights to editing.
          </>
        }
        lede="Imagick exists because 'shoot Saturday, edit until Wednesday' shouldn't be the price of being a photographer."
      />

      <PageSection className="max-w-3xl">
        <Reveal>
          <div className="space-y-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
            <p>
              Every photographer we know tells the same story. The shoot is the easy part — the part
              they love. Then come the nights: thousands of frames to cull, hours of grading to keep a
              consistent look, clients refreshing their inbox while the backlog grows.
            </p>
            <p>
              Presets promised to fix it and didn't — they flatten everyone into the same look. Outsourced
              editors help, but your style arrives back approximately, not exactly. So we built the tool we
              wished existed: an AI that <span className="text-foreground">learns your editing from your own edits</span>,
              culls the way you would, and hands you back a gallery that looks like you on your best day.
            </p>
            <p>
              Today {SITE.name} trains personal editing styles for photographers across weddings,
              portraits, events and real estate — and gives them their evenings back.
            </p>
          </div>
        </Reveal>
      </PageSection>

      <PageSection tint>
        <SectionHead kicker="What we believe" title="Three promises we don't break" />
        <div className="grid gap-4 md:grid-cols-3">
          {VALUES.map((v, i) => (
            <Reveal key={v.title} delay={i * 0.06}>
              <div className="group h-full rounded-xl border border-border bg-card/60 p-6 transition-colors duration-200 hover:border-primary/40">
                <div className="mb-4 inline-grid h-11 w-11 place-items-center rounded-lg bg-primary/12 text-primary ring-1 ring-primary/20">
                  <v.icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold tracking-tight text-foreground">{v.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{v.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </PageSection>

      <PageSection className="max-w-3xl text-center">
        <SectionHead title="Talk to us" lede="Questions, ideas, press, partnerships — we read everything." />
        <Reveal>
          <a
            href={`mailto:${SITE.email}`}
            className="text-lg font-medium text-primary underline-offset-4 hover:underline"
          >
            {SITE.email}
          </a>
        </Reveal>
      </PageSection>

      <CtaPanel />
    </PageShell>
  );
}
