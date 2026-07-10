import { Wand2, Sun, Users, Layers, Moon, Palette } from "lucide-react";
import { Reveal } from "@/components/marketing/Reveal";
import { Faq } from "@/components/marketing/Faq";
import { PageShell, PageHero, PageSection, SectionHead, CtaPanel } from "@/components/marketing/PageShell";
import { SITE, FAQS } from "@/components/marketing/data";

const TRAINING_STEPS = [
  {
    step: "01",
    title: "Feed it your edits",
    body: "Upload 50–100 photos you've already edited — the befores and afters. That's the whole curriculum: your grading, your crops, your taste.",
  },
  {
    step: "02",
    title: "The AI learns your look",
    body: "Training takes minutes, not days. The model studies how you treat skin, light, contrast and color — not what a generic preset would do.",
  },
  {
    step: "03",
    title: "Edit whole shoots in it",
    body: "Point your style at a new shoot and get back a graded gallery that looks like you edited every frame by hand. Tweak anything; it keeps learning.",
  },
];

const HANDLES = [
  { icon: Sun, title: "Mixed lighting", body: "Golden hour, dim reception halls, harsh noon — one style, consistent output across all of it." },
  { icon: Users, title: "Skin tones", body: "Faithful, flattering skin across every subject — the thing presets get wrong first." },
  { icon: Layers, title: "Multiple styles", body: "Keep separate styles per genre — weddings, editorial, real estate — and switch per shoot." },
  { icon: Moon, title: "Black & white", body: "Train a dedicated monochrome look with your contrast curve, not a desaturate filter." },
  { icon: Palette, title: "Color signatures", body: "Teal shadows, film-stock greens, airy pastels — whatever makes your work recognisably yours." },
  { icon: Wand2, title: "Crops & straightening", body: "Learns your framing habits during culling and applies them before you ever open an editor." },
];

export default function AiStylesPage() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "AI styles — train an AI on your editing",
      url: `${SITE.url}/ai-styles`,
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
    <PageShell
      title="AI styles — an AI trained on your editing | Imagick.ai"
      description="Train a personal AI style on 50–100 of your own edits. Consistent skin tones, mixed-light grading and your color signature — across entire shoots, in minutes."
      path="/ai-styles"
      jsonLd={jsonLd}
    >
      <PageHero
        kicker="AI styles"
        title={
          <>
            An AI that edits like you.
            <br className="hidden sm:block" /> Because it learned from you.
          </>
        }
        lede="Not presets. Not filters. A model trained on your own edits, applying your taste to every new shoot."
      />

      <PageSection>
        <SectionHead kicker="How training works" title="Three steps. About ten minutes." />
        <div className="grid gap-6 md:grid-cols-3">
          {TRAINING_STEPS.map((s, i) => (
            <Reveal key={s.step} delay={i * 0.08}>
              <div className="h-full rounded-xl border border-border bg-card/60 p-6">
                <div className="folio text-3xl text-primary/30">{s.step}</div>
                <h3 className="mt-3 text-lg font-semibold tracking-tight text-foreground">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </PageSection>

      <PageSection tint>
        <SectionHead
          kicker="What it handles"
          title="The hard parts, handled"
          lede="The details that make hand-editing slow are exactly what your style learns best."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {HANDLES.map((h, i) => (
            <Reveal key={h.title} delay={(i % 3) * 0.06}>
              <div className="group h-full rounded-xl border border-border bg-card/60 p-6 transition-colors duration-200 hover:border-primary/40">
                <div className="mb-4 inline-grid h-11 w-11 place-items-center rounded-lg bg-primary/12 text-primary ring-1 ring-primary/20">
                  <h.icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold tracking-tight text-foreground">{h.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{h.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </PageSection>

      <PageSection className="max-w-4xl">
        <SectionHead kicker="Questions" title="Everything photographers ask" />
        <Faq />
      </PageSection>

      <CtaPanel
        title="Train your first style today"
        body="The free plan includes style training and 3,000 AI edits. See your own look come back at you in minutes."
      />
    </PageShell>
  );
}
