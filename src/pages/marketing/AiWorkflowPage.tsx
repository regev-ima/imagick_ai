import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/marketing/Reveal";
import {
  EditorMockup,
  CullingMockup,
  ClientGalleryMockup,
} from "@/components/marketing/ProductMockups";
import { PageShell, PageHero, PageSection, SectionHead, CtaPanel } from "@/components/marketing/PageShell";
import { SITE, HOW_IT_WORKS } from "@/components/marketing/data";

const STAGES = [
  {
    kicker: "Cull",
    title: "From 4,000 frames to the keepers — in minutes",
    body: "Ingest the card and let the AI surface sharp, well-exposed, eyes-open frames, grouped by scene. You confirm instead of squinting; duplicates and misfires never reach your editor.",
    mockup: CullingMockup,
  },
  {
    kicker: "Edit",
    title: "Your style, applied to the whole shoot",
    body: "The style you trained grades every keeper the way you would: your skin tones, your contrast, your color. Adjust any frame and the AI learns from the correction.",
    mockup: EditorMockup,
  },
  {
    kicker: "Deliver",
    title: "A client gallery that closes the loop",
    body: "Ship a branded gallery the same day. Clients favourite, comment and find themselves with face search — and you get selects back without the email ping-pong.",
    mockup: ClientGalleryMockup,
  },
];

export default function AiWorkflowPage() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: "The Imagick AI photo-editing workflow",
      description: "Ingest, cull, edit in your own AI style and deliver a client gallery — in one sitting.",
      step: HOW_IT_WORKS.map((s, i) => ({
        "@type": "HowToStep",
        position: i + 1,
        name: s.title,
        text: s.body,
      })),
    },
  ];

  return (
    <PageShell
      title="The AI workflow — card to client gallery in one sitting | Imagick.ai"
      description="See the full Imagick workflow: AI culling that finds the keepers, editing in your own trained style, and same-day client gallery delivery."
      path="/ai-workflow"
      jsonLd={jsonLd}
    >
      <PageHero
        kicker="The workflow"
        title={
          <>
            From memory card to client gallery
            <br className="hidden sm:block" /> — in one sitting.
          </>
        }
        lede="Every stage of the post-shoot grind, rebuilt around an AI that already knows how you work."
      />

      {/* 4-step overview (same data as the landing page, kept in sync) */}
      <PageSection>
        <div className="grid gap-6 md:grid-cols-4">
          {HOW_IT_WORKS.map((s, i) => (
            <Reveal key={s.step} delay={i * 0.08}>
              <div className="relative h-full rounded-xl border border-border bg-card/60 p-6">
                <div className="folio text-3xl text-primary/30">{s.step}</div>
                <h3 className="mt-3 text-lg font-semibold tracking-tight text-foreground">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                {i < HOW_IT_WORKS.length - 1 && (
                  <ArrowRight className="absolute -right-4 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-border md:block" />
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </PageSection>

      {/* Deep dive per stage with product mockups */}
      {STAGES.map((stage, i) => (
        <PageSection key={stage.kicker} tint={i % 2 === 0}>
          <div className={`grid items-center gap-10 lg:grid-cols-2 ${i % 2 ? "lg:[&>*:first-child]:order-2" : ""}`}>
            <Reveal className="min-w-0">
              <div>
                <div className="caption !text-primary">{stage.kicker}</div>
                <h2 className="mt-3 font-sans text-2xl font-bold tracking-[-0.02em] text-foreground sm:text-3xl">
                  {stage.title}
                </h2>
                <p className="mt-4 leading-relaxed text-muted-foreground">{stage.body}</p>
              </div>
            </Reveal>
            <Reveal delay={0.08} className="min-w-0">
              <stage.mockup />
            </Reveal>
          </div>
        </PageSection>
      ))}

      <CtaPanel
        title="Run your next shoot through it"
        body="Free plan, 3,000 AI edits, no credit card. The first gallery you deliver same-day sells itself."
      />
    </PageShell>
  );
}
