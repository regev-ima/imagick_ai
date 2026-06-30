import { useState } from "react";
import { Check, Plus, Tag } from "lucide-react";
import { getCullingLabels, type LanguageCode } from "@/lib/cullingLabels";

// The curated culling labels for a shoot type — these are what get sent as
// gallery.culling_labels and drive Aura's first automatic cull. Concepts
// pre-select this set when culling is enabled so tagging is never empty.
export function defaultCullingTags(galleryType: string, language: LanguageCode = "en"): string[] {
  return getCullingLabels(galleryType || "wedding", language);
}

// Shared culling-tag picker used by all three create-collection concepts, so
// the labels behave identically everywhere: curated set per shoot type +
// custom additions, capped at 20 (matches the production wizard).
export function CullingTags({ galleryType, language = "en", value, onChange }: {
  galleryType: string;
  language?: LanguageCode;
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [custom, setCustom] = useState("");
  const curated = getCullingLabels(galleryType || "wedding", language);
  const customs = value.filter((v) => !curated.includes(v));
  const all = [...curated, ...customs];

  const toggle = (label: string) => {
    if (value.includes(label)) onChange(value.filter((v) => v !== label));
    else if (value.length < 20) onChange([...value, label]);
  };
  const addCustom = () => {
    const t = custom.trim();
    if (t && !value.includes(t) && value.length < 20) {
      onChange([...value, t]);
      setCustom("");
    }
  };

  return (
    <div className="space-y-2.5">
      <div className="caption flex items-center gap-1.5">
        <Tag className="h-3 w-3" /> What should I look for?
        <span className="text-primary">{value.length}<span className="text-muted-foreground/50">/20</span></span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {all.map((label) => {
          const on = value.includes(label);
          const locked = value.length >= 20 && !on;
          return (
            <button
              key={label}
              type="button"
              onClick={() => toggle(label)}
              disabled={locked}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all active:scale-95 ${
                on
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-surface-2 text-foreground/80 hover:border-primary/50 hover:text-foreground"
              } ${locked ? "cursor-not-allowed opacity-50" : ""}`}
            >
              {on && <Check className="mr-1 inline h-3 w-3" strokeWidth={2.5} />}
              {label}
            </button>
          );
        })}
      </div>
      <div className="flex gap-2">
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
          placeholder="Add your own label…"
          disabled={value.length >= 20}
          className="h-8 min-w-0 flex-1 rounded-md border border-border bg-surface-2 px-3 text-base outline-none transition-colors focus:border-primary/50 sm:text-sm"
        />
        <button
          type="button"
          onClick={addCustom}
          disabled={!custom.trim() || value.length >= 20}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
