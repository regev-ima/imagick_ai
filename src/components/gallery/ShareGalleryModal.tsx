import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3, Copy, ExternalLink, Eye, Lock, Palette,
  Send, Share2, Sparkles, Wand2, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useGalleryBrandData } from "@/hooks/useGallerySettings";

import { DesignTab, type FontPairId, type IntroMode } from "./share/DesignTab";
import { BrandTab } from "./share/BrandTab";
import { PrivacyTab } from "./share/PrivacyTab";
import { SelectionTab } from "./share/SelectionTab";
import { ShareTab } from "./share/ShareTab";
import { InsightsTab } from "./share/InsightsTab";

// The full Gallery shape passed in from GalleryEditorPage. Extra optional
// brand fields are read here in case the parent already has them; we still
// hydrate from the DB via useGalleryBrandData.
export interface ShareGalleryModalGallery {
  id: string;
  name: string;
  client_link: string | null;
  client_password: string | null;
  template?: string;
  client_dark_mode?: boolean;
  download_enabled?: boolean;
  watermark_enabled?: boolean;
  expiry_date?: string | null;
  hero_image_url?: string | null;
  // New share-gallery columns (may be absent on older rows):
  brand_logo_url?: string | null;
  brand_primary_color?: string | null;
  brand_accent_color?: string | null;
  brand_font_pair?: string | null;
  intro_mode?: IntroMode | null;
  selection_mode_enabled?: boolean | null;
  selection_target_count?: number | null;
  email_gate_enabled?: boolean | null;
}

export interface ShareGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  gallery: ShareGalleryModalGallery;
  onUpdate: () => void;
}

type TabKey = "design" | "brand" | "privacy" | "selection" | "share" | "insights";

const TABS: { key: TabKey; label: string; Icon: typeof Palette }[] = [
  { key: "design",    label: "Design",    Icon: Palette },
  { key: "brand",     label: "Brand",     Icon: Sparkles },
  { key: "privacy",   label: "Privacy",   Icon: Lock },
  { key: "selection", label: "Selection", Icon: Wand2 },
  { key: "share",     label: "Share",     Icon: Send },
  { key: "insights",  label: "Insights",  Icon: BarChart3 },
];

