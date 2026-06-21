import { useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  PlayCircle,
  Wand2,
  Aperture,
  ScanFace,
  Images,
  Zap,
  ShieldCheck,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { Seo } from "@/components/marketing/Seo";
import { Sparkle } from "@/components/marketing/Sparkle";
import { BeforeAfter } from "@/components/marketing/BeforeAfter";
import { PricingTiers } from "@/components/marketing/PricingTiers";
import { Testimonials } from "@/components/marketing/Testimonials";
import { Faq } from "@/components/marketing/Faq";
import { AppCta } from "@/components/marketing/AppCta";
import {
  EditorMockup,
  CullingMockup,
  ClientGalleryMockup,
} from "@/components/marketing/ProductMockups";
import { useCountUp } from "@/components/marketing/useCountUp";
import { STATS, HOW_IT_WORKS, FAQS, SITE } from "@/components/marketing/data";
import hero1 from "@/assets/hero-gallery-1.jpg";
import hero3 from "@/assets/hero-gallery-3.jpg";

const EASE = [0.22, 0.61, 0.36, 1] as const;

/* ── small helpers ─────────────────────────────────────────────── */

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-surface-2 px-3 py-1.5">
      <Sparkle size={11} className="text-primary" />
      <span className="caption !tracking-[0.14em] text-muted-foreground">{children}</span>
    </div>
  );
}

function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, delay, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function StatCounter({
  value,
  suffix,
  label,
}: {
  value: number;
  suffix: string;
  label: string;
}) {
  const { ref, value: n } = useCountUp(value);
  return (
    <div className="text-center sm:text-left">
      <div className="folio text-4xl text-foreground sm:text-5xl">
        <span ref={ref}>{n}</span>
        {suffix}
      </div>
      <div className="caption mt-2">{label}</div>
    </div>
  );
}

/* ── hero ──────────────────────────────────────────────────────── */

function Hero() {
  return (
    <section className="relative overflow-hidden pt-32 pb-16 sm:pt-40 sm:pb-24">
      {/* atmosphere */}
      <div className="pointer-events-none absolute inset-0 bg-grid-pattern opacity-[0.35] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
      <div
        className="pointer-events-none absolute left-1/2 top-[-10%] h-[36rem] w-[36rem] -translate-x-1/2 rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.18) 0%, transparent 70%)" }}
      />

      <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="flex justify-center"
        >
          <Kicker>The AI editing studio</Kicker>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05, ease: EASE }}
          className="font-sans text-5xl font-bold leading-[0.98] tracking-[-0.03em] text-foreground sm:text-6xl md:text-7xl"
        >
          Your editing. Your AI.
          <br />
          <span className="text-primary glow-text">Zero presets.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.12, ease: EASE }}
          className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground"
        >
          Imagick.ai trains an AI model on your unique look, then culls, edits and
          delivers an entire shoot in seconds. Get your nights and weekends back —
          without ever handing over your style.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.18, ease: EASE }}
          className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <Button asChild variant="glow" size="lg" className="w-full sm:w-auto">
            <AppCta to="/auth?mode=signup">
              Start for free <ArrowRight className="h-4 w-4" />
            </AppCta>
          </Button>
          <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
            <a href="#showcase">
              <PlayCircle className="h-4 w-4" /> See it in action
            </a>
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.28 }}
          className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 caption"
        >
          <span className="flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5 text-secondary" /> No credit card
          </span>
          <span className="hidden h-3 w-px bg-border sm:block" />
          <span className="flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5 text-secondary" /> Free forever plan
          </span>
          <span className="hidden h-3 w-px bg-border sm:block" />
          <span className="flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5 text-secondary" /> 3,000 AI edits included
          </span>
        </motion.div>
      </div>

      {/* hero product shot */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.32, ease: EASE }}
        className="relative mx-auto mt-14 max-w-5xl px-4 sm:px-6"
      >
        <div
          className="pointer-events-none absolute inset-x-10 -top-6 bottom-0 rounded-[2rem] blur-2xl"
          style={{ background: "radial-gradient(ellipse at center, hsl(var(--primary) / 0.22), transparent 70%)" }}
        />
        <div className="relative">
          <EditorMockup />
        </div>
      </motion.div>
    </section>
  );
}

/* ── stats band ────────────────────────────────────────────────── */

