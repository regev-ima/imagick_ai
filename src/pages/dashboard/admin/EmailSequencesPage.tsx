import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MailOpen, ArrowLeft, Plus, Trash2, ChevronDown, ChevronUp, Save, RefreshCw,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SequenceStep {
  id?: string;
  step_order: number;
  delay_hours: number;
  subject: string;
  body_html: string;
  email_type: string;
}

interface EmailSequence {
  id: string;
  name: string;
  description: string | null;
  trigger_type: string;
  trigger_value: string;
  is_active: boolean;
  created_at: string;
  steps?: SequenceStep[];
}

const LIFECYCLE_STAGES = [
  "new", "onboarding", "exploring", "engaged", "converting", "paying", "at_risk", "churned",
];

// ─── Step card ────────────────────────────────────────────────────────────────

function StepCard({ step, index, onChange, onDelete }: { step: SequenceStep; index: number; onChange: (updated: SequenceStep) => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(index === 0);

  return (
    <div className="border border-border/60 rounded-xl overflow-hidden">
      <button type="button" onClick={() => setExpanded((e) => !e)} className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-xs">Step {step.step_order}</Badge>
          <span className="text-sm font-medium truncate max-w-[300px]">{step.subject || "No subject yet"}</span>
          <span className="text-xs text-muted-foreground">{step.delay_hours === 0 ? "Immediate" : `+${step.delay_hours}h`}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-destructive hover:text-destructive h-7 w-7 p-0">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>
      {expanded && (
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Delay (hours)</Label>
              <Input type="number" min={0} value={step.delay_hours} onChange={(e) => onChange({ ...step, delay_hours: Number(e.target.value) })} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Subject</Label>
              <Input value={step.subject} onChange={(e) => onChange({ ...step, subject: e.target.value })} placeholder="Your studio is waiting" className="h-8 text-sm" />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Body HTML</Label>
            <Textarea value={step.body_html} onChange={(e) => onChange({ ...step, body_html: e.target.value })} rows={6} className="text-sm font-mono" />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sequence editor ──────────────────────────────────────────────────────────

function SequenceEditor({ sequence, onSaved }: { sequence: EmailSequence | null; onSaved: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(sequence?.name ?? "");
  const [description, setDescription] = useState(sequence?.description ?? "");
  const [triggerType, setTriggerType] = useState(sequence?.trigger_type ?? "stage_enter");
  const [triggerValue, setTriggerValue] = useState(sequence?.trigger_value ?? "new");
  const [isActive, setIsActive] = useState(sequence?.is_active ?? false);
  const [steps, setSteps] = useState<SequenceStep[]>(sequence?.steps ?? []);

  const updateStep = (index: number, updated: SequenceStep) => setSteps((prev) => prev.map((s, i) => (i === index ? updated : s)));
  const deleteStep = (index: number) => setSteps((prev) => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, step_order: i + 1 })));
  const addStep = () => setSteps((prev) => [...prev, { step_order: prev.length + 1, delay_hours: prev.length === 0 ? 0 : 24, subject: "", body_html: "", email_type: "journey_email" }]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { name, description, trigger_type: triggerType, trigger_value: triggerValue, is_active: isActive, updated_at: new Date().toISOString() };
      let seqId: string;

      if (sequence?.id) {
        const { error } = await supabase.from("email_sequences" as any).update(payload as any).eq("id", sequence.id);
        if (error) throw error;
        seqId = sequence.id;
      } else {
        const { data, error } = await supabase.from("email_sequences" as any).insert(payload as any).select("id").single();
        if (error) throw error;
        seqId = (data as any).id;
      }

      // Delete + re-insert steps
      if (sequence?.id) {
        await supabase.from("email_sequence_steps" as any).delete().eq("sequence_id", seqId);
      }
      if (steps.length > 0) {
        const { error } = await supabase.from("email_sequence_steps" as any).insert(
          steps.map((s, i) => ({ sequence_id: seqId, step_order: i + 1, delay_hours: s.delay_hours, subject: s.subject, body_html: s.body_html, email_type: s.email_type })) as any
        );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Sequence saved");
      queryClient.invalidateQueries({ queryKey: ["email-sequences"] });
      onSaved();
    },
    onError: () => toast.error("Failed to save sequence"),
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><Label className="text-xs">Description</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Trigger type</Label>
          <Select value={triggerType} onValueChange={setTriggerType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="stage_enter">Stage Enter</SelectItem>
              <SelectItem value="days_since_signup">Days Since Signup</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">{triggerType === "stage_enter" ? "Stage" : "Days"}</Label>
          {triggerType === "stage_enter" ? (
            <Select value={triggerValue} onValueChange={setTriggerValue}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LIFECYCLE_STAGES.map((s) => (<SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1).replace("_", " ")}</SelectItem>))}
              </SelectContent>
            </Select>
          ) : (
            <Input type="number" min={1} value={triggerValue} onChange={(e) => setTriggerValue(e.target.value)} />
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-muted/20">
        <Switch id="seq-active" checked={isActive} onCheckedChange={setIsActive} />
        <Label htmlFor="seq-active" className="text-sm cursor-pointer">{isActive ? "Active" : "Inactive — draft mode"}</Label>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Steps ({steps.length})</h3>
          <Button type="button" variant="outline" size="sm" onClick={addStep} className="gap-1"><Plus className="w-3.5 h-3.5" />Add Step</Button>
        </div>
        <div className="space-y-2">
          {steps.map((step, i) => (<StepCard key={i} step={step} index={i} onChange={(u) => updateStep(i, u)} onDelete={() => deleteStep(i)} />))}
          {steps.length === 0 && <div className="text-center py-8 text-muted-foreground text-sm border border-dashed border-border/60 rounded-xl">No steps yet</div>}
        </div>
      </div>

      <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !name} className="w-full gap-2 bg-gradient-to-r from-primary to-secondary hover:opacity-90">
        {saveMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Save Sequence
      </Button>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function EmailSequencesPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | "new" | null>(null);

  const { data: sequences, isLoading } = useQuery({
    queryKey: ["email-sequences"],
    queryFn: async () => {
      try {
        const { data: seqs, error } = await supabase.from("email_sequences" as any).select("*").order("created_at", { ascending: false });
        if (error) return [] as EmailSequence[];

        const { data: allSteps } = await supabase.from("email_sequence_steps" as any).select("*").order("step_order", { ascending: true });

        return ((seqs ?? []) as unknown as EmailSequence[]).map((seq) => ({
          ...seq,
          steps: ((allSteps ?? []) as unknown as (SequenceStep & { sequence_id: string })[]).filter((s) => s.sequence_id === seq.id),
        }));
      } catch {
        return [] as EmailSequence[];
      }
    },
  });

  const deleteSequence = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("email_sequences" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sequence deleted");
      setSelectedId(null);
      queryClient.invalidateQueries({ queryKey: ["email-sequences"] });
    },
    onError: () => toast.error("Failed to delete"),
  });

  const selectedSequence = selectedId === "new" ? null : (sequences ?? []).find((s) => s.id === selectedId) ?? null;
  const showEditor = selectedId !== null;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm"><Link to="/dashboard/admin"><ArrowLeft className="w-4 h-4 mr-1" />Admin</Link></Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><MailOpen className="w-6 h-6 text-primary" />Email Sequences</h1>
          <p className="text-sm text-muted-foreground">Create and manage automated lifecycle email campaigns</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="glass-card border-border/50 lg:col-span-1">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Sequences</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setSelectedId("new")} className="gap-1 h-7"><Plus className="w-3.5 h-3.5" />New</Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-8"><RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="divide-y divide-border/50">
                {(sequences ?? []).map((seq) => (
                  <button key={seq.id} type="button" onClick={() => setSelectedId(seq.id)} className={cn("w-full text-left px-4 py-3 hover:bg-muted/30 transition-colors", selectedId === seq.id && "bg-primary/5 border-l-2 border-primary")}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium truncate">{seq.name}</span>
                      <Badge variant={seq.is_active ? "default" : "outline"} className="text-xs ml-2 shrink-0">{seq.is_active ? "Active" : "Draft"}</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{seq.trigger_type === "stage_enter" ? `On: ${seq.trigger_value}` : `Day ${seq.trigger_value}`}</span>
                      <span>·</span>
                      <span>{seq.steps?.length ?? 0} steps</span>
                    </div>
                  </button>
                ))}
                {(sequences ?? []).length === 0 && <div className="text-center py-8 text-sm text-muted-foreground">No sequences yet</div>}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card border-border/50 lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{selectedId === "new" ? "New Sequence" : selectedSequence ? selectedSequence.name : "Select a sequence"}</CardTitle>
              {selectedSequence && (
                <Button variant="ghost" size="sm" onClick={() => deleteSequence.mutate(selectedSequence.id)} className="text-destructive hover:text-destructive gap-1">
                  <Trash2 className="w-3.5 h-3.5" />Delete
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {showEditor ? (
              <SequenceEditor sequence={selectedSequence} onSaved={() => setSelectedId(null)} />
            ) : (
              <div className="text-center py-12 text-muted-foreground">Select a sequence or create a new one</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
