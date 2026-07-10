import { Check } from "lucide-react";
import { Reveal } from "@/components/marketing/Reveal";
import { BeforeAfter } from "@/components/marketing/BeforeAfter";
import { PageShell, PageHero, PageSection, CtaPanel } from "@/components/marketing/PageShell";
import { SITE } from "@/components/marketing/data";
import hero1 from "@/assets/hero-gallery-1.jpg";
import hero2 from "@/assets/hero-gallery-2.jpg";

const POINTS = [
  "Drag the handle — the left side is straight out of camera, the right is the photographer's trained style",
  "Same treatment across an entire shoot: skin, light and color stay consistent frame to frame",
  "Train your own style on 50–100 of your past edits — free, in about ten minutes",
];

export default function TryDemoPage() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "Imagick.ai live demo — before & after",
      url: `${SITE.url}/try-demo`,
    },
  ];

  return (
    <PageShell
      title="Try the demo — see an AI style before & after | Imagick.ai"
      description="Drag the slider: straight-out-of-camera vs the photographer's trained AI style. Then train your own on 50–100 of your edits — free."
      path="/try-demo"
      jsonLd={jsonLd}
    >
      <PageHero
        kicker="See it live"
        title="Before. After. Your call."
        lede="These galleries were graded by a trained AI style — not a preset. Drag to compare."
      />

      <PageSection className="max-w-4xl">
        <div className="space-y-8">
          <Reveal>
            <div className="overflow-hidden rounded-xl border border-border">
              <BeforeAfter
                src={hero1}
                alt="A wedding portrait, straight out of camera versus the photographer's trained AI style"
                ratio="aspect-[16/10]"
              />
            </div>
          </Reveal>
          <Reveal delay={0.08}>
            <div className="overflow-hidden rounded-xl border border-border">
              <BeforeAfter
                src={hero2}
                alt="A golden-hour couple session, unedited versus the trained AI style"
                ratio="aspect-[16/10]"
              />
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.1}>
          <ul className="mx-auto mt-10 max-w-2xl space-y-3">
            {POINTS.map((p) => (
              <li key={p} className="flex items-start gap-3 text-[15px] leading-relaxed text-muted-foreground">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                {p}
              </li>
            ))}
          </ul>
        </Reveal>
      </PageSection>

      <CtaPanel
        title="Now try it on your photos"
        body="The free plan includes style training and 3,000 AI edits. Ten minutes from now, this before/after could be yours."
        label="Train my style free"
      />
    </PageShell>
  );
}