function StatsBand() {
  return (
    <section className="border-y border-border bg-surface-1/50">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-4 py-12 sm:px-6 md:grid-cols-4">
        {STATS.map((s) => (
          <StatCounter key={s.label} value={s.value} suffix={s.suffix} label={s.label} />
        ))}
      </div>
    </section>
  );
}

/* ── features (bento) ──────────────────────────────────────────── */

const FEATURES = [
  {
    icon: Wand2,
    title: "Custom AI style models",
    body: "Show the engine your before/afters and it learns your signature grade. Apply your look to any future shoot — not a preset, you.",
    big: true,
  },
  {
    icon: Aperture,
    title: "AI culling & rating",
    body: "Every frame scored for focus, eyes and expression. Review the keepers, skip the grind.",
  },
  {
    icon: ScanFace,
    title: "Face grouping",
    body: "Faces detected and clustered automatically. Guests click their face to find every photo.",
  },
  {
    icon: Images,
    title: "Client galleries",
    body: "Six branded templates. Clients favourite, comment and download — all in one link.",
  },
  {
    icon: Zap,
    title: "Batch at scale",
    body: "Thousands of images graded in seconds, with a priority queue on paid plans.",
  },
  {
    icon: ShieldCheck,
    title: "Private & secure",
    body: "Your photos and styles stay yours. Galleries are private by default, up to 2 TB.",
  },
];

