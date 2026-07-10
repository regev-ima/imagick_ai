import { Check, X, Minus } from "lucide-react";
import { Reveal } from "@/components/marketing/Reveal";
import { PageShell, PageHero, PageSection, CtaPanel } from "@/components/marketing/PageShell";
import { SITE } from "@/components/marketing/data";

type Cell = { v: "yes" | "no" | "part"; note?: string } | string;

const COLUMNS = ["Imagick AI style", "Preset packs", "Outsourced editor", "Editing it all yourself"];

const ROWS: { label: string; cells: Cell[] }[] = [
  {
    label: "Learns your personal style",
    cells: [{ v: "yes", note: "trained on your own edits" }, { v: "no", note: "someone else's look" }, { v: "part", note: "approximates it" }, { v: "yes", note: "it is you" }],
  },
  {
    label: "Consistent across mixed lighting",
    cells: [{ v: "yes" }, { v: "no", note: "breaks outside ideal light" }, { v: "part", note: "varies by editor" }, { v: "yes", note: "at the cost of hours" }],
  },
  {
    label: "Culling included",
    cells: [{ v: "yes", note: "keepers surfaced by AI" }, { v: "no" }, { v: "part", note: "usually extra" }, { v: "no", note: "your evenings" }],
  },
  {
    label: "Turnaround for a full wedding",
    cells: ["Same day", "Days — you still edit", "5–10 business days", "2–4 weeks"],
  },
  {
    label: "Cost per shoot",
    cells: ["From free · flat plans", "$50–150 per pack", "$150–400 per gallery", "Your hourly rate × 20h"],
  },
  {
    label: "Improves the more you use it",
    cells: [{ v: "yes", note: "learns from corrections" }, { v: "no", note: "static" }, { v: "part", note: "with feedback rounds" }, { v: "no", note: "same grind every time" }],
  },
  {
    label: "You stay in control of every frame",
    cells: [{ v: "yes", note: "review & tweak anything" }, { v: "yes" }, { v: "no", note: "batched abroad" }, { v: "yes" }],
  },
  {
    label: "Scales through busy season",
    cells: [{ v: "yes" }, { v: "no" }, { v: "part", note: "queue dependent" }, { v: "no", note: "you are the bottleneck" }],
  },
];

function CellView({ cell }: { cell: Cell }) {
  if (typeof cell === "string") {
    return <span className="text-sm text-foreground/90">{cell}</span>;
  }
  const icon =
    cell.v === "yes" ? (
      <Check className="h-4 w-4 text-secondary" />
    ) : cell.v === "no" ? (
      <X className="h-4 w-4 text-destructive" />
    ) : (
      <Minus className="h-4 w-4 text-muted-foreground" />
    );
  return (
    <span className="inline-flex items-start gap-1.5">
      <span className="mt-0.5 shrink-0">{icon}</span>
      {cell.note && <span className="text-xs leading-snug text-muted-foreground">{cell.note}</span>}
    </span>
  );
}

export default function ComparePage() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "Imagick vs presets vs outsourced editing",
      url: `${SITE.url}/compare`,
    },
  ];

  return (
    <PageShell
      title="Compare: Imagick vs presets vs outsourced editing | Imagick.ai"
      description="An honest comparison of the four ways photographers edit: a trained AI style, preset packs, outsourced editors and doing it all yourself — style, cost, turnaround."
      path="/compare"
      jsonLd={jsonLd}
    >
      <PageHero
        kicker="The honest comparison"
        title="Four ways to get a shoot edited"
        lede="Style fidelity, turnaround, cost and control — side by side, without the marketing gloss."
      />

      <PageSection className="max-w-6xl">
        <Reveal>
          <div className="overflow-x-auto rounded-xl border border-border bg-card/60">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="p-4 caption">Criteria</th>
                  {COLUMNS.map((c, i) => (
                    <th key={c} className={`p-4 text-sm font-semibold tracking-tight ${i === 0 ? "text-primary" : "text-foreground"}`}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => (
                  <tr key={row.label} className="border-b border-border last:border-0">
                    <td className="p-4 text-sm font-medium text-foreground">{row.label}</td>
                    {row.cells.map((cell, i) => (
                      <td key={i} className={`p-4 align-top ${i === 0 ? "bg-primary/[0.04]" : ""}`}>
                        <CellView cell={cell} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
        <p className="mt-4 text-center caption !normal-case !tracking-normal">
          Costs are typical market ranges; your mileage varies. The free plan is the cheapest way to check ours.
        </p>
      </PageSection>

      <CtaPanel
        title="Run the comparison on your own shoot"
        body="Train a style free, edit one real gallery, and compare it to whatever you use today."
      />
    </PageShell>
  );
}
