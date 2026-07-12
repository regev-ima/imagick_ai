import { Ban, Check, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { getThumbnailUrl } from "@/lib/imageUrls";
import { useStyleCovers } from "@/hooks/useStyleCovers";

/** The AI mark — 4-point sparkle (logo star). Inherits currentColor. */
export function Sparkle({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden style={{ display: "block" }}>
      <path d="M12 0 C12.9 7.2 16.8 11.1 24 12 C16.8 12.9 12.9 16.8 12 24 C11.1 16.8 7.2 12.9 0 12 C7.2 11.1 11.1 7.2 12 0 Z" fill="currentColor" />
    </svg>
  );
}

/**
 * Minimal structural shape a look tile needs. Both the create-collection
 * `StyleRow` and the in-editor re-edit style rows satisfy this, so the SAME
 * picker renders in both places — "pick an AI look" looks identical whether
 * you're building a new collection or re-editing an existing one.
 */
export interface LookStyle {
  id: string;
  name: string;
  user_id?: string | null;
  status?: string | null;
  style_id_external?: string | null;
  thumbnail_url?: string | null;
  after_image_urls?: string[] | null;
}

export function LookGrid({
  styles, selectedIds, chosen, ownerId, onToggle, onHosting, max, usedIds = [],
}: {
  styles: LookStyle[];
  selectedIds: string[];
  chosen: boolean;
  ownerId?: string | null;
  onToggle: (id: string) => void;
  /** The "no editing / host as-is" opt-out. Omit it (re-edit) to hide it. */
  onHosting?: () => void;
  max: number;
  /** Styles already applied to the target images — shown locked (re-edit). */
  usedIds?: string[];
}) {
  const usedSet = new Set(usedIds);
  const atMax = selectedIds.length >= max;
  const hosting = chosen && selectedIds.length === 0;
  const bestId = styles[0]?.id;
  // Each look maps to an editing-engine key (style_id_external). Presets
  // without a trained model share the default key "1" — the engine can only
  // apply ONE of them per collection (it edits once, the extras silently
  // collapse). So any ONE such look is fully usable; we just lock its
  // same-engine siblings once one is picked, instead of blocking them all.
  const keyOf = (s: LookStyle) => (s.style_id_external || "1");
  const claimedKey = new Map<string, string>();
  for (const id of selectedIds) {
    const s = styles.find((x) => x.id === id);
    if (s) claimedKey.set(keyOf(s), id);
  }
  const engineTaken = (s: LookStyle) => {
    const owner = claimedKey.get(keyOf(s));
    return owner != null && owner !== s.id;
  };
  // Same demo-cover source as the Add-Images flow: prefer a real showcase edit,
  // then the style's own after/thumbnail images.
  const { coverFor } = useStyleCovers();
  // The photographer's own trained AI models, kept distinct from the public
  // Aura models so it's clear which engine edits their photos.
  const isMine = (s: LookStyle) => ownerId != null && s.user_id === ownerId && s.status === "ready";
  const mine = styles.filter(isMine);
  const aura = styles.filter((s) => !(ownerId != null && s.user_id === ownerId));

  return (
    // A flex column so the styles scroll on their own and the opt-out stays put.
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Styles — the ONLY region that scrolls. Bounded on small screens so a
          long model list can't stretch the whole panel; on desktop it fills the
          card and scrolls internally instead. */}
      <div className="max-h-[42vh] min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 lg:max-h-none">
        {mine.length > 0 && (
          <div className="space-y-2">
            <div className="aura-microlabel flex items-center gap-1.5 text-primary"><Sparkle size={10} /> Your AI models</div>
            <div className="grid grid-cols-3 gap-2">
              {mine.map((s) => (
                <LookTile key={s.id} style={s} cover={coverFor(s)} on={selectedIds.includes(s.id)} used={usedSet.has(s.id)} locked={atMax && !selectedIds.includes(s.id)} engineTaken={engineTaken(s)} mine recommended={s.id === bestId} onClick={() => onToggle(s.id)} />
              ))}
            </div>
          </div>
        )}

        {aura.length > 0 && (
          <div className="space-y-2">
            {mine.length > 0 && <div className="aura-microlabel flex items-center gap-1.5 text-accent"><Sparkle size={10} /> Aura looks</div>}
            <div className="grid grid-cols-3 gap-2">
              {aura.map((s) => (
                <LookTile key={s.id} style={s} cover={coverFor(s)} on={selectedIds.includes(s.id)} used={usedSet.has(s.id)} locked={atMax && !selectedIds.includes(s.id)} engineTaken={engineTaken(s)} recommended={s.id === bestId} onClick={() => onToggle(s.id)} />
              ))}
            </div>
          </div>
        )}

        {styles.length === 0 && (
          <p className="caption">No AI models available yet — host &amp; share as-is below, or train your own look later.</p>
        )}
      </div>

      {/* Opt-out — pinned OUTSIDE the scroll area so "No editing" is always in
          view without scrolling past every look. Dashed + separated so it never
          competes with the AI models. */}
      {onHosting && (
        <div className="shrink-0 pt-2.5">
          <div className="aura-hairline mb-2.5" />
          <button
            type="button"
            onClick={onHosting}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-[--radius] border border-dashed p-2 text-left transition-colors",
              hosting ? "border-primary bg-primary/10 ring-1 ring-inset ring-primary" : "border-border/70 hover:border-primary/40 hover:bg-surface-2/40",
            )}
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-surface-2 text-muted-foreground"><Ban className="h-4 w-4" strokeWidth={1.5} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">No editing</span>
              <span className="caption block">Host &amp; share as-is · 0 edits</span>
            </span>
            <SelectMark on={hosting} />
          </button>
        </div>
      )}
    </div>
  );
}