function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-20 sm:px-6 sm:py-28">
      <Reveal className="mx-auto max-w-2xl text-center">
        <div className="flex justify-center">
          <Kicker>Everything in one studio</Kicker>
        </div>
        <h2 className="font-sans text-3xl font-bold tracking-[-0.02em] text-foreground sm:text-4xl">
          The whole post-production workflow,{" "}
          <span className="text-gradient-primary">handled</span>
        </h2>
        <p className="mt-4 text-muted-foreground">
          From the moment a card hits your desk to the gallery in your client's inbox —
          Imagick takes the repetitive work off your plate.
        </p>
      </Reveal>

      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {FEATURES.map((f, i) => (
          <Reveal
            key={f.title}
            delay={(i % 3) * 0.06}
            className={f.big ? "md:col-span-2 md:row-span-2" : ""}
          >
            <div
              className={`group h-full rounded-xl border border-border bg-card/60 p-6 transition-colors duration-200 hover:border-primary/40 ${
                f.big ? "md:p-8" : ""
              }`}
            >
              <div className="mb-4 inline-grid h-11 w-11 place-items-center rounded-lg bg-primary/12 text-primary ring-1 ring-primary/20">
                <f.icon className="h-5 w-5" />
              </div>
              <h3
                className={`font-sans font-semibold tracking-tight text-foreground ${
                  f.big ? "text-2xl" : "text-lg"
                }`}
              >
                {f.title}
              </h3>
              <p className={`mt-2 leading-relaxed text-muted-foreground ${f.big ? "text-base max-w-md" : "text-sm"}`}>
                {f.body}
              </p>

              {f.big && (
                <div className="mt-6 overflow-hidden rounded-lg border border-border">
                  <BeforeAfter
                    src={hero1}
                    alt="A wedding portrait before and after the photographer's AI style"
                    ratio="aspect-[16/10]"
                  />
                </div>
              )}
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ── how it works ──────────────────────────────────────────────── */

function HowItWorks() {
  return (
    <section id="how" className="relative scroll-mt-24 border-y border-border bg-surface-1/40">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <Reveal className="mx-auto max-w-2xl text-center">
          <div className="flex justify-center">
            <Kicker>From card to client in 4 steps</Kicker>
          </div>
          <h2 className="font-sans text-3xl font-bold tracking-[-0.02em] text-foreground sm:text-4xl">
            Train once. Deliver forever.
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-6 md:grid-cols-4">
          {HOW_IT_WORKS.map((s, i) => (
            <Reveal key={s.step} delay={i * 0.08}>
              <div className="relative h-full rounded-xl border border-border bg-card/60 p-6">
                <div className="folio text-3xl text-primary/30">{s.step}</div>
                <h3 className="mt-3 text-lg font-semibold tracking-tight text-foreground">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                {i < HOW_IT_WORKS.length - 1 && (
                  <ArrowRight className="absolute -right-4 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-border md:block" />
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── product showcase (tabs) ───────────────────────────────────── */

const SHOWCASE = [
  {
    value: "editor",
    label: "AI Editor",
    caption: "Your style applied across the full gallery, with per-image control.",
    Mock: EditorMockup,
  },
  {
    value: "culling",
    label: "Smart culling",
    caption: "Star ratings, top-picks and duplicates — sorted before you sit down.",
    Mock: CullingMockup,
  },
  {
    value: "client",
    label: "Client galleries",
    caption: "A branded, face-searchable gallery your clients will actually enjoy.",
    Mock: ClientGalleryMockup,
  },
];

function Showcase() {
  return (
    <section id="showcase" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-20 sm:px-6 sm:py-28">
      <Reveal className="mx-auto max-w-2xl text-center">
        <div className="flex justify-center">
          <Kicker>A look inside</Kicker>
        </div>
        <h2 className="font-sans text-3xl font-bold tracking-[-0.02em] text-foreground sm:text-4xl">
          Built like the editor you already live in
        </h2>
        <p className="mt-4 text-muted-foreground">
          A pro, dark-first workspace — fast, precise and out of the way, so the
          photo is always the hero.
        </p>
      </Reveal>

      <Reveal delay={0.1} className="mt-10">
        <Tabs defaultValue="editor" className="w-full">
          <TabsList className="mx-auto flex h-auto w-full max-w-md flex-wrap justify-center gap-1 bg-surface-2 p-1">
            {SHOWCASE.map((s) => (
              <TabsTrigger
                key={s.value}
                value={s.value}
                className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-white"
              >
                {s.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {SHOWCASE.map((s) => (
            <TabsContent key={s.value} value={s.value} className="mt-8">
              <div className="relative">
                <div
                  className="pointer-events-none absolute inset-x-10 -top-4 bottom-0 rounded-[2rem] blur-2xl"
                  style={{ background: "radial-gradient(ellipse at center, hsl(var(--primary) / 0.16), transparent 70%)" }}
                />
                <div className="relative">
                  <s.Mock />
                </div>
              </div>
              <p className="mt-5 text-center text-sm text-muted-foreground">{s.caption}</p>
            </TabsContent>
          ))}
        </Tabs>
      </Reveal>
    </section>
  );
}

/* ── before / after ────────────────────────────────────────────── */

function BeforeAfterSection() {
  return (
    <section className="relative border-y border-border bg-surface-1/40">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-2">
        <Reveal>
          <Kicker>Not a filter — your fingerprint</Kicker>
          <h2 className="font-sans text-3xl font-bold tracking-[-0.02em] text-foreground sm:text-4xl">
            It edits the way <span className="text-primary">you</span> would
          </h2>
          <p className="mt-4 text-muted-foreground">
            Presets apply the same numbers to every frame. Imagick learns the
            relationship between your originals and your finished work, then makes
            per-image decisions — protecting skin tones, balancing exposure and
            holding your colour across an entire gallery.
          </p>
          <ul className="mt-6 space-y-3">
            {[
              "Per-image grading, not a global slider",
              "Skin tones protected automatically",
              "Consistent colour across thousands of frames",
              "Drag the slider — that's one model, one shoot",
            ].map((t) => (
              <li key={t} className="flex items-start gap-3 text-sm text-foreground/90">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={0.1}>
          <BeforeAfter
            src={hero3}
            alt="A landscape photograph before and after a custom AI edit"
            ratio="aspect-[4/3]"
          />
        </Reveal>
      </div>
    </section>
  );
}

/* ── pricing ───────────────────────────────────────────────────── */

function PricingSection() {
  return (
    <section id="pricing" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-20 sm:px-6 sm:py-28">
      <Reveal className="mx-auto max-w-2xl text-center">
        <div className="flex justify-center">
          <Kicker>Simple, honest pricing</Kicker>
        </div>
        <h2 className="font-sans text-3xl font-bold tracking-[-0.02em] text-foreground sm:text-4xl">
          Start free. Scale when it pays for itself.
        </h2>
        <p className="mt-4 text-muted-foreground">
          Every paid plan is unlimited edits. The Free plan is free forever — no card,
          no catch.
        </p>
      </Reveal>

      <div className="mt-12">
        <PricingTiers />
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Want the full breakdown?{" "}
        <Link to="/pricing" className="text-primary underline decoration-primary/40 underline-offset-4 hover:decoration-primary">
          Compare every plan →
        </Link>
      </p>
    </section>
  );
}

/* ── testimonials ──────────────────────────────────────────────── */

function TestimonialsSection() {
  return (
    <section className="border-y border-border bg-surface-1/40">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <Reveal className="mx-auto max-w-2xl text-center">
          <div className="flex justify-center">
            <Kicker>Loved by working photographers</Kicker>
          </div>
          <h2 className="font-sans text-3xl font-bold tracking-[-0.02em] text-foreground sm:text-4xl">
            10,000+ photographers got their time back
          </h2>
        </Reveal>
        <div className="mt-12">
          <Testimonials />
        </div>
      </div>
    </section>
  );
}

/* ── faq ───────────────────────────────────────────────────────── */

function FaqSection() {
  return (
    <section id="faq" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-20 sm:px-6 sm:py-28">
      <Reveal className="mx-auto max-w-2xl text-center">
        <div className="flex justify-center">
          <Kicker>Questions, answered</Kicker>
        </div>
        <h2 className="font-sans text-3xl font-bold tracking-[-0.02em] text-foreground sm:text-4xl">
          Everything you might be wondering
        </h2>
      </Reveal>
      <div className="mt-10">
        <Faq />
      </div>
      <p className="mt-8 text-center text-sm text-muted-foreground">
        Still curious?{" "}
        <a href={`mailto:${SITE.email}`} className="text-primary underline decoration-primary/40 underline-offset-4 hover:decoration-primary">
          Talk to us →
        </a>
      </p>
    </section>
  );
}

/* ── final cta ─────────────────────────────────────────────────── */

function FinalCta() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
      <Reveal>
        <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-surface-1 px-6 py-16 text-center sm:px-12">
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(ellipse at center, hsl(var(--primary) / 0.16), transparent 70%)" }}
          />
          <div className="pointer-events-none absolute inset-0 bg-grid-pattern opacity-20 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
          <div className="relative mx-auto max-w-2xl">
            <div className="flex justify-center">
              <span className="aura-orb relative grid h-14 w-14 place-items-center">
                <span className="aura-orb-halo" />
                <span className="aura-orb-ring" />
                <Sparkle size={22} className="relative text-white" />
              </span>
            </div>
            <h2 className="mt-6 font-sans text-3xl font-bold tracking-[-0.02em] text-foreground sm:text-5xl">
              Hand us your next shoot.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
              Train your style, cull in minutes and deliver a gallery your clients
              love — tonight. Start free with 3,000 AI edits.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild variant="glow" size="lg" className="w-full sm:w-auto">
                <AppCta to="/auth?mode=signup">
                  Start for free <ArrowRight className="h-4 w-4" />
                </AppCta>
              </Button>
              <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
                <Link to="/pricing">View pricing</Link>
              </Button>
            </div>
            <p className="mt-5 caption">No credit card · Cancel anytime · Your style stays yours</p>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ── page ──────────────────────────────────────────────────────── */

export default function LandingPage() {
  // Smooth-scroll to a hash target on initial load (e.g. arriving at /#pricing).
  useEffect(() => {
    const { hash } = window.location;
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) requestAnimationFrame(() => el.scrollIntoView({ behavior: "smooth" }));
    }
  }, []);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: SITE.name,
      url: SITE.url,
      logo: `${SITE.url}/favicon.png`,
      sameAs: ["https://twitter.com/imagick_ai"],
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE.name,
      url: SITE.url,
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: SITE.name,
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Web",
      description: SITE.description,
      offers: [
        { "@type": "Offer", name: "Free", price: "0", priceCurrency: "USD" },
        { "@type": "Offer", name: "Starter", price: "19", priceCurrency: "USD" },
        { "@type": "Offer", name: "Pro", price: "49", priceCurrency: "USD" },
        { "@type": "Offer", name: "Studio", price: "99", priceCurrency: "USD" },
      ],
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
        title="Imagick.ai — Train AI on your editing style | AI photo editing for photographers"
        description={SITE.description}
        path="/"
        jsonLd={jsonLd}
      />
      <MarketingNav />
      <main>
        <Hero />
        <StatsBand />
        <Features />
        <HowItWorks />
        <Showcase />
        <BeforeAfterSection />
        <PricingSection />
        <TestimonialsSection />
        <FaqSection />
        <FinalCta />
      </main>
      <MarketingFooter />
    </div>
  );
}
