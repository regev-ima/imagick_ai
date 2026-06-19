import { Link } from "react-router-dom";
import { ArrowRight, Wand2, MessagesSquare, LayoutPanelLeft } from "lucide-react";

// Internal design exploration — 3 concepts for "create a new collection".
// Static mocks, unlinked from nav. Compare on the branch preview, pick a
// direction, then we build the chosen one for real.

const concepts = [
  {
    href: "/preview/create-a",
    tag: "Concept A",
    name: "AI Plan",
    icon: Wand2,
    line: "Upload first. Aura analyses the shoot and proposes the whole plan — name, type, style, culling — you just confirm or tweak.",
    feel: "Feels like handing your cards to an assistant.",
  },
  {
    href: "/preview/create-b",
    tag: "Concept B",
    name: "Aura Conversation",
    icon: MessagesSquare,
    line: "A guided chat. Aura asks one thing at a time, or you describe the shoot in plain words and it fills everything in.",
    feel: "Feels like talking to your second shooter.",
  },
  {
    href: "/preview/create-c",
    tag: "Concept C",
    name: "Live Canvas",
    icon: LayoutPanelLeft,
    line: "One page, no steps. Fill the collection in place while a live plan rail updates beside you in real time.",
    feel: "Fastest for power users who do this daily.",
  },
];

export default function CreateConceptIndex() {
  return (
    <div className="min-h-screen bg-background px-6 py-12">
      <div className="mx-auto w-full max-w-4xl">
        <span className="aura-microlabel">Design exploration · New collection</span>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground lg:text-4xl">
          Three ways to start a shoot
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Same goal — turn a pile of RAWs into an edited, culled, branded gallery — three different
          feelings. Click each, then tell me which direction to build for real.
        </p>
        <hr className="aura-hairline my-8" />

        <div className="grid gap-4 sm:grid-cols-3">
          {concepts.map((c) => (
            <Link
              key={c.href}
              to={c.href}
              className="group glass-card flex flex-col rounded-[--radius] p-5 transition-colors hover:border-primary/40"
            >
              <div className="flex items-center gap-2">
                <div className="grid h-9 w-9 place-items-center rounded-[--radius] bg-primary/10 text-primary">
                  <c.icon className="h-4 w-4" />
                </div>
                <span className="aura-microlabel">{c.tag}</span>
              </div>
              <h2 className="mt-4 text-lg font-semibold tracking-tight text-foreground">{c.name}</h2>
              <p className="mt-1.5 flex-1 text-sm leading-snug text-muted-foreground">{c.line}</p>
              <p className="mt-3 text-xs italic text-muted-foreground/70">{c.feel}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent">
                Open concept
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
