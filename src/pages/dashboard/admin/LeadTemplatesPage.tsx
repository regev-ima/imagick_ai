import { useEffect, useState } from "react";
import { Mail, Eye, Send, Loader2, Beaker } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Campaign = {
  id: string;
  name: string;
  is_default: boolean;
};

type LeadStep = {
  id: string;
  step_order: number;
  sender_profile: "sapir" | "contact";
  is_reply: boolean;
  subject: string;
  ab_enabled: boolean;
  ab_split_percent: number;
  variant_b_subject: string | null;
  variant_b_body_html: string | null;
};

export default function LeadTemplatesPage() {
  const { user } = useAuth();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [steps, setSteps] = useState<LeadStep[]>([]);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [previewingStep, setPreviewingStep] = useState<number | null>(null);
  const [sendingStep, setSendingStep] = useState<number | null>(null);
  const [editingStep, setEditingStep] = useState<LeadStep | null>(null);
  const [abForm, setAbForm] = useState({
    ab_enabled: false,
    ab_split_percent: 50,
    variant_b_subject: "",
    variant_b_body_html: "",
  });
  const [savingAb, setSavingAb] = useState(false);

  const campaignId = campaign?.id ?? "";

  const loadCampaign = async () => {
    const db = supabase as any;
    const { data, error } = await db
      .from("lead_campaigns")
      .select("id, name, is_default")
      .order("created_at", { ascending: true });

    if (error) {
      toast.error(error.message || "Failed to load campaigns");
      return;
    }

    const list = (data || []) as Campaign[];
    const preferred = list.find((item) => item.is_default) || list[0] || null;
    setCampaign(preferred);
  };

  const loadSteps = async (campaignId: string) => {
    const db = supabase as any;
    const { data, error } = await db
      .from("lead_campaign_steps")
      .select(
        "id, step_order, sender_profile, is_reply, subject, ab_enabled, ab_split_percent, variant_b_subject, variant_b_body_html",
      )
      .eq("campaign_id", campaignId)
      .order("step_order", { ascending: true });

    if (error) {
      toast.error(error.message || "Failed to load templates");
      return;
    }
    setSteps((data || []) as LeadStep[]);
  };

  useEffect(() => {
    loadCampaign();
  }, []);

  useEffect(() => {
    if (!campaignId) return;
    loadSteps(campaignId);
  }, [campaignId]);

  useEffect(() => {
    if (user?.email && !recipientEmail) {
      setRecipientEmail(user.email);
    }
  }, [user?.email, recipientEmail]);

  const previewStep = async (stepOrder: number, variant: "A" | "B" = "A") => {
    if (!campaignId) {
      toast.error("No lead campaign available");
      return;
    }
    setPreviewingStep(stepOrder);
    try {
      const templateKey = `lead_campaign_step_${stepOrder}`;
      const { data, error } = await supabase.functions.invoke("send-test-email", {
        body: {
          templateKey,
          previewOnly: true,
          leadCampaignId: campaignId,
          variant,
        },
      });

      if (error) {
        throw new Error(error.message || "Failed to render preview");
      }

      const win = window.open("", "_blank");
      if (win) {
        win.document.write(data?.html || "<p>No preview available</p>");
        win.document.close();
      }
    } catch (err: any) {
      toast.error(err?.message || "Preview failed");
    } finally {
      setPreviewingStep(null);
    }
  };

  const sendTest = async (stepOrder: number, variant: "A" | "B" = "A") => {
    if (!recipientEmail) {
      toast.error("Recipient email is required");
      return;
    }
    if (!campaignId) {
      toast.error("No lead campaign available");
      return;
    }

    setSendingStep(stepOrder);
    try {
      const templateKey = `lead_campaign_step_${stepOrder}`;
      const { error } = await supabase.functions.invoke("send-test-email", {
        body: {
          templateKey,
          recipientEmail,
          leadCampaignId: campaignId,
          variant,
        },
      });

      if (error) {
        throw new Error(error.message || "Failed to send test");
      }
      toast.success(`Test email sent to ${recipientEmail}`);
    } catch (err: any) {
      toast.error(err?.message || "Send failed");
    } finally {
      setSendingStep(null);
    }
  };

  const openAbEditor = (step: LeadStep) => {
    setEditingStep(step);
    setAbForm({
      ab_enabled: !!step.ab_enabled,
      ab_split_percent: step.ab_split_percent ?? 50,
      variant_b_subject: step.variant_b_subject ?? "",
      variant_b_body_html: step.variant_b_body_html ?? "",
    });
  };

  const saveAbSettings = async () => {
    if (!editingStep) return;
    const split = Math.max(0, Math.min(100, Number(abForm.ab_split_percent || 0)));
    setSavingAb(true);
    try {
      const { error } = await supabase
        .from("lead_campaign_steps")
        .update({
          ab_enabled: !!abForm.ab_enabled,
          ab_split_percent: split,
          variant_b_subject: abForm.variant_b_subject || null,
          variant_b_body_html: abForm.variant_b_body_html || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingStep.id);
      if (error) throw error;
      toast.success("A/B settings saved");
      setEditingStep(null);
      if (campaignId) {
        await loadSteps(campaignId);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to save A/B settings");
    } finally {
      setSavingAb(false);
    }
  };

  return (
    <div className="min-h-full bg-background p-6 lg:p-8 space-y-6">
      <div>
        <span className="caption">Admin · Lead generation</span>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">Lead Templates</h1>
        <p className="mt-1 font-sans text-sm text-muted-foreground">
          Preview and test all 10 campaign emails with sender profiles and RE: behavior.
        </p>
      </div>

      <div className="glass-card overflow-hidden rounded-[--radius]">
        <div className="flex items-center justify-between gap-2 border-b border-border bg-background/40 px-4 py-2.5">
          <span className="aura-microlabel flex items-center gap-2">
            <Mail className="h-3.5 w-3.5" />
            Template Controls
          </span>
          <span className="caption">Test sends</span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
          <div className="space-y-2">
            <Label className="aura-microlabel">Campaign</Label>
            <Input value={campaign?.name || "Default Campaign"} readOnly />
          </div>
          <div className="space-y-2">
            <Label className="aura-microlabel">Test recipient</Label>
            <Input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="admin@imagick.ai"
            />
          </div>
        </div>
      </div>

      <div className="glass-card overflow-hidden rounded-[--radius]">
        <div className="flex items-center justify-between gap-2 border-b border-border bg-background/40 px-4 py-2.5">
          <span className="aura-microlabel">Campaign Steps</span>
          <span className="caption">Preview · send · A/B</span>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="caption">Step</TableHead>
                <TableHead className="caption">Sender</TableHead>
                <TableHead className="caption">Style</TableHead>
                <TableHead className="caption">A/B</TableHead>
                <TableHead className="caption">Subject</TableHead>
                <TableHead className="caption text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {steps.map((step) => (
                <TableRow key={step.id}>
                  <TableCell className="folio text-foreground">{step.step_order}</TableCell>
                  <TableCell>
                    <Badge variant={step.sender_profile === "sapir" ? "default" : "secondary"} className="font-mono">
                      {step.sender_profile === "sapir" ? "Sapir <sapir@imagick.ai>" : "Imagick <contact@imagick.ai>"}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{step.is_reply ? "RE:" : "Normal"}</TableCell>
                  <TableCell>
                    {step.ab_enabled ? (
                      <Badge variant="secondary" className="font-mono">On · {step.ab_split_percent ?? 50}% B</Badge>
                    ) : (
                      <Badge variant="outline" className="font-mono">Off</Badge>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[460px] truncate text-sm">{step.subject}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => previewStep(step.step_order, "A")}
                        disabled={previewingStep === step.step_order}
                      >
                        {previewingStep === step.step_order ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                        <span className="hidden sm:inline ml-1">Preview A</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => sendTest(step.step_order, "A")}
                        disabled={sendingStep === step.step_order}
                      >
                        {sendingStep === step.step_order ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                        <span className="hidden sm:inline ml-1">Send A</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => previewStep(step.step_order, "B")}
                        disabled={
                          previewingStep === step.step_order ||
                          !step.ab_enabled ||
                          !(step.variant_b_subject?.trim() || step.variant_b_body_html?.trim())
                        }
                      >
                        <Eye className="w-4 h-4" />
                        <span className="hidden sm:inline ml-1">Preview B</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => sendTest(step.step_order, "B")}
                        disabled={
                          sendingStep === step.step_order ||
                          !step.ab_enabled ||
                          !(step.variant_b_subject?.trim() || step.variant_b_body_html?.trim())
                        }
                      >
                        <Send className="w-4 h-4" />
                        <span className="hidden sm:inline ml-1">Send B</span>
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => openAbEditor(step)}>
                        <Beaker className="w-4 h-4" />
                        <span className="hidden sm:inline ml-1">A/B</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {steps.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No lead templates found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </div>
      </div>

      <Dialog open={!!editingStep} onOpenChange={(open) => !open && setEditingStep(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>A/B Settings — Step {editingStep?.step_order}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="aura-microlabel">Enable A/B testing</Label>
              <Switch
                checked={abForm.ab_enabled}
                onCheckedChange={(checked) => setAbForm((prev) => ({ ...prev, ab_enabled: checked }))}
              />
            </div>
            <div className="space-y-2">
              <Label className="aura-microlabel">Split percent for Variant B</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={abForm.ab_split_percent}
                onChange={(e) =>
                  setAbForm((prev) => ({ ...prev, ab_split_percent: Number(e.target.value || 0) }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label className="aura-microlabel">Variant B subject</Label>
              <Input
                value={abForm.variant_b_subject}
                onChange={(e) => setAbForm((prev) => ({ ...prev, variant_b_subject: e.target.value }))}
                placeholder="Variant B subject"
              />
            </div>
            <div className="space-y-2">
              <Label className="aura-microlabel">Variant B body (HTML)</Label>
              <Textarea
                rows={8}
                value={abForm.variant_b_body_html}
                onChange={(e) => setAbForm((prev) => ({ ...prev, variant_b_body_html: e.target.value }))}
                placeholder="<p>Your variant B HTML...</p>"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingStep(null)}>
                Cancel
              </Button>
              <Button onClick={saveAbSettings} disabled={savingAb}>
                {savingAb ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Save A/B
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
