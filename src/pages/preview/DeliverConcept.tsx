import { type CSSProperties, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Download,
  Eye,
  EyeOff,
  Heart,
  Images,
  Layers,
  Lock,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Orb } from "@/components/aura/Orb";

// Internal design exploration — "compose the client collection" (DELIVER).
// Static mock, no Supabase: tiles are CSS gradients standing in for photos so
// the interaction model reads without any data. Spec: docs/design/deliver-concept.md

type Photo = {
  id: number;
  hue: number;
  keeper: boolean;
  liked: boolean;
  edited: boolean;
  person: number; // 0 = no recognisable face, 1..3 = a face cluster
};

// Deterministic shoot: 24 frames with stable traits so smart-fill is meaningful.
const PHOTOS: Photo[] = Array.from({ length: 24 }, (_, i) => ({
  id: i,
  hue: (i * 37) % 360,
  keeper: i % 5 !== 0, // ~80% keepers
  liked: i % 4 === 0,
  edited: i % 3 !== 2,
  person: i % 7 === 6 ? 3 : i % 3 === 0 ? 1 : i % 3 === 1 ? 2 : 0,
}));

const PEOPLE = [
  { id: 1, label: "Person 1", note: "the couple", count: PHOTOS.filter((p) => p.person === 1).length },
  { id: 2, label: "Person 2", note: "", count: PHOTOS.filter((p) => p.person === 2).length },
  { id: 3, label: "Person 3", note: "crew", count: PHOTOS.filter((p) => p.person === 3).length },
];

type Seed = "keepers" | "likes" | "edited" | "everything";
const SEEDS: { id: Seed; label: string; pick: (p: Photo) => boolean; line: string }[] = [
  { id: "keepers", label: "Keepers", pick: (p) => p.keeper, line: "I put your keepers in. Add or pull any." },
  { id: "likes", label: "My likes", pick: (p) => p.liked, line: "Only your hearted frames, ready to send." },
  { id: "edited", label: "Edited", pick: (p) => p.edited, line: "Everything I finished editing is in." },
  { id: "everything", label: "Everything", pick: () => true, line: "The whole shoot — cull on the client side." },
];

type Grouping = "flat" | "category" | "person";

function tileStyle(hue: number): CSSProperties {
  return {
    backgroundImage: `linear-gradient(135deg, hsl(${hue} 55% 32%), hsl(${(hue + 40) % 360} 60% 22%))`,
  };
}

