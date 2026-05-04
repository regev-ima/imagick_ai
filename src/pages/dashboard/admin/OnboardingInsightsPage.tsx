import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BarChart3, ArrowLeft, RefreshCw, Users, CheckCircle2, XCircle, Plus, Trash2, Settings2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { toast } from "sonner";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface OnboardingQuestion {
  id: string;
  question_key: string;
  title: string;
  subtitle: string | null;
  question_type: string;
  options: any[];
  sort_order: number;
  is_active: boolean;
  allow_multiple: boolean;
  max_selections: number | null;
  created_at: string;
}

interface OnboardingAnswer {
  id: string;
  question_id: string;
  user_id: string;
  answer: any;
  answered_at: string;
}

// ─── HBarChart ────────────────────────────────────────────────────────────────

function HBarChart({ data, total }: { data: { label: string; count: number }[]; total: number }) {
  const sorted = [...data].sort((a, b) => b.count - a.count);
  return (
    <div className="space-y-2">
      {sorted.map(({ label, count }) => {
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <div key={label} className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-28 shrink-0 truncate capitalize">{label.replace(/_/g, " ")}</span>
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6 }} className="h-full rounded-full bg-gradient-to-r from-primary to-secondary" />
            </div>
            <span className="text-xs text-muted-foreground w-12 text-right shrink-0">{count} ({pct}%)</span>
          </div>
        );
      })}
      {data.length === 0 && <p className="text-xs text-muted-foreground">No data yet</p>}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function OnboardingInsightsPage() {
  const queryClient = useQueryClient();

  const { data: questions, isLoading: qLoading } = useQuery({
    queryKey: ["admin-onboarding-questions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("onboarding_questions" as any).select("*").order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as OnboardingQuestion[];
    },
  });

  const { data: answers, isLoading: aLoading } = useQuery({
    queryKey: ["admin-onboarding-answers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("onboarding_answers" as any).select("*");
      if (error) throw error;
      return (data ?? []) as unknown as OnboardingAnswer[];
    },
  });

  const isLoading = qLoading || aLoading;
  const totalUsersAnswered = new Set((answers ?? []).map((a) => a.user_id)).size;

  // Per-question answer distribution
  const getDistribution = (questionId: string) => {
    const qAnswers = (answers ?? []).filter((a) => a.question_id === questionId);
    const counts: Record<string, number> = {};
    for (const a of qAnswers) {
      const vals = Array.isArray(a.answer) ? a.answer : [a.answer];
      for (const v of vals) {
        if (typeof v === "string") counts[v] = (counts[v] ?? 0) + 1;
      }
    }
    return Object.entries(counts).map(([label, count]) => ({ label, count }));
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/dashboard/admin"><ArrowLeft className="w-4 h-4 mr-1" />Admin</Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" />Onboarding Insights
          </h1>
          <p className="text-sm text-muted-foreground">Questionnaire responses and question management</p>
        </div>
      </div>

      <Tabs defaultValue="insights">
        <TabsList>
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="manage">Manage Questions</TabsTrigger>
        </TabsList>

        {/* ─── Insights Tab ─── */}
        <TabsContent value="insights" className="space-y-6 mt-4">
          {isLoading ? (
            <div className="flex justify-center py-16"><RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { label: "Users Answered", value: totalUsersAnswered, icon: Users, color: "text-primary", bg: "bg-primary/10" },
                  { label: "Total Answers", value: (answers ?? []).length, icon: CheckCircle2, color: "text-green-400", bg: "bg-green-500/10" },
                  { label: "Active Questions", value: (questions ?? []).filter((q) => q.is_active).length, icon: BarChart3, color: "text-secondary", bg: "bg-secondary/10" },
                ].map(({ label, value, icon: Icon, color, bg }, i) => (
                  <motion.div key={label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                    <Card className="glass-card border-border/50">
                      <CardContent className="pt-5">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">{label}</p>
                            <p className={`text-2xl font-bold ${color}`}>{value}</p>
                          </div>
                          <div className={`p-3 rounded-xl ${bg}`}><Icon className={`w-5 h-5 ${color}`} /></div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {(questions ?? []).filter((q) => q.is_active).map((q) => {
                  const qAnswerCount = (answers ?? []).filter((a) => a.question_id === q.id).length;
                  return (
                    <Card key={q.id} className="glass-card border-border/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">{q.title}</CardTitle>
                        <p className="text-xs text-muted-foreground">{qAnswerCount} responses · {q.question_type}</p>
                      </CardHeader>
                      <CardContent>
                        <HBarChart data={getDistribution(q.id)} total={qAnswerCount} />
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </TabsContent>

        {/* ─── Manage Questions Tab ─── */}
        <TabsContent value="manage" className="space-y-6 mt-4">
          <ManageQuestionsTab questions={questions ?? []} queryClient={queryClient} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Manage Questions Tab ─────────────────────────────────────────────────────

function ManageQuestionsTab({ questions, queryClient }: { questions: OnboardingQuestion[]; queryClient: any }) {
  const [showForm, setShowForm] = useState(false);
  const [newQ, setNewQ] = useState({ question_key: "", title: "", subtitle: "", question_type: "pill_select", options_text: "", sort_order: (questions.length + 1).toString(), allow_multiple: false, max_selections: "" });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("onboarding_questions" as any).update({ is_active } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-onboarding-questions"] });
      toast.success("Question updated");
    },
  });

  const deleteQuestion = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("onboarding_questions" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-onboarding-questions"] });
      toast.success("Question deleted");
    },
  });

  const addQuestion = useMutation({
    mutationFn: async () => {
      // Parse options: one per line, format "id:label" or just "label"
      const options = newQ.options_text.split("\n").filter(Boolean).map((line) => {
        const parts = line.split(":");
        if (parts.length >= 2) return { id: parts[0].trim(), label: parts.slice(1).join(":").trim() };
        return { id: line.trim().toLowerCase().replace(/\s+/g, "_"), label: line.trim() };
      });

      const { error } = await supabase.from("onboarding_questions" as any).insert({
        question_key: newQ.question_key,
        title: newQ.title,
        subtitle: newQ.subtitle || null,
        question_type: newQ.question_type,
        options,
        sort_order: parseInt(newQ.sort_order) || 0,
        allow_multiple: newQ.allow_multiple,
        max_selections: newQ.max_selections ? parseInt(newQ.max_selections) : null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-onboarding-questions"] });
      toast.success("Question added — it will appear to all users who haven't answered it");
      setShowForm(false);
      setNewQ({ question_key: "", title: "", subtitle: "", question_type: "pill_select", options_text: "", sort_order: (questions.length + 2).toString(), allow_multiple: false, max_selections: "" });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to add question"),
  });

  return (
    <>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Questions ({questions.length})</h3>
        <Button size="sm" variant="outline" onClick={() => setShowForm((v) => !v)} className="gap-1">
          <Plus className="w-3.5 h-3.5" />{showForm ? "Cancel" : "Add Question"}
        </Button>
      </div>

      {showForm && (
        <Card className="glass-card border-border/50">
          <CardContent className="pt-5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Key (unique)</Label>
                <Input value={newQ.question_key} onChange={(e) => setNewQ((p) => ({ ...p, question_key: e.target.value }))} placeholder="favorite_lens" />
              </div>
              <div>
                <Label className="text-xs">Title</Label>
                <Input value={newQ.title} onChange={(e) => setNewQ((p) => ({ ...p, title: e.target.value }))} placeholder="What's your favorite lens?" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Subtitle (optional)</Label>
              <Input value={newQ.subtitle} onChange={(e) => setNewQ((p) => ({ ...p, subtitle: e.target.value }))} placeholder="Select all that apply" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Type</Label>
                <Select value={newQ.question_type} onValueChange={(v) => setNewQ((p) => ({ ...p, question_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pill_select">Pill Select</SelectItem>
                    <SelectItem value="grid_select">Grid Select</SelectItem>
                    <SelectItem value="list_select">List Select</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Sort Order</Label>
                <Input type="number" value={newQ.sort_order} onChange={(e) => setNewQ((p) => ({ ...p, sort_order: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Max Selections</Label>
                <Input type="number" value={newQ.max_selections} onChange={(e) => setNewQ((p) => ({ ...p, max_selections: e.target.value }))} placeholder="Unlimited" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={newQ.allow_multiple} onCheckedChange={(v) => setNewQ((p) => ({ ...p, allow_multiple: v }))} />
              <Label className="text-xs">Allow multiple selections</Label>
            </div>
            <div>
              <Label className="text-xs">Options (one per line, format: id:label)</Label>
              <Textarea value={newQ.options_text} onChange={(e) => setNewQ((p) => ({ ...p, options_text: e.target.value }))} rows={4} placeholder={"35mm:35mm\n50mm:50mm\n85mm:85mm"} className="font-mono text-sm" />
            </div>
            <Button onClick={() => addQuestion.mutate()} disabled={!newQ.question_key || !newQ.title || addQuestion.isPending} className="w-full gap-2 bg-gradient-to-r from-primary to-secondary hover:opacity-90">
              {addQuestion.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add Question
            </Button>
          </CardContent>
        </Card>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Order</TableHead>
            <TableHead>Key</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Options</TableHead>
            <TableHead>Active</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {questions.map((q) => (
            <TableRow key={q.id}>
              <TableCell className="text-sm">{q.sort_order}</TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">{q.question_key}</TableCell>
              <TableCell className="text-sm font-medium">{q.title}</TableCell>
              <TableCell><Badge variant="outline" className="text-xs">{q.question_type}</Badge></TableCell>
              <TableCell className="text-sm">{(q.options ?? []).length}</TableCell>
              <TableCell>
                <Switch checked={q.is_active} onCheckedChange={(v) => toggleActive.mutate({ id: q.id, is_active: v })} />
              </TableCell>
              <TableCell>
                <Button variant="ghost" size="sm" onClick={() => deleteQuestion.mutate(q.id)} className="text-destructive hover:text-destructive h-7 w-7 p-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {questions.length === 0 && (
            <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No questions yet</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </>
  );
}
