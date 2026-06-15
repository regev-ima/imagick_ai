import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Campaign = {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  is_active: boolean;
  timezone: string;
  send_window_start: number;
  send_window_end: number;
};

type CampaignStep = {
  id: string;
  step_order: number;
  delay_hours: number;
  sender_profile: "sapir" | "contact";
  is_reply: boolean;
  subject: string;
};

function cumulativeDays(steps: CampaignStep[], stepOrder: number) {
  const currentIndex = steps.findIndex((s) => s.step_order === stepOrder);
  if (currentIndex < 0) return 0;
  const totalHours = steps.slice(0, currentIndex + 1).reduce((sum, step) => sum + (step.delay_hours || 0), 0);
  return Math.round((totalHours / 24) * 10) / 10;
}

export default function LeadCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [steps, setSteps] = useState<CampaignStep[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [saving, setSaving] = useState(false);
  const [leadPaused, setLeadPaused] = useState(false);
  const [savingPause, setSavingPause] = useState(false);

  const selectedCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === selectedCampaignId) || null,
    [campaigns, selectedCampaignId],
  );

  const [formState, setFormState] = useState({
    is_active: true,
    is_default: false,
    timezone: "Asia/Jerusalem",
    send_window_start: 9,
    send_window_end: 20,
  });

  const loadCampaigns = async () => {
    const db = supabase as any;
    const { data, error } = await db
      .from("lead_campaigns")
      .select("id, name, description, is_default, is_active, timezone, send_window_start, send_window_end")
      .order("created_at", { ascending: true });

    if (error) {
      toast.error(error.message || "Failed to load campaigns");
      return;
    }

    const list = (data || []) as Campaign[];
    const preferred = list.find((item) => item.is_default) || list[0] || null;
    const filtered = preferred ? [preferred] : [];
    setCampaigns(filtered);
    if (preferred && (!selectedCampaignId || selectedCampaignId !== preferred.id)) {
      setSelectedCampaignId(preferred.id);
    }
  };

  const loadPauseState = async () => {
    const db = supabase as any;
    const { data, error } = await db
      .from("platform_settings")
      .select("value")
      .eq("key", "lead_emails_paused")
      .maybeSingle();
    if (error) return;
    const raw = typeof data?.value === "string" ? data.value.trim().toLowerCase() : "";
    setLeadPaused(raw === "true" || raw === "1" || raw === "yes");
  };

  const updatePauseState = async (next: boolean) => {
    setSavingPause(true);
    try {
      const db = supabase as any;
      const { error } = await db
        .from("platform_settings")
        .upsert(
          { key: "lead_emails_paused", value: next ? "true" : "false", updated_at: new Date().toISOString() },
          { onConflict: "key" },
        );
      if (error) throw error;
      setLeadPaused(next);
      toast.success(next ? "Lead emails paused" : "Lead emails resumed");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update pause state");
    } finally {
      setSavingPause(false);
    }
  };

  const loadSteps = async (campaignId: string) => {
    const db = supabase as any;
    const { data, error } = await db
      .from("lead_campaign_steps")
      .select("id, step_order, delay_hours, sender_profile, is_reply, subject")
      .eq("campaign_id", campaignId)
      .order("step_order", { ascending: true });

    if (error) {
      toast.error(error.message || "Failed to load campaign steps");
      return;
    }

    setSteps((data || []) as CampaignStep[]);
  };

  useEffect(() => {
    loadCampaigns();
    loadPauseState();
  }, []);

  useEffect(() => {
    if (!selectedCampaignId) return;
    const campaign = campaigns.find((item) => item.id === selectedCampaignId);
    if (!campaign) return;

    setFormState({
      is_active: campaign.is_active,
      is_default: campaign.is_default,
      timezone: campaign.timezone,
      send_window_start: campaign.send_window_start,
      send_window_end: campaign.send_window_end,
    });
    loadSteps(selectedCampaignId);
  }, [selectedCampaignId, campaigns]);

  const saveCampaign = async () => {
    if (!selectedCampaign) return;

    if (formState.send_window_start < 0 || formState.send_window_start > 23) {
      toast.error("Send window start must be between 0 and 23");
      return;
    }
    if (formState.send_window_end < 1 || formState.send_window_end > 24) {
      toast.error("Send window end must be between 1 and 24");
      return;
    }
    if (formState.send_window_start >= formState.send_window_end) {
      toast.error("Send window start must be before send window end");
      return;
    }

    setSaving(true);
    try {
      const db = supabase as any;
      if (formState.is_default) {
        await db
          .from("lead_campaigns")
          .update({ is_default: false, updated_at: new Date().toISOString() })
          .neq("id", selectedCampaign.id)
          .eq("is_default", true);
      }

      const { error } = await db
        .from("lead_campaigns")
        .update({
          is_active: formState.is_active,
          is_default: formState.is_default,
          timezone: formState.timezone.trim() || "Asia/Jerusalem",
          send_window_start: formState.send_window_start,
          send_window_end: formState.send_window_end,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedCampaign.id);

      if (error) {
        throw error;
      }

      toast.success("Campaign settings saved");
      await loadCampaigns();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save campaign");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-full bg-background p-6 lg:p-8 space-y-6">
      <div>
        <span className="caption">Admin · Lead generation</span>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">Lead Campaigns</h1>
        <p className="mt-1 font-sans text-sm text-muted-foreground">
          Global default campaign configuration, send window, and 10-step sequence overview.
        </p>
      </div>

      <div className="glass-card overflow-hidden rounded-[--radius]">
        <div className="flex items-center justify-between gap-2 border-b border-border bg-background/40 px-4 py-2.5">
          <span className="aura-microlabel flex items-center gap-2">
            <CalendarClock className="h-3.5 w-3.5" />
            Campaign Settings
          </span>
          <span className="caption">Send window · local TZ</span>
        </div>
        <div className="space-y-4 p-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="aura-microlabel">Select campaign</Label>
              <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose campaign" />
                </SelectTrigger>
                <SelectContent>
                  {campaigns.map((campaign) => (
                    <SelectItem key={campaign.id} value={campaign.id}>
                      {campaign.name} {campaign.is_default ? "(Default)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="aura-microlabel">Timezone</Label>
              <Input
                value={formState.timezone}
                onChange={(e) => setFormState((prev) => ({ ...prev, timezone: e.target.value }))}
                placeholder="Asia/Jerusalem"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label className="aura-microlabel">Send window start (hour)</Label>
              <Input
                type="number"
                min={0}
                max={23}
                value={formState.send_window_start}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, send_window_start: Number(e.target.value || 0) }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label className="aura-microlabel">Send window end (hour)</Label>
              <Input
                type="number"
                min={1}
                max={24}
                value={formState.send_window_end}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, send_window_end: Number(e.target.value || 0) }))
                }
              />
            </div>
            <div className="flex items-end">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formState.is_active}
                  onCheckedChange={(checked) => setFormState((prev) => ({ ...prev, is_active: checked }))}
                />
                <Label>Active campaign</Label>
              </div>
            </div>
            <div className="flex items-end">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formState.is_default}
                  onCheckedChange={(checked) => setFormState((prev) => ({ ...prev, is_default: checked }))}
                />
                <Label>Set as default</Label>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-[--radius] border border-border bg-surface-2 p-3">
            <div className="space-y-1">
              <Label className="aura-microlabel">Pause lead emails</Label>
              <p className="text-xs text-muted-foreground">
                Stops the queue from sending new lead emails. Scheduled emails remain pending.
              </p>
            </div>
            <Switch checked={leadPaused} onCheckedChange={updatePauseState} disabled={savingPause} />
          </div>

          <div>
            <Button onClick={saveCampaign} disabled={!selectedCampaign || saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Campaign
            </Button>
          </div>
        </div>
      </div>

      <div className="glass-card overflow-hidden rounded-[--radius]">
        <div className="flex items-center justify-between gap-2 border-b border-border bg-background/40 px-4 py-2.5">
          <span className="aura-microlabel">Sequence Steps</span>
          <span className="caption">10-step sequence</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="caption">Step</TableHead>
              <TableHead className="caption">Delay (hours)</TableHead>
              <TableHead className="caption">Cum. Day</TableHead>
              <TableHead className="caption">Sender</TableHead>
              <TableHead className="caption">Style</TableHead>
              <TableHead className="caption">Subject</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {steps.map((step) => (
              <TableRow key={step.id}>
                <TableCell className="folio text-foreground">{step.step_order}</TableCell>
                <TableCell className="folio text-foreground">{step.delay_hours}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">Day {cumulativeDays(steps, step.step_order)}</TableCell>
                <TableCell>
                  <Badge variant={step.sender_profile === "sapir" ? "default" : "secondary"} className="font-mono">
                    {step.sender_profile === "sapir" ? "sapir@imagick.ai" : "contact@imagick.ai"}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{step.is_reply ? "RE:" : "Normal"}</TableCell>
                <TableCell className="max-w-[520px] truncate text-sm">{step.subject}</TableCell>
              </TableRow>
            ))}
            {steps.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No steps found for this campaign.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
