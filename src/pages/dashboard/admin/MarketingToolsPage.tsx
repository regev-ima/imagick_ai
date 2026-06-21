import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Save,
  Loader2,
  BarChart3,
  Megaphone,
  ShieldCheck,
  Code2,
  CheckCircle2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  fetchMarketingTags,
  activeTagLabels,
  defaultMarketingTags,
  MARKETING_TAGS_KEY,
  MARKETING_TAGS_QUERY_KEY,
  type MarketingTags,
} from "@/lib/marketingTags";
import { ServiceLogo } from "@/components/marketing/ServiceLogo";

type FieldDef = {
  key: keyof MarketingTags;
  label: string;
  placeholder: string;
  hint?: string;
};

const SECTIONS: { title: string; icon: typeof BarChart3; fields: FieldDef[] }[] = [
  {
    title: "Analytics & tag management",
    icon: BarChart3,
    fields: [
      { key: "gtmId", label: "Google Tag Manager", placeholder: "GTM-XXXXXXX", hint: "Container ID — loads all tags you configure inside GTM." },
      { key: "ga4Id", label: "Google Analytics 4", placeholder: "G-XXXXXXXXXX", hint: "GA4 Measurement ID." },
      { key: "clarityId", label: "Microsoft Clarity", placeholder: "abcdefghij", hint: "Project ID for heatmaps & session recordings." },
    ],
  },
  {
    title: "Advertising pixels (paid campaigns)",
    icon: Megaphone,
    fields: [
      { key: "metaPixelId", label: "Meta (Facebook) Pixel", placeholder: "1234567890" },
      { key: "googleAdsId", label: "Google Ads", placeholder: "AW-XXXXXXXXX", hint: "Conversion tracking tag." },
      { key: "tiktokPixelId", label: "TikTok Pixel", placeholder: "XXXXXXXXXXXXXXXXXXXX" },
      { key: "linkedinPartnerId", label: "LinkedIn Insight", placeholder: "1234567" },
      { key: "pinterestTagId", label: "Pinterest Tag", placeholder: "2612345678901" },
    ],
  },
  {
    title: "Search-engine verification",
    icon: ShieldCheck,
    fields: [
      { key: "googleSiteVerification", label: "Google Search Console", placeholder: "verification token", hint: "The content value of the google-site-verification meta tag." },
      { key: "bingSiteVerification", label: "Bing Webmaster Tools", placeholder: "verification token" },
    ],
  },
];

export default function MarketingToolsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<MarketingTags>(defaultMarketingTags);
  const [seeded, setSeeded] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: MARKETING_TAGS_QUERY_KEY,
    queryFn: fetchMarketingTags,
  });

  useEffect(() => {
    if (data && !seeded) {
      setForm(data);
      setSeeded(true);
    }
  }, [data, seeded]);

  const save = useMutation({
    mutationFn: async (payload: MarketingTags) => {
      // Trim string fields so stray spaces don't break tag IDs.
      const cleaned = Object.fromEntries(
        Object.entries(payload).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v]),
      ) as MarketingTags;
      const { error } = await supabase.from("public_site_settings").upsert(
        {
          key: MARKETING_TAGS_KEY,
          value: cleaned as unknown as Json,
          updated_at: new Date().toISOString(),
          updated_by: user?.id ?? null,
        },
        { onConflict: "key" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MARKETING_TAGS_QUERY_KEY });
      toast.success("Tracking settings saved — live across the site.");
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Failed to save";
      toast.error(
        /relation .* does not exist|public_site_settings/i.test(msg)
          ? "Settings table not deployed yet. Merge to main to run the migration, then try again."
          : msg,
      );
    },
  });

  const set = (key: keyof MarketingTags, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const active = activeTagLabels(form);

  return (
    <div className="min-h-full bg-background p-6 lg:p-8">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        {/* Header */}
        <div>
          <Link
            to="/dashboard/admin"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Admin
          </Link>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground">
            Tracking &amp; Tags
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect analytics, advertising pixels and verification — injected
            across the public marketing site. No redeploys, no code.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Master switch + status */}
            <div className="glass-card flex flex-col gap-4 rounded-[--radius] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">Tracking enabled</span>
                  {form.enabled && active.length > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-secondary/15 px-2 py-0.5 caption !text-secondary">
                      <CheckCircle2 className="h-3 w-3" /> {active.length} active
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Master switch. When off, no analytics or pixels load (verification
                  tags still apply).
                </p>
                {form.enabled && active.length > 0 && (
                  <p className="mt-2 caption !normal-case !tracking-normal text-muted-foreground">
                    Live: {active.join(" · ")}
                  </p>
                )}
              </div>
              <Switch
                checked={!!form.enabled}
                onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))}
                aria-label="Enable tracking"
              />
            </div>

            {/* Field sections */}
            {SECTIONS.map((section) => (
              <div key={section.title} className="glass-card overflow-hidden rounded-[--radius]">
                <div className="flex items-center gap-2 border-b border-border bg-background/40 px-4 py-2.5">
                  <section.icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="aura-microlabel">{section.title}</span>
                </div>
                <div className="grid gap-4 p-4 sm:grid-cols-2">
                  {section.fields.map((field) => (
                    <div key={String(field.key)} className="space-y-1.5">
                      <label htmlFor={String(field.key)} className="caption mb-1.5 flex items-center gap-2">
                        <ServiceLogo brand={String(field.key)} className="h-5 w-5 shrink-0" />
                        {field.label}
                      </label>
                      <Input
                        id={String(field.key)}
                        value={(form[field.key] as string) ?? ""}
                        onChange={(e) => set(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        spellCheck={false}
                        autoCapitalize="none"
                        className="font-mono text-sm"
                      />
                      {field.hint && (
                        <p className="text-xs leading-snug text-muted-foreground">{field.hint}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Advanced custom code */}
            <div className="glass-card overflow-hidden rounded-[--radius]">
              <div className="flex items-center gap-2 border-b border-border bg-background/40 px-4 py-2.5">
                <Code2 className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="aura-microlabel">Advanced — custom code</span>
              </div>
              <div className="space-y-4 p-4">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Paste any extra snippet (e.g. a tag not listed above). Injected
                  verbatim — admin-authored and trusted. Leave empty if unused.
                </p>
                <div className="space-y-1.5">
                  <label htmlFor="customHeadHtml" className="caption block">
                    Custom &lt;head&gt; code
                  </label>
                  <Textarea
                    id="customHeadHtml"
                    value={form.customHeadHtml ?? ""}
                    onChange={(e) => set("customHeadHtml", e.target.value)}
                    placeholder="<script>…</script>"
                    rows={4}
                    spellCheck={false}
                    className="font-mono text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="customBodyHtml" className="caption block">
                    Custom &lt;body&gt; code
                  </label>
                  <Textarea
                    id="customBodyHtml"
                    value={form.customBodyHtml ?? ""}
                    onChange={(e) => set("customBodyHtml", e.target.value)}
                    placeholder="<noscript>…</noscript>"
                    rows={3}
                    spellCheck={false}
                    className="font-mono text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Save */}
            <div className="sticky bottom-4 flex items-center justify-end gap-3 rounded-[--radius] border border-border bg-background/80 p-3 backdrop-blur">
              <span className="mr-auto text-xs text-muted-foreground">
                Changes apply to every visitor on the next page load.
              </span>
              <Button onClick={() => save.mutate(form)} disabled={save.isPending} className="gap-2">
                {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save changes
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
