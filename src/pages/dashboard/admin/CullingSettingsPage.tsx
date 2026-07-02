import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Save, Sparkles } from "lucide-react";

/**
 * Admin-only culling configuration: which OpenRouter vision model powers the
 * AI culling/tagging, and the EXIF time-gate for grouping. Photographers don't
 * choose these — they only pick faces/grouping in the run popup.
 * Stored in platform_settings under the key `culling_config`.
 */
interface CullingConfig { model: string; timeThreshold: number }
const DEFAULT_CONFIG: CullingConfig = { model: "openai/gpt-4o-mini", timeThreshold: 600 };
const AUTO_ID = "openrouter/auto";

export default function CullingSettingsPage() {
  const qc = useQueryClient();
  const [cfg, setCfg] = useState<CullingConfig>(DEFAULT_CONFIG);

  // Saved config.
  const saved = useQuery({
    queryKey: ["culling-config"],
    queryFn: async (): Promise<CullingConfig> => {
      const { data, error } = await supabase
        .from("platform_settings").select("value").eq("key", "culling_config").single();
      if (error && error.code !== "PGRST116") throw error;
      return data?.value ? { ...DEFAULT_CONFIG, ...JSON.parse(data.value) } : DEFAULT_CONFIG;
    },
  });
  useEffect(() => { if (saved.data) setCfg(saved.data); }, [saved.data]);

  // Full OpenRouter vision-model list (cheap→expensive), same source as the preview.
  const orModels = useQuery({
    queryKey: ["or-vision-models"],
    staleTime: 3_600_000,
    queryFn: async (): Promise<{ id: string; name: string; prompt: number; completion: number }[]> => {
      const r = await fetch(`${window.location.origin}/api/or-models`);
      if (!r.ok) throw new Error(String(r.status));
      const d = await r.json();
      return d?.models ?? [];
    },
  });
  const modelOptions = useMemo(() => {
    const live = orModels.data ?? [];
    const money = (p: number) => (p < 0 ? "?" : `$${(p * 1e6).toFixed(2)}`);
    return live.map((m) => ({ id: m.id, label: `${m.name} · in ${money(m.prompt)} · out ${money(m.completion)} /1M` }));
  }, [orModels.data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("platform_settings").upsert(
        { key: "culling_config", value: JSON.stringify(cfg), updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
      if (error) throw error;
    },
    onSuccess: () => { toast.success("הגדרות ה-culling נשמרו"); qc.invalidateQueries({ queryKey: ["culling-config"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const router = cfg.model === AUTO_ID ? "auto" : "specific";

  return (
    <div dir="rtl" className="mx-auto max-w-3xl space-y-5 p-6">
      <header className="flex items-center gap-2 text-primary">
        <Sparkles className="h-5 w-5" />
        <h1 className="text-xl font-semibold text-foreground">הגדרות AI Culling</h1>
      </header>
      <p className="text-sm text-muted-foreground">
        המודל ומרווח הזמן משמשים את כל ריצות ה-culling בפלטפורמה. הצלמים לא בוחרים אותם.
      </p>

      <div className="rounded-lg border border-primary/40 bg-primary/10 p-3 text-sm">
        <span className="text-muted-foreground">יעד השידור הנוכחי (LLM):</span>{" "}
        <b className="text-foreground">{router === "auto" ? "Auto Router" : cfg.model}</b>
        {" · "}<span className="text-muted-foreground">מרווח זמן:</span>{" "}
        <b className="text-foreground">{cfg.timeThreshold}ש׳</b>
      </div>

      <div className="space-y-4 rounded-lg border border-border bg-surface-2 p-4">
        <div className="flex gap-2 text-sm">
          {(["specific", "auto"] as const).map((r) => (
            <button key={r}
              onClick={() => setCfg((c) => ({ ...c, model: r === "auto" ? AUTO_ID : (saved.data?.model && saved.data.model !== AUTO_ID ? saved.data.model : DEFAULT_CONFIG.model) }))}
              className={`rounded-md border px-3 py-1.5 font-medium ${router === r ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
              {r === "specific" ? "מודל ספציפי" : "Auto Router"}
            </button>
          ))}
        </div>

        {router === "specific" && (
          <label className="block text-sm">
            <span className="text-muted-foreground">מודל ניתוח תמונות (OpenRouter){orModels.isLoading ? " — טוען…" : ""}</span>
            <select value={cfg.model} onChange={(e) => setCfg((c) => ({ ...c, model: e.target.value }))}
              className="mt-1 w-full max-w-full rounded-md border border-border bg-background px-2 py-2 text-sm text-foreground">
              {/* keep the saved value selectable even if the live list hasn't loaded */}
              {!modelOptions.some((m) => m.id === cfg.model) && <option value={cfg.model}>{cfg.model}</option>}
              {modelOptions.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </label>
        )}
        {router === "auto" && (
          <p className="text-sm text-muted-foreground">OpenRouter יבחר מודל אוטומטית לכל בקשה (נוח, פחות צפוי בעלות).</p>
        )}

        <label className="block text-sm">
          <span className="text-muted-foreground">מרווח זמן קיבוץ EXIF (שניות) — פער מקסימלי בין תמונות באותה קבוצה</span>
          <input type="number" min={0} step={30} value={cfg.timeThreshold}
            onChange={(e) => setCfg((c) => ({ ...c, timeThreshold: Math.max(0, Number(e.target.value)) }))}
            className="mt-1 w-40 rounded-md border border-border bg-background px-2 py-2 text-sm text-foreground" />
        </label>

        <button onClick={() => save.mutate()} disabled={save.isPending}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          שמור
        </button>
      </div>
    </div>
  );
}
