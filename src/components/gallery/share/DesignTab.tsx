import { Check, Download, Droplets, Film, Moon, Square, Sun } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { TemplateMiniPreview } from "@/components/gallery/TemplateMiniPreview";

export const TEMPLATES = [
  { id: "elegant", name: "Elegant", description: "Refined masonry, tall hero" },
  { id: "modern", name: "Modern", description: "Clean minimal grid" },
  { id: "editorial", name: "Editorial", description: "Magazine drama" },
  { id: "classic", name: "Classic", description: "Hero cover, uniform grid" },
  { id: "filmstrip", name: "Filmstrip", description: "Horizontal scroll" },
  { id: "story", name: "Story", description: "Full-screen cinematic" },
] as const;

export const FONT_PAIRS = [
  {
    id: "playfair-inter",
    label: "Editorial",
    display: "Playfair Display",
    body: "Inter",
    sample: "Maya & Dani",
    fontFamily: "'Playfair Display', serif",
  },
  {
    id: "fraunces-geist",
    label: "Modern",
    display: "Fraunces",
    body: "Geist",
    sample: "Maya & Dani",
    fontFamily: "'Fraunces', serif",
  },
  {
    id: "cormorant-manrope",
    label: "Romantic",
    display: "Cormorant",
    body: "Manrope",
    sample: "Maya & Dani",
    fontFamily: "'Cormorant Garamond', serif",
  },
  {
    id: "bebas-spectral",
    label: "Bold",
    display: "Bebas Neue",
    body: "Spectral",
    sample: "MAYA & DANI",
    fontFamily: "'Bebas Neue', 'Impact', sans-serif",
    isUppercase: true,
  },
  {
    id: "tenor-inter",
    label: "Minimal",
    display: "Tenor Sans",
    body: "Inter",
    sample: "Maya & Dani",
    fontFamily: "'Tenor Sans', serif",
  },
] as const;

export type FontPairId = (typeof FONT_PAIRS)[number]["id"];
export type IntroMode = "none" | "cinema";

interface DesignTabProps {
  selectedTemplate: string;
  onTemplateChange: (id: string) => void;
  darkMode: boolean;
  onDarkModeChange: (v: boolean) => void;
  downloadEnabled: boolean;
  onDownloadEnabledChange: (v: boolean) => void;
  watermarkEnabled: boolean;
  onWatermarkEnabledChange: (v: boolean) => void;
  introMode: IntroMode;
  onIntroModeChange: (m: IntroMode) => void;
  fontPair: FontPairId;
  onFontPairChange: (f: FontPairId) => void;
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h3
        className="text-[18px] font-normal tracking-tight text-foreground"
        style={{ fontFamily: "'Playfair Display', serif" }}
      >
        {children}
      </h3>
      <div className="mt-2 h-px w-12 bg-[hsl(var(--neon-pink))]" />
    </div>
  );
}

