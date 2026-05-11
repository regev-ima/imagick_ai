import { useRef, useState } from "react";
import { Bookmark, ImageIcon, Loader2, Save, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  useSavedBrandAssets, useSaveBrandPreset, type SavedBrandAsset,
} from "@/hooks/useGallerySettings";

const PRESET_SWATCHES = [
  { name: "Ink black", hex: "#0B0B0F" },
  { name: "Soft white", hex: "#F5F2EC" },
  { name: "Deep navy", hex: "#1A2A4A" },
  { name: "Terracotta", hex: "#C76A4A" },
  { name: "Sage", hex: "#9CA98F" },
  { name: "Dusty rose", hex: "#C9A0A8" },
];

interface BrandTabProps {
  userId: string | undefined;
  logoUrl: string | null;
  onLogoUrlChange: (url: string | null) => void;
  primaryColor: string | null;
  onPrimaryColorChange: (hex: string | null) => void;
  accentColor: string | null;
  onAccentColorChange: (hex: string | null) => void;
  /** Color the photographer used on a previous gallery — surfaced as a swatch. */
  previousPrimary: string | null;
  /** Currently selected font pair — saved with the preset. */
  fontPair: string | null;
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

export function BrandTab(props: BrandTabProps) {
  const {
    userId, logoUrl, onLogoUrlChange,
    primaryColor, onPrimaryColorChange,
    accentColor, onAccentColorChange,
    previousPrimary, fontPair,
  } = props;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const { data: savedBrands = [] } = useSavedBrandAssets(userId);
  const savePreset = useSaveBrandPreset(userId);

  const uploadLogo = useMutation({
    mutationFn: async (file: File) => {
      if (!userId) throw new Error("Not signed in");
      const ext = file.name.split(".").pop() || "png";
      const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      setUploadProgress(10);
      const { error } = await supabase.storage
        .from("brand-assets")
        .upload(path, file, { upsert: false, contentType: file.type });
      setUploadProgress(90);
      if (error) throw error;
      const { data: pub } = supabase.storage.from("brand-assets").getPublicUrl(path);
      setUploadProgress(100);
      return pub.publicUrl;
    },
    onSuccess: (url) => {
      onLogoUrlChange(url);
      toast.success("Logo uploaded");
      setTimeout(() => setUploadProgress(0), 600);
    },
    onError: (e: any) => {
      toast.error(e?.message || "Upload failed");
      setUploadProgress(0);
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Logo must be under 5 MB");
      return;
    }
    uploadLogo.mutate(file);
  };

  const applyPreset = (id: string) => {
    if (!id) return;
    const preset = savedBrands.find((b: SavedBrandAsset) => b.id === id);
    if (!preset) return;
    onLogoUrlChange(preset.logo_url);
    onPrimaryColorChange(preset.primary_color);
    onAccentColorChange(preset.accent_color);
    toast.success(`Loaded "${preset.name}"`);
  };

  const previousPrimarySwatch =
    previousPrimary && !PRESET_SWATCHES.some((s) => s.hex.toLowerCase() === previousPrimary.toLowerCase())
      ? { name: "Last used", hex: previousPrimary }
      : null;

  return (
    <div className="space-y-10">
      {/* Saved brand picker */}
      {savedBrands.length > 0 && (
        <section>
          <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-2 block">
            Load from saved brand
          </Label>
          <Select onValueChange={applyPreset}>
            <SelectTrigger className="glass-card border-border/40">
              <SelectValue placeholder="Pick a saved brand preset…" />
            </SelectTrigger>
            <SelectContent>
              {savedBrands.map((b: SavedBrandAsset) => (
                <SelectItem key={b.id} value={b.id}>
                  <span className="flex items-center gap-2">
                    <Bookmark className="w-3.5 h-3.5 text-[hsl(var(--neon-pink))]" />
                    {b.name}
                    {b.is_default && (
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">default</span>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </section>
      )}

      {/* Logo */}
      <section>
        <SectionHeading>Logo</SectionHeading>
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "w-28 h-28 rounded-2xl border-2 border-dashed flex items-center justify-center bg-muted/20 overflow-hidden shrink-0",
              logoUrl ? "border-border/40" : "border-[hsl(var(--neon-pink)/0.4)]",
            )}
          >
            {logoUrl ? (
              <img src={logoUrl} alt="Brand logo" className="w-full h-full object-contain p-2" />
            ) : (
              <ImageIcon className="w-8 h-8 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              className="hidden"
              onChange={handleFileSelect}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadLogo.isPending}
                className="gap-2"
              >
                {uploadLogo.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                {logoUrl ? "Replace logo" : "Upload logo"}
              </Button>
              {logoUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onLogoUrlChange(null)}
                  className="gap-2 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" /> Remove
                </Button>
              )}
            </div>
            {uploadProgress > 0 && uploadProgress < 100 && (
              <div className="h-1 w-full bg-muted/40 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[hsl(var(--neon-pink))] transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">
              PNG, JPG, SVG or WebP — under 5 MB. Shown top-left on the public gallery.
            </p>
          </div>
        </div>
      </section>

      {/* Primary color */}
      <section>
        <SectionHeading>Primary color</SectionHeading>
        <ColorRow
          value={primaryColor}
          onChange={onPrimaryColorChange}
          previousSwatch={previousPrimarySwatch}
        />
      </section>

      {/* Accent color */}
      <section>
        <SectionHeading>Accent color</SectionHeading>
        <ColorRow value={accentColor} onChange={onAccentColorChange} />
      </section>

      {/* Save preset */}
      <section className="flex items-center justify-between glass-card rounded-xl p-4">
        <div>
          <p className="text-sm font-medium">Save this as a default brand</p>
          <p className="text-[11px] text-muted-foreground">
            Reuse on future galleries without re-picking colors and logo.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          disabled={savePreset.isPending || !userId}
          onClick={() => savePreset.mutate({
            name: "Default brand",
            logo_url: logoUrl,
            primary_color: primaryColor,
            accent_color: accentColor,
            font_pair: fontPair,
          })}
        >
          {savePreset.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Save preset
        </Button>
      </section>
    </div>
  );
}

function ColorRow({
  value, onChange, previousSwatch,
}: {
  value: string | null;
  onChange: (hex: string | null) => void;
  previousSwatch?: { name: string; hex: string } | null;
}) {
  const swatches = previousSwatch ? [previousSwatch, ...PRESET_SWATCHES] : PRESET_SWATCHES;

  return (
    <div className="flex items-center gap-4 flex-wrap">
      <div className="flex items-center gap-3 glass-card rounded-xl p-3">
        <label className="relative w-12 h-12 rounded-lg overflow-hidden border border-border/40 cursor-pointer">
          <input
            type="color"
            value={value || "#FF1493"}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            className="absolute inset-0 opacity-0 cursor-pointer"
            aria-label="Pick a custom color"
          />
          <div
            className="absolute inset-0"
            style={{ backgroundColor: value || "#FF1493" }}
          />
        </label>
        <Input
          type="text"
          value={value || ""}
          placeholder="#FF1493"
          onChange={(e) => {
            const v = e.target.value;
            if (!v) return onChange(null);
            // Only accept hex-ish strings; ignore garbage.
            if (/^#?[0-9A-Fa-f]{0,6}$/.test(v)) onChange(v.startsWith("#") ? v.toUpperCase() : `#${v.toUpperCase()}`);
          }}
          className="w-32 font-mono text-sm"
        />
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {swatches.map((sw) => {
          const active = value?.toLowerCase() === sw.hex.toLowerCase();
          return (
            <button
              key={sw.hex}
              type="button"
              title={sw.name}
              onClick={() => onChange(sw.hex)}
              className={cn(
                "relative w-9 h-9 rounded-full border-2 transition-all hover:scale-110",
                active
                  ? "border-[hsl(var(--neon-pink))] ring-2 ring-[hsl(var(--neon-pink)/0.4)]"
                  : "border-border/40",
              )}
              style={{ backgroundColor: sw.hex }}
            >
              {active && (
                <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                  {sw.name}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