export default function DeliverConcept() {
  const [seed, setSeed] = useState<Seed>("keepers");
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(PHOTOS.filter((p) => p.keeper).map((p) => p.id)),
  );
  const [asClient, setAsClient] = useState(false);
  const [grouping, setGrouping] = useState<Grouping>("flat");
  const [hiddenCrew, setHiddenCrew] = useState(true);
  const [activePerson, setActivePerson] = useState<number | null>(null);

  const applySeed = (s: Seed) => {
    setSeed(s);
    setSelected(new Set(PHOTOS.filter(SEEDS.find((x) => x.id === s)!.pick).map((p) => p.id)));
  };
  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const inCount = selected.size;
  const seedLine = SEEDS.find((x) => x.id === seed)!.line;

  // The frames the client would actually see: only the selection, minus hidden
  // people, optionally filtered to the face they tapped.
  const clientPhotos = useMemo(() => {
    return PHOTOS.filter((p) => selected.has(p.id))
      .filter((p) => !(hiddenCrew && p.person === 3))
      .filter((p) => (activePerson == null ? true : p.person === activePerson));
  }, [selected, hiddenCrew, activePerson]);

  const visiblePeople = PEOPLE.filter((pp) => !(hiddenCrew && pp.id === 3)).filter((pp) =>
    PHOTOS.some((p) => p.person === pp.id && selected.has(p.id)),
  );

  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:py-12">
      <div className="mx-auto w-full max-w-5xl">
        {/* Header */}
        <Link to="/preview/create" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Concepts
        </Link>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="aura-microlabel">Design exploration · Client collection</span>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground lg:text-4xl">
              Compose the client collection
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              The same editor grid, one bit per photo: <em>in the collection</em> or not. Tap a frame to
              connect it or pull it out — the client link shows only what you keep in.
            </p>
          </div>
          {/* Workspace / Delivery / Preview switch */}
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-full border border-border bg-surface-1 p-1">
              <span className="rounded-full px-3 py-1.5 text-sm text-muted-foreground">Workspace</span>
              <span className="rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
                Delivery
              </span>
            </div>
            <Button
              variant={asClient ? "default" : "outline"}
              size="sm"
              className="gap-1.5"
              onClick={() => {
                setAsClient((v) => !v);
                setActivePerson(null);
              }}
            >
              <Eye className="h-4 w-4" />
              {asClient ? "Editing" : "Preview as client"}
            </Button>
          </div>
        </div>

        <hr className="aura-hairline my-6" />

        {!asClient ? (
          <>
            {/* Smart-fill — Aura seeds a starting point */}
            <div className="glass-card flex flex-wrap items-center gap-3 rounded-[--radius] p-4">
              <Orb className="h-7 w-7 shrink-0" />
              <p className="flex-1 text-sm text-foreground">
                <span className="font-medium text-accent">Aura</span> · {seedLine}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {SEEDS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => applySeed(s.id)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                      seed === s.id
                        ? "border-primary/50 bg-primary/15 text-foreground"
                        : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground",
                    )}
                  >
                    {s.id === "keepers" && <Sparkles className="mr-1 inline h-3 w-3" />}
                    {s.id === "likes" && <Heart className="mr-1 inline h-3 w-3" />}
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* The curation grid */}
            <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {PHOTOS.map((p) => {
                const inSet = selected.has(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => toggle(p.id)}
                    style={tileStyle(p.hue)}
                    className={cn(
                      "group relative aspect-square overflow-hidden rounded-xl ring-1 transition-all",
                      inSet ? "ring-primary/60" : "opacity-40 ring-border hover:opacity-70",
                    )}
                    aria-pressed={inSet}
                    aria-label={`Frame ${p.id + 1} ${inSet ? "in" : "out of"} collection`}
                  >
                    {/* membership check */}
                    <span
                      className={cn(
                        "absolute left-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full border transition-colors",
                        inSet ? "border-primary bg-primary text-primary-foreground" : "border-white/70 bg-black/30 text-transparent",
                      )}
                    >
                      <Check className="h-3 w-3" />
                    </span>
                    {/* tiny trait hints */}
                    <span className="absolute bottom-1.5 right-1.5 flex gap-1">
                      {p.liked && <Heart className="h-3 w-3 fill-rose-400 text-rose-400" />}
                      {p.keeper && <Star className="h-3 w-3 fill-amber-300 text-amber-300" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          /* ---- Preview as client ------------------------------------------------ */
          <div className="dynamic-tint rounded-[--radius] p-4 sm:p-6">
            {/* Find your photos — anonymous self-identification */}
            <div className="mb-5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent" />
                <span className="text-sm font-medium text-foreground">Find your photos</span>
                <span className="text-xs text-muted-foreground">— tap your face, no sign-in</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-3">
                {visiblePeople.map((pp) => {
                  const rep = PHOTOS.find((p) => p.person === pp.id)!;
                  const on = activePerson === pp.id;
                  return (
                    <button
                      key={pp.id}
                      onClick={() => setActivePerson(on ? null : pp.id)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 transition-transform",
                        on ? "scale-105" : "opacity-90 hover:opacity-100",
                      )}
                    >
                      <span
                        style={tileStyle(rep.hue)}
                        className={cn("h-14 w-14 rounded-full ring-2", on ? "ring-primary" : "ring-border")}
                      />
                      <span className="text-[11px] text-muted-foreground">{pp.count} photos</span>
                    </button>
                  );
                })}
                {activePerson != null && (
                  <button
                    onClick={() => setActivePerson(null)}
                    className="self-center rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Show all
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {clientPhotos.map((p) => (
                <div key={p.id} style={tileStyle(p.hue)} className="group relative aspect-[4/5] overflow-hidden rounded-xl">
                  <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1.5 bg-gradient-to-t from-black/50 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-white/15 text-white"><Heart className="h-3.5 w-3.5" /></span>
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-white/15 text-white"><Download className="h-3.5 w-3.5" /></span>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-center text-xs text-muted-foreground">
              {clientPhotos.length} photos · the client never sees the {PHOTOS.length - inCount} frames you pulled out
            </p>
          </div>
        )}

        {/* Sticky footer — the count is the product */}
        <div className="sticky bottom-4 z-10 mt-6">
          <div className="glass-card flex flex-wrap items-center gap-x-5 gap-y-3 rounded-full px-5 py-3 shadow-lg">
            <div className="flex items-center gap-2">
              <Images className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-foreground">
                {inCount} <span className="text-muted-foreground">of {PHOTOS.length} in this collection</span>
              </span>
            </div>

            {/* grouping mode */}
            <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Layers className="h-4 w-4" />
              <span className="relative inline-flex items-center">
                <select
                  value={grouping}
                  onChange={(e) => setGrouping(e.target.value as Grouping)}
                  className="appearance-none rounded-full border border-border bg-surface-2 py-1 pl-3 pr-7 text-sm text-foreground"
                >
                  <option value="flat">Flat stream</option>
                  <option value="category">By category</option>
                  <option value="person">By person</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5" />
              </span>
            </label>

            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => setHiddenCrew((v) => !v)}
                className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                title="Drop the crew cluster from client face search"
              >
                {hiddenCrew ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                Crew {hiddenCrew ? "hidden" : "shown"}
              </button>
              <Button size="sm" className="gap-1.5 rounded-full">
                <Lock className="h-3.5 w-3.5" />
                Publish
              </Button>
            </div>
          </div>
        </div>

        {/* Why it works */}
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {[
            { icon: Check, t: "Pull out ≠ delete", d: "Removing a frame keeps it in your workspace — fully recoverable, never lost." },
            { icon: Users, t: "No identity up front", d: "You name a collection of photos, never a roster. Guests tap their own face at the link." },
            { icon: Eye, t: "See it before they do", d: "Preview as client renders the real templates over exactly what you kept in." },
          ].map((c) => (
            <div key={c.t} className="glass-card rounded-[--radius] p-4">
              <c.icon className="h-4 w-4 text-accent" />
              <h3 className="mt-2 text-sm font-semibold text-foreground">{c.t}</h3>
              <p className="mt-1 text-sm leading-snug text-muted-foreground">{c.d}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
