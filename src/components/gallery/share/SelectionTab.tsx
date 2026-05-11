import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, CheckCircle2, Loader2, Sparkles, Target, Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

interface SelectionTabProps {
  galleryId: string;
  selectionModeEnabled: boolean;
  onSelectionModeChange: (v: boolean) => void;
  selectionTargetCount: number;
  onSelectionTargetCountChange: (n: number) => void;
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

export function SelectionTab(props: SelectionTabProps) {
  const {
    galleryId,
    selectionModeEnabled, onSelectionModeChange,
    selectionTargetCount, onSelectionTargetCountChange,
  } = props;

  const [suggestedCount, setSuggestedCount] = useState<number | null>(null);

  const suggest = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("gallery-suggest-selection", {
        body: { gallery_id: galleryId, target_count: selectionTargetCount },
      });
      if (error) throw error;
      return (data as { suggested?: number } | null)?.suggested ?? selectionTargetCount;
    },
    onSuccess: (n) => {
      setSuggestedCount(n);
      toast.success(`${n} photos pre-selected for your couple`);
    },
    onError: (e: any) => toast.error(e?.message || "AI selection could not run yet"),
  });

  return (
    <div className="space-y-10">
      {/* Headline / Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-[hsl(var(--neon-pink)/0.3)] bg-gradient-to-br from-[hsl(var(--neon-pink)/0.08)] via-transparent to-[hsl(var(--neon-purple)/0.08)] p-6">
        <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full bg-[hsl(var(--neon-pink)/0.15)] blur-3xl pointer-events-none" />
        <div className="relative flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-[hsl(var(--neon-pink)/0.15)] flex items-center justify-center shrink-0">
            <Wand2 className="w-6 h-6 text-[hsl(var(--neon-pink))]" />
          </div>
          <div className="flex-1">
            <h2
              className="text-2xl mb-1"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Album selection mode
            </h2>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Your couple won't scroll 800 photos. We pre-pick the best
              <span className="text-foreground"> {selectionTargetCount}</span> using AI ratings,
              face coverage, and scene diversity — they review and swap, not start from scratch.
            </p>
          </div>
        </div>
      </section>

      {/* Toggle */}
      <section className="glass-card rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-muted/40 flex items-center justify-center">
            <Target className="w-4 h-4 text-[hsl(var(--neon-purple))]" />
          </div>
          <div>
            <p className="text-sm font-medium">Enable album selection mode</p>
            <p className="text-[11px] text-muted-foreground">
              Shows clients a curated subset to approve, swap, or finalize.
            </p>
          </div>
        </div>
        <Switch checked={selectionModeEnabled} onCheckedChange={onSelectionModeChange} />
      </section>

      {/* Target count */}
      <section className={selectionModeEnabled ? "" : "opacity-50 pointer-events-none"}>
        <SectionHeading>Target photo count</SectionHeading>
        <div className="flex items-center gap-3">
          <Input
            type="number"
            min={10}
            max={500}
            value={selectionTargetCount}
            onChange={(e) => onSelectionTargetCountChange(Math.max(10, Math.min(500, Number(e.target.value) || 60)))}
            className="w-32 bg-muted/30 border-border/40 text-lg font-medium"
          />
          <div className="text-xs text-muted-foreground">
            Typical album: 40–80 photos.
          </div>
        </div>
      </section>

      {/* AI suggest */}
      <section className={selectionModeEnabled ? "" : "opacity-50 pointer-events-none"}>
        <SectionHeading>AI pre-selection</SectionHeading>
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[hsl(var(--neon-pink))] to-[hsl(var(--neon-purple))] flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">AI-suggest the best photos</p>
                <p className="text-[11px] text-muted-foreground">
                  Uses ratings, face coverage, and scene diversity to pick {selectionTargetCount}.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="glow"
              onClick={() => suggest.mutate()}
              disabled={suggest.isPending}
              className="gap-2"
            >
              {suggest.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              Run AI selection
            </Button>
          </div>

          {suggestedCount !== null && (
            <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <p className="text-sm">
                <span className="font-medium text-emerald-300">{suggestedCount} photos pre-selected</span>{" "}
                <span className="text-emerald-200/80">for your couple.</span>
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Link to dashboard selections page */}
      <section>
        <Link
          to={`/dashboard/galleries/${galleryId}/selections`}
          className="group flex items-center justify-between glass-card rounded-xl p-5 hover:border-[hsl(var(--neon-pink)/0.5)] transition-colors"
        >
          <div>
            <p className="text-sm font-medium">Review client selections</p>
            <p className="text-[11px] text-muted-foreground">
              See which photos each couple keeps, swaps, and notes.
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-[hsl(var(--neon-pink))] group-hover:translate-x-0.5 transition-all" />
        </Link>
      </section>
    </div>
  );
}