export function DesignTab(props: DesignTabProps) {
  const {
    selectedTemplate, onTemplateChange,
    darkMode, onDarkModeChange,
    downloadEnabled, onDownloadEnabledChange,
    watermarkEnabled, onWatermarkEnabledChange,
    introMode, onIntroModeChange,
    fontPair, onFontPairChange,
  } = props;

  return (
    <div className="space-y-10">
      {/* Template grid */}
      <section>
        <SectionHeading>Gallery template</SectionHeading>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {TEMPLATES.map((t) => {
            const active = selectedTemplate === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onTemplateChange(t.id)}
                className={cn(
                  "group relative rounded-xl overflow-hidden border-2 transition-all p-0.5 text-left",
                  active
                    ? "border-[hsl(var(--neon-pink))] shadow-lg shadow-[hsl(var(--neon-pink)/0.25)]"
                    : "border-border/40 hover:border-[hsl(var(--neon-pink)/0.6)]",
                )}
              >
                <div className="aspect-[4/3] rounded-lg overflow-hidden relative">
                  <TemplateMiniPreview templateId={t.id} darkMode={darkMode} />
                  {active && (
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[hsl(var(--neon-pink))] flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>
                <div className="px-2 py-2">
                  <p className="text-sm font-medium leading-tight">{t.name}</p>
                  <p className="text-[11px] text-muted-foreground line-clamp-1">{t.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Intro mode toggle */}
      <section>
        <SectionHeading>First impression</SectionHeading>
        <div className="grid grid-cols-2 gap-3">
          {(["cinema", "none"] as IntroMode[]).map((m) => {
            const active = introMode === m;
            const isCinema = m === "cinema";
            return (
              <button
                key={m}
                type="button"
                onClick={() => onIntroModeChange(m)}
                className={cn(
                  "group relative rounded-xl overflow-hidden border-2 transition-all text-left",
                  active
                    ? "border-[hsl(var(--neon-pink))] shadow-lg shadow-[hsl(var(--neon-pink)/0.25)]"
                    : "border-border/40 hover:border-[hsl(var(--neon-pink)/0.6)]",
                )}
              >
                <div className="aspect-[2/1] relative overflow-hidden bg-zinc-950">
                  {isCinema ? (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-br from-zinc-700 via-zinc-900 to-black opacity-90" />
                      <div className="absolute inset-x-0 top-0 h-2 bg-black" />
                      <div className="absolute inset-x-0 bottom-0 h-2 bg-black" />
                      <Film className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-white/80" />
                      <div className="absolute bottom-3 left-3 text-[10px] tracking-[0.2em] uppercase text-white/60">
                        75s reel
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="absolute inset-0 grid grid-cols-3 gap-1 p-2">
                        {Array.from({ length: 9 }).map((_, i) => (
                          <div key={i} className="bg-zinc-700/70 rounded-sm" />
                        ))}
                      </div>
                      <Square className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 text-white/60" />
                    </>
                  )}
                </div>
                <div className="px-3 py-3">
                  <p className="text-sm font-medium leading-tight">
                    {isCinema ? "Cinema intro" : "Straight to grid"}
                  </p>
                  <p className="text-[11px] text-muted-foreground line-clamp-1">
                    {isCinema
                      ? "Auto-slideshow of hero shots, skippable"
                      : "Open straight into the gallery grid"}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Font pair selector */}
      <section>
        <SectionHeading>Typography</SectionHeading>
        <div className="space-y-2">
          {FONT_PAIRS.map((fp) => {
            const active = fontPair === fp.id;
            return (
              <button
                key={fp.id}
                type="button"
                onClick={() => onFontPairChange(fp.id)}
                className={cn(
                  "w-full flex items-center justify-between rounded-xl border transition-all px-4 py-4",
                  active
                    ? "border-[hsl(var(--neon-pink))] bg-[hsl(var(--neon-pink)/0.06)]"
                    : "border-border/40 hover:border-[hsl(var(--neon-pink)/0.5)] bg-muted/20",
                )}
              >
                <div className="flex items-baseline gap-4 min-w-0">
                  <span
                    className={cn(
                      "text-2xl truncate",
                      fp.isUppercase && "tracking-[0.15em]",
                    )}
                    style={{ fontFamily: fp.fontFamily }}
                  >
                    {fp.sample}
                  </span>
                  <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    {fp.label}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-[11px] text-right text-muted-foreground">
                    <div>{fp.display}</div>
                    <div>{fp.body}</div>
                  </div>
                  <div
                    className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                      active ? "border-[hsl(var(--neon-pink))] bg-[hsl(var(--neon-pink))]" : "border-border",
                    )}
                  >
                    {active && <Check className="w-3 h-3 text-white" />}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Display options */}
      <section>
        <SectionHeading>Display</SectionHeading>
        <div className="space-y-3">
          <ToggleRow
            icon={darkMode
              ? <Moon className="w-4 h-4 text-[hsl(var(--neon-purple))]" />
              : <Sun className="w-4 h-4 text-yellow-400" />}
            title="Dark mode"
            desc="Display gallery in dark theme"
            checked={darkMode}
            onChange={onDarkModeChange}
          />
          <ToggleRow
            icon={<Download className="w-4 h-4 text-muted-foreground" />}
            title="Allow downloads"
            desc="Let clients download images"
            checked={downloadEnabled}
            onChange={onDownloadEnabledChange}
          />
          <ToggleRow
            icon={<Droplets className="w-4 h-4 text-muted-foreground" />}
            title="Watermark images"
            desc="Add watermark to previews"
            checked={watermarkEnabled}
            onChange={onWatermarkEnabledChange}
          />
        </div>
      </section>
    </div>
  );
}

function ToggleRow({
  icon, title, desc, checked, onChange,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="glass-card rounded-xl p-4 flex items-center justify-between">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-lg bg-muted/40 flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground truncate">{desc}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

// (Unused but exposed for callers — saves an import roundtrip when adding labels)
export { Label as DesignLabel };
