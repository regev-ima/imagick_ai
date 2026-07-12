import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CreditCard,
  Plus,
  ArrowLeft,
  DollarSign,
  MoreHorizontal,
  Pencil,
  Trash2,
  EyeOff,
  Eye,
  Check,
  TriangleAlert,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SubscriptionPlan } from "@/hooks/useSubscription";
import { cn } from "@/lib/utils";

// The pricing model is IMMUTABLE VERSIONS: a published plan's terms are frozen
// once anyone can subscribe. "Editing" a published plan really means: create
// version N+1 with the new terms, retire the old version (hidden from the
// pricing page + its PayPal billing plan deactivated so nobody NEW can use it),
// while every existing subscriber keeps billing on the exact terms they signed
// up for. Each version row therefore tracks its own subscriber count — how
// many people are on each price point. All of that is enforced server-side by
// the paypal-plan-version edge function; this page is the confirmation UI.

type PlanRow = SubscriptionPlan & {
  version?: number;
  family_slug?: string | null;
  is_published?: boolean;
  created_at?: string;
};

const BLANK_PLAN = {
  name: "", slug: "", price_monthly: 0, price_yearly: 0, edits_included: 0,
  price_per_extra_edit: 0, max_styles: 0, max_storage_gb: 5,
  has_ai_culling: true, has_team_access: false, has_api_access: false,
  has_priority_support: false, has_full_style_library: false,
} as unknown as PlanRow;