// One AI-model tile — a compact, visual card so many looks fit at a glance.
// The cover fills the tile with the name overlaid; no-cover models get a royal-
// blue aura tile with the sparkle so they still read as AI engines.
export function LookTile({ style: s, cover, on, locked, used = false, engineTaken = false, mine = false, recommended = false, onClick }: {
  style: LookStyle;
  cover?: string;
  on: boolean;
  locked: boolean;
  /** Already applied to the target images (re-edit) — locked, can't re-apply. */
  used?: boolean;
  /** A sibling look already claimed this look's editing engine — can't run
   *  two looks on the same engine in one collection. */
  engineTaken?: boolean;
  mine?: boolean;
  recommended?: boolean;
  onClick: () => void;
}) {
  const disabled = locked || engineTaken || used;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={used
        ? `${s.name} — already applied to these photos.`
        : engineTaken
          ? `${s.name} — uses the same AI engine as your selected look. Pick a different look, or attach a distinct trained model.`
          : s.name}
      className={cn(
        "group relative aspect-[4/3] cursor-pointer overflow-hidden rounded-[--radius] border text-left transition-all",
        on
          ? "border-primary ring-1 ring-inset ring-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.10)]"
          : "border-border hover:border-primary/50",
        disabled && "cursor-not-allowed opacity-45 hover:border-border",
      )}
    >
      {cover ? (
        <img src={getThumbnailUrl(cover)} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <span className="absolute inset-0 grid place-items-center bg-surface-2">
          <span className="absolute inset-0 bg-gradient-to-br from-primary/30 to-transparent" />
          <Sparkle size={18} className="relative text-primary" />
        </span>
      )}
      {/* Legibility gradient + name */}
      <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-1.5 pb-1.5 pt-5">
        <span className="flex items-center gap-1">
          <Sparkle size={8} className={mine ? "text-primary" : "text-accent"} />
          <span className="truncate text-[11px] font-semibold leading-tight text-white">{s.name}</span>
        </span>
      </span>
      {used ? (
        <span className="absolute right-1.5 top-1.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-muted/80 backdrop-blur-sm"><Lock className="h-3 w-3 text-muted-foreground" /></span>
      ) : (
        <span className="absolute right-1.5 top-1.5"><SelectMark on={on} /></span>
      )}
      {recommended && !on && !engineTaken && !used && (
        <span className="absolute left-1.5 top-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-primary-foreground shadow">Pick</span>
      )}
    </button>
  );
}

// Selection indicator for a look row — filled check when chosen, empty ring
// otherwise (signals each row is independently selectable).
export function SelectMark({ on }: { on: boolean }) {
  return on ? (
    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="h-3 w-3" strokeWidth={3} /></span>
  ) : (
    <span className="h-5 w-5 shrink-0 rounded-full border border-muted-foreground/40" aria-hidden />
  );
}
