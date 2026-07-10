import { Star } from "lucide-react";
import { Reveal } from "@/components/marketing/Reveal";
import { PageShell, PageHero, PageSection, CtaPanel } from "@/components/marketing/PageShell";
import { SITE } from "@/components/marketing/data";

type Study = {
  niche: string;
  name: string;
  role: string;
  initials: string;
  problem: string;
  result: string;
  quote: string;
  metrics: { value: string; label: string }[];
};

const STUDIES: Study[] = [
  {
    niche: "Weddings",
    name: "Dana K.",
    role: "Wedding photographer",
    initials: "DK",
    problem:
      "A 14-hour wedding meant ~5,000 frames and three late nights of culling and grading before the couple saw anything.",
    result:
      "Trained a style on 80 of her past edits. The AI now culls to keepers and grades the full gallery overnight; she reviews over coffee and ships.",
    quote: "I had the culled, graded gallery to the couple the next morning. That used to be three nights of my life.",
    metrics: [
      { value: "18h", label: "saved per wedding" },
      { value: "24h", label: "delivery time" },
      { value: "3×", label: "more reviews mentioning speed" },
    ],
  },
  {
    niche: "Portrait & editorial",
    name: "Marco V.",
    role: "Portrait & editorial",
    initials: "MV",
    problem:
      "Marco's clients hire him for a very specific skin-tone treatment. Outsourced editors kept coming back 'close, but not him'.",
    result:
      "His trained style nails the treatment on the first pass — because it learned from his own befores-and-afters, not a preset pack.",
    quote: "It actually learned my look. The skin tones come back the way I'd grade them by hand.",
    metrics: [
      { value: "0", label: "revision rounds on grading" },
      { value: "92%", label: "frames untouched after AI pass" },
      { value: "2×", label: "shoots taken per month" },
    ],
  },
  {
    niche: "Events",
    name: "Tom R.",
    role: "Event photographer",
    initials: "TR",
    problem:
      "Conferences produce 4,000+ frames a day. Culling alone ate two working days before a single edit happened.",
    result:
      "AI culling hands him scene-grouped keepers; his style grades them; organisers get a same-day highlight set for social.",
    quote: "Now the AI hands me the keepers and I just confirm. Easily 10 hours back a week.",
    metrics: [
      { value: "10h", label: "back per week" },
      { value: "same-day", label: "highlight delivery" },
      { value: "100%", label: "repeat bookings this season" },
    ],
  },
  {
    niche: "Studios",
    name: "Noa B.",
    role: "Studio owner, 3 shooters",
    initials: "NB",
    problem:
      "Three photographers, three looks. Every gallery needed a unifying edit pass so the studio's portfolio felt like one brand.",
    result:
      "One shared studio style, trained once. Every shooter's work comes back consistent — no unifying pass, no bottleneck at the owner's desk.",
    quote: "Shared styles mean every gallery looks like us, no matter who pressed the shutter.",
    metrics: [
      { value: "1", label: "brand look across 3 shooters" },
      { value: "-70%", label: "owner editing time" },
      { value: "5→2", label: "days to client delivery" },
    ],
  },
];

export default function CaseStudiesPage() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Imagick.ai case studies",
      itemListElement: STUDIES.map((s, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: `${s.niche} — ${s.name}`,
        url: `${SITE.url}/case-studies`,
      })),
    },
  ];

  return (
    <PageShell
      title="Case studies — photographers on Imagick.ai"
      description="How wedding, portrait, event and studio photographers cut editing time by 70–90% with AI trained on their own style. Real workflows, real numbers."
      path="/case-studies"
      jsonLd={jsonLd}
    >
      <PageHero
        kicker="Case studies"
        title="The nights they got back"
        lede="Four working photographers, four workflows — and the numbers before and after Imagick."
      />

      <PageSection>
        <div className="grid gap-6 lg:grid-cols-2">
          {STUDIES.map((s, i) => (
            <Reveal key={s.name} delay={(i % 2) * 0.08}>
              <article className="flex h-full flex-col rounded-xl border border-border bg-card/60 p-6 transition-colors duration-200 hover:border-primary/40 sm:p-8">
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full bg-primary/12 px-2.5 py-0.5 caption !text-primary">{s.niche}</span>
                  <span className="flex items-center gap-0.5">
                    {[0, 1, 2, 3, 4].map((n) => (
                      <Star key={n} className="h-3.5 w-3.5 fill-rating text-rating" />
                    ))}
                  </span>
                </div>

                <h2 className="mt-4 text-xl font-semibold tracking-tight text-foreground">
                  {s.name} <span className="font-normal text-muted-foreground">· {s.role}</span>
                </h2>

                <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
                  <p>
                    <span className="font-medium text-foreground">The problem: </span>
                    {s.problem}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">With Imagick: </span>
                    {s.result}
                  </p>
                </div>

                <blockquote className="mt-5 border-l-2 border-primary/40 pl-4 text-[15px] leading-relaxed text-foreground/90">
                  "{s.quote}"
                </blockquote>

                <div className="mt-6 grid grid-cols-3 gap-3 border-t border-border pt-5">
                  {s.metrics.map((m) => (
                    <div key={m.label}>
                      <div className="folio text-2xl text-primary">{m.value}</div>
                      <div className="mt-1 caption !normal-case !tracking-normal">{m.label}</div>
                    </div>
                  ))}
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </PageSection>

      <CtaPanel
        title="Your workflow could be next"
        body="Start free, train a style on your own edits, and measure the difference on one real shoot."
      />
    </PageShell>
  );
}