export function ShareGalleryModal({ isOpen, onClose, gallery, onUpdate }: ShareGalleryModalProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>("design");

  // Hydrate brand/privacy/selection fields straight from DB to avoid
  // stale-data drift if the parent's Gallery shape hasn't been re-queried yet.
  const brandQuery = useGalleryBrandData(gallery.id, isOpen);
  const dbBrand = brandQuery.data ?? {};

  // ── Local state mirrors the row; we save in bulk on "Save settings".
  const [selectedTemplate, setSelectedTemplate] = useState(gallery.template || "elegant");
  const [darkMode, setDarkMode] = useState(gallery.client_dark_mode ?? true);
  const [downloadEnabled, setDownloadEnabled] = useState(gallery.download_enabled ?? true);
  const [watermarkEnabled, setWatermarkEnabled] = useState(gallery.watermark_enabled ?? false);
  const [password, setPassword] = useState(gallery.client_password || "");
  const [emailGateEnabled, setEmailGateEnabled] = useState(gallery.email_gate_enabled ?? false);
  const [expiryDate, setExpiryDate] = useState<string | null>(gallery.expiry_date ?? null);

  const [introMode, setIntroMode] = useState<IntroMode>((gallery.intro_mode as IntroMode) ?? "cinema");
  const [fontPair, setFontPair] = useState<FontPairId>(
    (gallery.brand_font_pair as FontPairId) || "playfair-inter",
  );
  const [logoUrl, setLogoUrl] = useState<string | null>(gallery.brand_logo_url ?? null);
  const [primaryColor, setPrimaryColor] = useState<string | null>(gallery.brand_primary_color ?? null);
  const [accentColor, setAccentColor] = useState<string | null>(gallery.brand_accent_color ?? null);

  const [selectionModeEnabled, setSelectionModeEnabled] = useState(gallery.selection_mode_enabled ?? false);
  const [selectionTargetCount, setSelectionTargetCount] = useState(gallery.selection_target_count ?? 60);

  // Backfill from DB once it returns. Only overwrite local state if it still
  // matches the parent's initial value, so user edits in this session aren't
  // clobbered when the query settles.
  useEffect(() => {
    if (!brandQuery.isSuccess) return;
    if (dbBrand.brand_logo_url !== undefined && logoUrl === (gallery.brand_logo_url ?? null)) {
      setLogoUrl(dbBrand.brand_logo_url ?? null);
    }
    if (dbBrand.brand_primary_color !== undefined && primaryColor === (gallery.brand_primary_color ?? null)) {
      setPrimaryColor(dbBrand.brand_primary_color ?? null);
    }
    if (dbBrand.brand_accent_color !== undefined && accentColor === (gallery.brand_accent_color ?? null)) {
      setAccentColor(dbBrand.brand_accent_color ?? null);
    }
    if (dbBrand.brand_font_pair && fontPair === ((gallery.brand_font_pair as FontPairId) || "playfair-inter")) {
      setFontPair(dbBrand.brand_font_pair as FontPairId);
    }
    if (dbBrand.intro_mode && introMode === ((gallery.intro_mode as IntroMode) ?? "cinema")) {
      setIntroMode(dbBrand.intro_mode);
    }
    if (typeof dbBrand.selection_mode_enabled === "boolean" && selectionModeEnabled === (gallery.selection_mode_enabled ?? false)) {
      setSelectionModeEnabled(dbBrand.selection_mode_enabled);
    }
    if (typeof dbBrand.selection_target_count === "number" && selectionTargetCount === (gallery.selection_target_count ?? 60)) {
      setSelectionTargetCount(dbBrand.selection_target_count);
    }
    if (typeof dbBrand.email_gate_enabled === "boolean" && emailGateEnabled === (gallery.email_gate_enabled ?? false)) {
      setEmailGateEnabled(dbBrand.email_gate_enabled);
    }
    if (dbBrand.expiry_date !== undefined && expiryDate === (gallery.expiry_date ?? null)) {
      setExpiryDate(dbBrand.expiry_date ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandQuery.isSuccess]);

  // Prevent accidental backdrop-close immediately after open.
  const [canClose, setCanClose] = useState(false);
  useEffect(() => {
    if (isOpen) {
      setCanClose(false);
      const t = setTimeout(() => setCanClose(true), 300);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // ── Save everything in one mutation.
  const updateSettings = useMutation({
    mutationFn: async () => {
      // Cast through `any` because the new columns are not yet in the
      // auto-generated Database types (see types.ts — auto-regenerated).
      const patch: Record<string, unknown> = {
        template: selectedTemplate,
        client_dark_mode: darkMode,
        download_enabled: downloadEnabled,
        watermark_enabled: watermarkEnabled,
        brand_logo_url: logoUrl,
        brand_primary_color: primaryColor,
        brand_accent_color: accentColor,
        brand_font_pair: fontPair,
        intro_mode: introMode,
        email_gate_enabled: emailGateEnabled,
        expiry_date: expiryDate,
        selection_mode_enabled: selectionModeEnabled,
        selection_target_count: selectionTargetCount,
      };

      const { error } = await (supabase.from("galleries") as any)
        .update(patch)
        .eq("id", gallery.id);
      if (error) throw error;

      // Password is handled through the dedicated edge function (hashing).
      const passwordChanged = password !== (gallery.client_password || "");
      if (passwordChanged) {
        const response = await supabase.functions.invoke("update-gallery-password", {
          body: { galleryId: gallery.id, password: password || null },
        });
        if (response.error) throw response.error;
      }
    },
    onSuccess: () => {
      onUpdate();
      queryClient.invalidateQueries({ queryKey: ["gallery-brand", gallery.id] });
      toast.success("Settings saved");
    },
    onError: (e: any) => toast.error(e?.message || "Could not save settings"),
  });

  // ── Derived links
  const galleryLink = `${window.location.origin}/gallery/${gallery.client_link || gallery.id}`;
  const shortId = gallery.client_link?.split("-").pop() || gallery.id.substring(0, 8);
  const shortLink = `${window.location.origin}/g/${shortId}`;

  const copyDirect = () => {
    navigator.clipboard.writeText(galleryLink);
    toast.success("Link copied");
  };
  const copyShort = () => {
    navigator.clipboard.writeText(shortLink);
    toast.success("Link copied");
  };

  // Surface the photographer's last-used color as a swatch in Brand tab.
  const previousPrimary = useMemo(
    () => dbBrand.brand_primary_color ?? gallery.brand_primary_color ?? null,
    [dbBrand.brand_primary_color, gallery.brand_primary_color],
  );

  if (!isOpen) return null;

  const handleBackdropClick = () => {
    if (canClose) onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-md flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 8 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0, y: 8 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-4xl max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <Card className="glass-card border-border/50 flex flex-col max-h-[92vh] overflow-hidden">
          {/* ── HEADER ───────────────────────────────────────────────── */}
          <div className="p-6 border-b border-border/40 space-y-4">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Share2 className="w-4 h-4 text-[hsl(var(--neon-pink))]" />
                  <span className="text-[10px] uppercase tracking-[0.22em] text-[hsl(var(--neon-pink))]">
                    Share gallery
                  </span>
                </div>
                <h2
                  className="text-3xl truncate"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  {gallery.name}
                </h2>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <LinkRow label="Direct link" value={galleryLink} onCopy={copyDirect} href={galleryLink} />
              <LinkRow label="Short link" value={shortLink} onCopy={copyShort} />
            </div>
          </div>

          {/* ── TABS ─────────────────────────────────────────────────── */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as TabKey)}
              className="flex-1 flex flex-col overflow-hidden"
            >
              {/* Pill triggers */}
              <div className="px-6 pt-4">
                <TabsList className="bg-muted/30 p-1 rounded-full inline-flex gap-1 h-auto">
                  {TABS.map(({ key, label, Icon }) => (
                    <TabsTrigger
                      key={key}
                      value={key}
                      className={cn(
                        "relative gap-2 rounded-full px-4 py-1.5 text-xs uppercase tracking-[0.14em] data-[state=active]:bg-transparent data-[state=active]:text-foreground text-muted-foreground transition-colors",
                      )}
                    >
                      {activeTab === key && (
                        <motion.span
                          layoutId="active-share-tab"
                          className="absolute inset-0 rounded-full bg-gradient-to-r from-[hsl(var(--neon-pink))] to-[hsl(var(--neon-purple))] shadow-lg shadow-[hsl(var(--neon-pink)/0.3)]"
                          transition={{ type: "spring", stiffness: 380, damping: 30 }}
                        />
                      )}
                      <span className={cn(
                        "relative flex items-center gap-1.5",
                        activeTab === key && "text-white",
                      )}>
                        <Icon className="w-3.5 h-3.5" />
                        {label}
                      </span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              <div className="flex-1 overflow-y-auto">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                  >
                    <TabsContent value="design" className="p-6">
                      <DesignTab
                        selectedTemplate={selectedTemplate}
                        onTemplateChange={setSelectedTemplate}
                        darkMode={darkMode}
                        onDarkModeChange={setDarkMode}
                        downloadEnabled={downloadEnabled}
                        onDownloadEnabledChange={setDownloadEnabled}
                        watermarkEnabled={watermarkEnabled}
                        onWatermarkEnabledChange={setWatermarkEnabled}
                        introMode={introMode}
                        onIntroModeChange={setIntroMode}
                        fontPair={fontPair}
                        onFontPairChange={setFontPair}
                      />
                    </TabsContent>

                    <TabsContent value="brand" className="p-6">
                      <BrandTab
                        userId={user?.id}
                        logoUrl={logoUrl}
                        onLogoUrlChange={setLogoUrl}
                        primaryColor={primaryColor}
                        onPrimaryColorChange={setPrimaryColor}
                        accentColor={accentColor}
                        onAccentColorChange={setAccentColor}
                        previousPrimary={previousPrimary}
                        fontPair={fontPair}
                      />
                    </TabsContent>

                    <TabsContent value="privacy" className="p-6">
                      <PrivacyTab
                        galleryId={gallery.id}
                        password={password}
                        onPasswordChange={setPassword}
                        emailGateEnabled={emailGateEnabled}
                        onEmailGateChange={setEmailGateEnabled}
                        expiryDate={expiryDate}
                        onExpiryDateChange={setExpiryDate}
                        onRevoked={() => {
                          onUpdate();
                          queryClient.invalidateQueries({ queryKey: ["gallery-brand", gallery.id] });
                        }}
                      />
                    </TabsContent>

                    <TabsContent value="selection" className="p-6">
                      <SelectionTab
                        galleryId={gallery.id}
                        selectionModeEnabled={selectionModeEnabled}
                        onSelectionModeChange={setSelectionModeEnabled}
                        selectionTargetCount={selectionTargetCount}
                        onSelectionTargetCountChange={setSelectionTargetCount}
                      />
                    </TabsContent>

                    <TabsContent value="share" className="p-6">
                      <ShareTab
                        galleryId={gallery.id}
                        galleryName={gallery.name}
                        shortLink={shortLink}
                        password={password}
                        selectedTemplate={selectedTemplate}
                        darkMode={darkMode}
                      />
                    </TabsContent>

                    <TabsContent value="insights" className="p-6">
                      <InsightsTab galleryId={gallery.id} />
                    </TabsContent>
                  </motion.div>
                </AnimatePresence>
              </div>
            </Tabs>
          </div>

          {/* ── FOOTER ───────────────────────────────────────────────── */}
          <div className="p-5 border-t border-border/40 flex items-center justify-between gap-3 bg-muted/10">
            <p className="text-[11px] text-muted-foreground hidden sm:block">
              Changes apply to this gallery on save.
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="glow"
                onClick={() => updateSettings.mutate()}
                disabled={updateSettings.isPending}
              >
                {updateSettings.isPending && (
                  <Sparkles className="w-4 h-4 animate-spin mr-2" />
                )}
                Save settings
              </Button>
            </div>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}

function LinkRow({
  label, value, onCopy, href,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  href?: string;
}) {
  return (
    <div>
      <Label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1.5 block">
        {label}
      </Label>
      <div className="flex items-center gap-2">
        <div className="flex-1 px-3 py-2 rounded-lg bg-muted/40 border border-border/40 text-xs font-mono truncate">
          {value}
        </div>
        <Button variant="outline" size="icon" onClick={onCopy} aria-label={`Copy ${label}`}>
          <Copy className="w-4 h-4" />
        </Button>
        {href && (
          <Button variant="outline" size="icon" asChild aria-label={`Open ${label}`}>
            <a href={href} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4" />
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}