export default function PlansManagement() {
  const [editingPlan, setEditingPlan] = useState<PlanRow | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  // The plan a "replace" edit started from (null while creating).
  const [replaceSource, setReplaceSource] = useState<PlanRow | null>(null);
  // Pending confirmations — every mutating action goes through one.
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: "retire" | "publish"; plan: PlanRow } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PlanRow | null>(null);
  const queryClient = useQueryClient();

  const { data: plans, isLoading } = useQuery({
    queryKey: ["admin-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data as unknown as PlanRow[];
    },
  });

  // Subscribers per plan VERSION — how many people are on each price point.
  const { data: subscriberCounts = {} } = useQuery({
    queryKey: ["admin-plan-subscriber-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_subscriptions")
        .select("plan_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of (data ?? []) as { plan_id: string | null }[]) {
        if (row.plan_id) counts[row.plan_id] = (counts[row.plan_id] || 0) + 1;
      }
      return counts;
    },
  });

  // Which versions have PayPal billing plans (any mode) — the "synced" column.
  const { data: paypalMapped = new Set<string>() } = useQuery({
    queryKey: ["admin-paypal-mappings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("paypal_plan_mapping")
        .select("plan_id");
      return new Set(((data ?? []) as { plan_id: string }[]).map((r) => r.plan_id));
    },
  });

  // Credit "menu prices" — global action pricing, tunable without a deploy.
  const { data: creditPricingRaw } = useQuery({
    queryKey: ["admin-credit-pricing"],
    queryFn: async () => {
      const { data } = await supabase
        .from("platform_settings").select("value").eq("key", "credit_pricing").maybeSingle();
      try { return data?.value ? JSON.parse(data.value) : null; } catch { return null; }
    },
  });
  const [pricingDraft, setPricingDraft] = useState<Record<string, number> | null>(null);
  const pricing = pricingDraft ?? {
    ai_edit: creditPricingRaw?.ai_edit ?? 1,
    ai_culling: creditPricingRaw?.ai_culling ?? 0.2,
    face_recognition: creditPricingRaw?.face_recognition ?? 0.1,
    style_training: creditPricingRaw?.style_training ?? 1000,
  };
  const savePricingMutation = useMutation({
    mutationFn: async (next: Record<string, number>) => {
      const { error } = await supabase.from("platform_settings").upsert(
        { key: "credit_pricing", value: JSON.stringify(next), updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-credit-pricing"] });
      queryClient.invalidateQueries({ queryKey: ["credit-pricing"] });
      setPricingDraft(null);
      toast.success("Credit pricing updated — applies to all new runs");
    },
    onError: (e) => { console.error(e); toast.error("Failed to save credit pricing"); },
  });

  const invalidatePlans = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-plans"] });
    queryClient.invalidateQueries({ queryKey: ["admin-plan-subscriber-counts"] });
    queryClient.invalidateQueries({ queryKey: ["admin-paypal-mappings"] });
    queryClient.invalidateQueries({ queryKey: ["subscription-plans"] });
  };

  // Create/refresh the PayPal billing plans for every published paid plan.
  // Idempotent — only missing plans are created, existing ones untouched.
  const syncPayPalMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("paypal-setup-plans");
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidatePlans();
      toast.success("PayPal plans synced — published paid plans are purchasable.");
    },
    onError: (error: unknown) => {
      console.error("PayPal sync failed:", error);
      toast.error("PayPal sync failed. Check PayPal mode & credentials.");
    },
  });

  // replace / retire / publish — the server enforces the versioning invariants
  // and flips the matching PayPal billing plans.
  const versionMutation = useMutation({
    mutationFn: async (args: { action: "replace" | "retire" | "publish"; planId: string; updates?: Partial<PlanRow> }) => {
      const { data, error } = await supabase.functions.invoke("paypal-plan-version", { body: args });
      if (error) {
        // supabase.functions.invoke wraps non-2xx — try to surface the server message.
        const ctx = (error as { context?: unknown }).context;
        if (ctx instanceof Response) {
          const body = await ctx.clone().json().catch(() => null);
          if (body?.error) throw new Error(body.error);
        }
        throw error;
      }
      return data as { needsSync?: boolean; newVersion?: number };
    },
    onSuccess: async (data, args) => {
      invalidatePlans();
      if (args.action === "replace") {
        toast.success(`New version v${data?.newVersion ?? ""} is live — the old version keeps billing its subscribers.`);
      } else if (args.action === "retire") {
        toast.success("Version retired — hidden from pricing and closed to new PayPal subscriptions.");
      } else {
        toast.success("Version published.");
      }
      // A new/republished paid version needs PayPal billing plans — run the
      // idempotent sync right away so it's immediately purchasable.
      if (data?.needsSync) {
        toast.info("Creating PayPal billing plans for the new version…");
        syncPayPalMutation.mutate();
      }
    },
    onError: (e: Error) => {
      console.error(e);
      toast.error(e.message || "Action failed");
    },
  });

  const createPlanMutation = useMutation({
    mutationFn: async (plan: PlanRow) => {
      const { name, slug, ...rest } = plan as Record<string, unknown> & { name: string; slug: string };
      delete (rest as Record<string, unknown>).id;
      const { error } = await supabase.from("subscription_plans").insert({
        name, slug, ...rest,
        family_slug: slug,
        version: 1,
        is_published: true,
        is_active: true,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidatePlans();
      toast.success("Plan created. Run “Sync to PayPal” before anyone can subscribe to a paid plan.");
      setIsDialogOpen(false);
      setEditingPlan(null);
      setIsCreating(false);
    },
    onError: (error: Error) => {
      console.error("Error creating plan:", error);
      toast.error(error?.message?.includes("duplicate") ? "That slug is already taken." : "Failed to create plan");
    },
  });

  // Delete — only offered for versions with 0 subscribers; the DB trigger
  // blocks the rest regardless.
  const deletePlanMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("subscription_plans").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidatePlans();
      toast.success("Plan deleted");
      setDeleteTarget(null);
    },
    onError: (error: Error) => {
      console.error("Error deleting plan:", error);
      const msg = String(error?.message || "");
      toast.error(msg.includes("cannot be deleted")
        ? "This plan has subscribers — retire it instead of deleting."
        : "Failed to delete plan");
      setDeleteTarget(null);
    },
  });

  // ── Table data: group versions per family, published first, then v desc ──
  const rows = useMemo(() => {
    const list = [...(plans ?? [])];
    const familyOf = (p: PlanRow) => p.family_slug || p.slug;
    const familyOrder = new Map<string, number>();
    for (const p of list) {
      const f = familyOf(p);
      const so = (p as { sort_order?: number }).sort_order ?? 999;
      familyOrder.set(f, Math.min(familyOrder.get(f) ?? 999, so));
    }
    return list.sort((a, b) => {
      const fa = familyOf(a), fb = familyOf(b);
      if (fa !== fb) {
        const oa = familyOrder.get(fa) ?? 999, ob = familyOrder.get(fb) ?? 999;
        return oa !== ob ? oa - ob : fa.localeCompare(fb);
      }
      // Within a family: published version first, then newest version.
      const pa = a.is_published !== false ? 0 : 1;
      const pb = b.is_published !== false ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return (b.version ?? 1) - (a.version ?? 1);
    });
  }, [plans]);

  const openCreate = () => {
    setEditingPlan({ ...BLANK_PLAN });
    setReplaceSource(null);
    setIsCreating(true);
    setIsDialogOpen(true);
  };

  const openEditAsNewVersion = (plan: PlanRow) => {
    setEditingPlan({ ...plan });
    setReplaceSource(plan);
    setIsCreating(false);
    setIsDialogOpen(true);
  };

  const handleSavePlan = () => {
    if (!editingPlan) return;
    if (isCreating) {
      if (!editingPlan.name?.trim() || !editingPlan.slug?.trim()) {
        toast.error("Name and slug are required");
        return;
      }
      createPlanMutation.mutate(editingPlan);
    } else {
      // Editing an existing plan NEVER saves in place — it opens the
      // create-new-version confirmation.
      setConfirmReplace(true);
    }
  };

  const runReplace = () => {
    if (!editingPlan || !replaceSource) return;
    const updates: Record<string, unknown> = {
      name: editingPlan.name,
      price_monthly: editingPlan.price_monthly,
      price_yearly: editingPlan.price_yearly,
      edits_included: editingPlan.edits_included,
      price_per_extra_edit: editingPlan.price_per_extra_edit,
      max_styles: editingPlan.max_styles,
      max_storage_gb: editingPlan.max_storage_gb,
      has_ai_culling: editingPlan.has_ai_culling,
      has_team_access: editingPlan.has_team_access,
      has_api_access: editingPlan.has_api_access,
      has_priority_support: editingPlan.has_priority_support,
      has_full_style_library: (editingPlan as Record<string, unknown>).has_full_style_library,
    };
    versionMutation.mutate(
      { action: "replace", planId: replaceSource.id, updates },
      {
        onSuccess: () => {
          setConfirmReplace(false);
          setIsDialogOpen(false);
          setEditingPlan(null);
          setReplaceSource(null);
        },
        onError: () => setConfirmReplace(false),
      },
    );
  };

  const priceChanged = replaceSource && editingPlan &&
    (replaceSource.price_monthly !== editingPlan.price_monthly ||
      replaceSource.price_yearly !== editingPlan.price_yearly);

  return (
    <div className="min-h-full bg-background p-6 lg:p-8">
      <div className="mx-auto w-full max-w-[1320px] space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/dashboard/admin" aria-label="Back to admin">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-semibold tracking-tight">Subscription Plans</h1>
            <p className="caption mt-1 flex items-center gap-1.5">
              <CreditCard className="h-3 w-3" />
              Versioned pricing — every change creates a new version; subscribers keep their terms
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={syncPayPalMutation.isPending}
              onClick={() => syncPayPalMutation.mutate()}
              title="Create the PayPal billing plans for every published paid plan that doesn't have one yet. Idempotent."
            >
              <DollarSign className="h-4 w-4" />
              {syncPayPalMutation.isPending ? "Syncing…" : "Sync to PayPal"}
            </Button>
            <Button size="sm" className="gap-1.5" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              New plan
            </Button>
          </div>
        </div>

        {/* Credit menu prices — how many credits each AI action costs. Global
            and immediate (unlike plan prices, which are frozen per version). */}
        <div className="glass-card rounded-[--radius] p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold tracking-tight">Credit pricing (menu)</p>
              <span className="caption">Credits per action · applies to everyone from the next run</span>
            </div>
            <Button
              size="sm"
              disabled={!pricingDraft || savePricingMutation.isPending}
              onClick={() => pricingDraft && savePricingMutation.mutate(pricingDraft)}
            >
              Save pricing
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {([
              ["ai_edit", "AI edit / photo×style", "1"],
              ["ai_culling", "Culling / photo", "0.01"],
              ["face_recognition", "Faces / photo", "0.01"],
              ["style_training", "Model training / run", "1"],
            ] as const).map(([key, label, step]) => (
              <div key={key} className="space-y-1.5">
                <Label className="text-xs">{label}</Label>
                <Input
                  type="number"
                  step={step}
                  min={0}
                  value={pricing[key]}
                  onChange={(e) => setPricingDraft({ ...pricing, [key]: parseFloat(e.target.value) || 0 })}
                />
              </div>
            ))}
          </div>
        </div>

        {/* ── Plans table — one row per VERSION ── */}
        {isLoading ? (
          <div className="caption py-12 text-center">Loading plans…</div>
        ) : (
          <div className="glass-card overflow-x-auto rounded-[--radius]">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="aura-microlabel">Plan</TableHead>
                  <TableHead className="aura-microlabel">Version</TableHead>
                  <TableHead className="aura-microlabel text-right">Monthly</TableHead>
                  <TableHead className="aura-microlabel text-right">Yearly</TableHead>
                  <TableHead className="aura-microlabel text-right">Credits/mo</TableHead>
                  <TableHead className="aura-microlabel text-right">Storage</TableHead>
                  <TableHead className="aura-microlabel text-right">Subscribers</TableHead>
                  <TableHead className="aura-microlabel">PayPal</TableHead>
                  <TableHead className="aura-microlabel">Status</TableHead>
                  <TableHead className="aura-microlabel text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((plan) => {
                  const published = plan.is_published !== false;
                  const subs = subscriberCounts[plan.id] || 0;
                  const paid = (plan.price_monthly ?? 0) > 0 || (plan.price_yearly ?? 0) > 0;
                  const synced = paypalMapped.has(plan.id);
                  return (
                    <TableRow key={plan.id} className={cn(!published && "opacity-60")}>
                      <TableCell>
                        <p className="font-medium">{plan.name}</p>
                        <span className="aura-microlabel">{plan.slug}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">v{plan.version ?? 1}</Badge>
                      </TableCell>
                      <TableCell className="folio text-right tabular-nums">${plan.price_monthly}</TableCell>
                      <TableCell className="folio text-right tabular-nums">${plan.price_yearly}</TableCell>
                      <TableCell className="folio text-right tabular-nums">
                        {plan.edits_included === -1 ? "∞" : (plan.edits_included ?? 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="folio text-right tabular-nums">{plan.max_storage_gb}GB</TableCell>
                      <TableCell className="folio text-right tabular-nums">{subs.toLocaleString()}</TableCell>
                      <TableCell>
                        {!paid ? (
                          <span className="text-xs text-muted-foreground/50">—</span>
                        ) : synced ? (
                          <span className="inline-flex items-center gap-1 text-xs text-secondary">
                            <Check className="h-3.5 w-3.5" /> Synced
                          </span>
                        ) : published ? (
                          <span className="inline-flex items-center gap-1 text-xs text-rating" title="Run “Sync to PayPal” — until then nobody can subscribe to this version.">
                            <TriangleAlert className="h-3.5 w-3.5" /> Not synced
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground/50">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {published ? (
                          <Badge>Published</Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground" title="Hidden from pricing; closed to new signups. Existing subscribers keep billing on these exact terms.">
                            Retired
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="Plan actions">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {published && (
                              <DropdownMenuItem onClick={() => openEditAsNewVersion(plan)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit → new version…
                              </DropdownMenuItem>
                            )}
                            {published ? (
                              <DropdownMenuItem onClick={() => setConfirmAction({ type: "retire", plan })}>
                                <EyeOff className="mr-2 h-4 w-4" />
                                Retire…
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => setConfirmAction({ type: "publish", plan })}>
                                <Eye className="mr-2 h-4 w-4" />
                                Publish…
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {subs === 0 ? (
                              <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(plan)}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete…
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem disabled title="Has subscribers — retire instead.">
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete (has subscribers)
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* ── Create plan / Edit-as-new-version dialog ── */}
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) { setIsCreating(false); setEditingPlan(null); setReplaceSource(null); } }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {isCreating ? "Create Plan" : `New version of “${replaceSource?.name}” (v${(replaceSource?.version ?? 1) + 1})`}
              </DialogTitle>
              <DialogDescription>
                {isCreating
                  ? "New paid plans need “Sync to PayPal” before anyone can subscribe."
                  : "Saving creates a NEW version with these terms and retires the current one. Existing subscribers keep their current price — nothing changes for them."}
              </DialogDescription>
            </DialogHeader>

            {editingPlan && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input
                      value={editingPlan.name}
                      onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Slug {!isCreating && <span className="text-muted-foreground">(inherited)</span>}</Label>
                    <Input
                      value={editingPlan.slug}
                      disabled={!isCreating}
                      onChange={(e) => setEditingPlan({ ...editingPlan, slug: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Monthly Price ($)</Label>
                    <Input
                      type="number"
                      value={editingPlan.price_monthly}
                      onChange={(e) => setEditingPlan({ ...editingPlan, price_monthly: parseFloat(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Yearly Price ($)</Label>
                    <Input
                      type="number"
                      value={editingPlan.price_yearly}
                      onChange={(e) => setEditingPlan({ ...editingPlan, price_yearly: parseFloat(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>AI Edits Included (-1 = unlimited)</Label>
                    <Input
                      type="number"
                      value={editingPlan.edits_included ?? 0}
                      onChange={(e) => setEditingPlan({ ...editingPlan, edits_included: parseInt(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Price per Extra Edit ($)</Label>
                    <Input
                      type="number"
                      step="0.001"
                      value={editingPlan.price_per_extra_edit ?? 0}
                      onChange={(e) => setEditingPlan({ ...editingPlan, price_per_extra_edit: parseFloat(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Max Styles</Label>
                    <Input
                      type="number"
                      value={editingPlan.max_styles}
                      onChange={(e) => setEditingPlan({ ...editingPlan, max_styles: parseInt(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Storage (GB)</Label>
                    <Input
                      type="number"
                      value={editingPlan.max_storage_gb}
                      onChange={(e) => setEditingPlan({ ...editingPlan, max_storage_gb: parseInt(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  {([
                    ["has_ai_culling", "AI Culling"],
                    ["has_team_access", "Team Access"],
                    ["has_api_access", "API Access"],
                    ["has_priority_support", "Priority Support"],
                    ["has_full_style_library", "Full Style Library (30+)"],
                  ] as const).map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between">
                      <Label>{label}</Label>
                      <Switch
                        checked={Boolean((editingPlan as Record<string, unknown>)[key])}
                        onCheckedChange={(checked) => setEditingPlan({ ...editingPlan, [key]: checked } as PlanRow)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSavePlan} disabled={versionMutation.isPending || createPlanMutation.isPending}>
                {isCreating ? "Create plan" : "Continue…"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Replace confirmation — the heart of the workflow ── */}
        <AlertDialog open={confirmReplace} onOpenChange={(o) => !o && setConfirmReplace(false)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Create a new version and retire the current one?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2 text-sm">
                  <p>
                    This creates <strong>“{editingPlan?.name}” v{(replaceSource?.version ?? 1) + 1}</strong> with
                    the new terms and retires v{replaceSource?.version ?? 1}:
                  </p>
                  <ul className="list-disc space-y-1 pl-5">
                    {priceChanged && (
                      <li>
                        Price: ${replaceSource?.price_monthly}/mo → <strong>${editingPlan?.price_monthly}/mo</strong>
                        {replaceSource?.price_yearly !== editingPlan?.price_yearly &&
                          <> · ${replaceSource?.price_yearly}/yr → <strong>${editingPlan?.price_yearly}/yr</strong></>}
                      </li>
                    )}
                    <li>The old version's PayPal billing plan is <strong>deactivated</strong> — no new subscriptions can use it.</li>
                    <li>
                      Its <strong>{subscriberCounts[replaceSource?.id ?? ""] || 0} current subscriber(s)</strong> keep
                      billing at their existing price until they themselves switch plans.
                    </li>
                    <li>New signups get the new version only.</li>
                  </ul>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction disabled={versionMutation.isPending} onClick={(e) => { e.preventDefault(); runReplace(); }}>
                {versionMutation.isPending ? "Creating…" : "Create new version"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ── Retire / Publish confirmation ── */}
        <AlertDialog open={!!confirmAction} onOpenChange={(o) => !o && setConfirmAction(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirmAction?.type === "retire"
                  ? `Retire “${confirmAction.plan.name}” v${confirmAction.plan.version ?? 1}?`
                  : `Publish “${confirmAction?.plan.name}” v${confirmAction?.plan.version ?? 1}?`}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirmAction?.type === "retire"
                  ? `It disappears from the pricing page and its PayPal billing plan is deactivated, so no new subscriptions can be created on it. Its ${subscriberCounts[confirmAction.plan.id] || 0} current subscriber(s) keep billing unchanged.`
                  : "It appears on the pricing page and its PayPal billing plan is reactivated (or created on the next sync). Only one version per tier can be published."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={versionMutation.isPending}
                onClick={(e) => {
                  e.preventDefault();
                  if (!confirmAction) return;
                  versionMutation.mutate(
                    { action: confirmAction.type, planId: confirmAction.plan.id },
                    { onSettled: () => setConfirmAction(null) },
                  );
                }}
              >
                {versionMutation.isPending ? "Working…" : confirmAction?.type === "retire" ? "Retire version" : "Publish version"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ── Delete confirmation (only for versions with no subscribers) ── */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete “{deleteTarget?.name}” v{deleteTarget?.version ?? 1}?</AlertDialogTitle>
              <AlertDialogDescription>
                This version has no subscribers, so it can be permanently deleted. This can't be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deletePlanMutation.isPending}
                onClick={(e) => { e.preventDefault(); deleteTarget && deletePlanMutation.mutate(deleteTarget.id); }}
              >
                Delete version
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
