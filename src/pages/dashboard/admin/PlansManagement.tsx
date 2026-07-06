 import { useState } from "react";
 import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
 import { motion } from "framer-motion";
 import { 
   CreditCard, 
   Plus,
   Edit,
   Trash2,
   ArrowLeft,
   Check,
   X,
   DollarSign
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
   DialogTrigger,
 } from "@/components/ui/dialog";
 import { supabase } from "@/integrations/supabase/client";
 import { toast } from "sonner";
 import { SubscriptionPlan } from "@/hooks/useSubscription";
 
 export default function PlansManagement() {
   const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
   const [isDialogOpen, setIsDialogOpen] = useState(false);
   const [isCreating, setIsCreating] = useState(false);
   const [deleteTarget, setDeleteTarget] = useState<SubscriptionPlan | null>(null);
   const queryClient = useQueryClient();
 
   const { data: plans, isLoading } = useQuery({
     queryKey: ["admin-plans"],
     queryFn: async () => {
       const { data, error } = await supabase
         .from("subscription_plans")
         .select("*")
         .order("sort_order");

       if (error) throw error;
       return data as unknown as SubscriptionPlan[];
     },
   });

   // Subscribers per plan — drives the delete guard messaging and shows
   // which (possibly legacy) versions still carry users.
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
 
   const updatePlanMutation = useMutation({
     mutationFn: async (plan: Partial<SubscriptionPlan> & { id: string }) => {
       const { error } = await supabase
         .from("subscription_plans")
         .update(plan)
         .eq("id", plan.id);
       if (error) throw error;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ["admin-plans"] });
       toast.success("Plan updated successfully");
       setIsDialogOpen(false);
       setEditingPlan(null);
     },
     onError: (error) => {
       console.error("Error updating plan:", error);
       toast.error("Failed to update plan");
     },
   });
 
   // Create a brand-new plan (a new TIER, version 1). family_slug = slug so
   // future price changes clone into new versions of this same family.
   const createPlanMutation = useMutation({
     mutationFn: async (plan: Partial<SubscriptionPlan>) => {
       const maxSort = Math.max(0, ...(plans ?? []).map((p) => (p as any).sort_order ?? 0));
       const { error } = await supabase.from("subscription_plans").insert({
         ...plan,
         family_slug: plan.slug,
         version: 1,
         is_published: true,
         is_active: true,
         sort_order: maxSort + 1,
       } as any);
       if (error) throw error;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ["admin-plans"] });
       queryClient.invalidateQueries({ queryKey: ["admin-plan-subscriber-counts"] });
       toast.success("Plan created. Run “Sync to PayPal” before anyone can subscribe to a paid plan.");
       setIsDialogOpen(false);
       setEditingPlan(null);
       setIsCreating(false);
     },
     onError: (error: any) => {
       console.error("Error creating plan:", error);
       toast.error(error?.message?.includes("duplicate") ? "That slug is already taken." : "Failed to create plan");
     },
   });

   // Delete a plan. The DB trigger blocks deletion when subscribers exist —
   // we surface that as a friendly "unpublish instead" message.
   const deletePlanMutation = useMutation({
     mutationFn: async (id: string) => {
       const { error } = await supabase.from("subscription_plans").delete().eq("id", id);
       if (error) throw error;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ["admin-plans"] });
       toast.success("Plan deleted");
       setDeleteTarget(null);
     },
     onError: (error: any) => {
       console.error("Error deleting plan:", error);
       const msg = String(error?.message || "");
       toast.error(msg.includes("cannot be deleted")
         ? "This plan has subscribers — unpublish it instead of deleting."
         : "Failed to delete plan");
       setDeleteTarget(null);
     },
   });

   // Create/refresh the PayPal billing plans for every published paid plan.
   // Idempotent — safe to click repeatedly; only missing plans are created.
   const syncPayPalMutation = useMutation({
     mutationFn: async () => {
       const { data: { session } } = await supabase.auth.getSession();
       if (!session) throw new Error("Not authenticated");
       const { data, error } = await supabase.functions.invoke("paypal-setup-plans");
       if (error) throw error;
       return data;
     },
     onSuccess: () => toast.success("PayPal plans synced — paid plans are now purchasable."),
     onError: (error: any) => {
       console.error("PayPal sync failed:", error);
       toast.error("PayPal sync failed. Check that PayPal mode & credentials are configured.");
     },
   });

   const togglePlanActive = async (plan: SubscriptionPlan) => {
     updatePlanMutation.mutate({ id: plan.id, is_active: !plan.is_active });
   };

   const BLANK_PLAN = {
     name: "", slug: "", price_monthly: 0, price_yearly: 0, edits_included: 0,
     price_per_extra_edit: 0, max_styles: 0, max_storage_gb: 5,
     has_ai_culling: true, has_team_access: false, has_api_access: false,
     has_priority_support: false, has_full_style_library: false,
   } as unknown as SubscriptionPlan;

   const openCreate = () => {
     setEditingPlan({ ...BLANK_PLAN });
     setIsCreating(true);
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
       updatePlanMutation.mutate(editingPlan);
     }
   };
 
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
             Manage pricing and plan features
           </p>
         </div>
         <div className="flex items-center gap-2">
           <Button
             variant="outline"
             size="sm"
             className="gap-1.5"
             disabled={syncPayPalMutation.isPending}
             onClick={() => syncPayPalMutation.mutate()}
             title="Create the PayPal billing plans for every published paid plan. Run this after adding or publishing a paid plan."
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

       {isLoading ? (
         <div className="caption py-12 text-center">Loading plans…</div>
       ) : (
         <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
           {plans?.map((plan, index) => (
             <motion.div
               key={plan.id}
               initial={{ opacity: 0, y: 12 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ delay: index * 0.06, duration: 0.4, ease: [0.22, 0.61, 0.36, 1] }}
             >
               <div className={`glass-card relative h-full overflow-hidden rounded-[--radius] ${!plan.is_active ? "opacity-60" : ""}`}>
                 {/* Header — mono module bar */}
                 <div className="flex items-center justify-between gap-2 border-b border-border bg-background/40 px-4 py-2.5">
                   <div className="min-w-0">
                     <p className="truncate text-sm font-semibold tracking-tight">{plan.name}</p>
                     <span className="aura-microlabel">{plan.slug}</span>
                   </div>
                   <div className="flex shrink-0 items-center gap-0.5">
                     <Button
                       variant="ghost"
                       size="icon"
                       aria-label="Edit plan" className="h-8 w-8"
                       onClick={() => {
                         setEditingPlan(plan);
                         setIsCreating(false);
                         setIsDialogOpen(true);
                       }}
                     >
                       <Edit className="w-4 h-4" />
                     </Button>
                     {/* Delete is only offered when the plan has no subscribers.
                         Otherwise the DB trigger blocks it — unpublish instead. */}
                     {(subscriberCounts[plan.id] || 0) === 0 ? (
                       <Button
                         variant="ghost"
                         size="icon"
                         aria-label="Delete plan"
                         className="h-8 w-8 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                         onClick={() => setDeleteTarget(plan)}
                       >
                         <Trash2 className="w-4 h-4" />
                       </Button>
                     ) : (
                       <Button
                         variant="ghost"
                         size="icon"
                         aria-label="Cannot delete — has subscribers"
                         className="h-8 w-8 cursor-not-allowed text-muted-foreground/30"
                         disabled
                         title="Has subscribers — unpublish instead of deleting."
                       >
                         <Trash2 className="w-4 h-4" />
                       </Button>
                     )}
                   </div>
                 </div>

                 <div className="space-y-4 p-4">
                   <div className="flex flex-wrap gap-1.5">
                     {(plan as any).version > 1 && (
                       <Badge variant="outline">v{(plan as any).version}</Badge>
                     )}
                     {(plan as any).is_published === false && (
                       <Badge
                         variant="outline"
                         className="text-muted-foreground"
                         title="Hidden from the pricing page. Existing subscribers keep this plan's terms."
                       >
                         Unpublished (legacy)
                       </Badge>
                     )}
                     {!plan.is_active && (
                       <Badge
                         variant="outline"
                         className="text-muted-foreground"
                         title="New subscriptions are disabled. Existing subscribers are unaffected."
                       >
                         Inactive (no new signups)
                       </Badge>
                     )}
                   </div>

                   <div>
                     <div className="flex items-baseline gap-1">
                       <span className="folio text-3xl text-foreground">${plan.price_monthly}</span>
                       <span className="text-sm text-muted-foreground">/month</span>
                     </div>
                     <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                       ${plan.price_yearly}/year
                     </div>
                   </div>

                   <div className="space-y-2 text-sm">
                     <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">AI Edits / month</span>
                        <span className="folio">{plan.edits_included === -1 ? "Unlimited" : (plan.edits_included ?? 0).toLocaleString()}</span>
                     </div>
                     <div className="flex items-center justify-between">
                       <span className="text-muted-foreground">Custom AI Models</span>
                       <span className="folio">{plan.max_styles === -1 ? "Unlimited" : plan.max_styles}</span>
                     </div>
                     <div className="flex items-center justify-between">
                       <span className="text-muted-foreground">Storage</span>
                       <span className="folio">{plan.max_storage_gb}GB</span>
                     </div>
                   </div>

                   <div className="space-y-2 border-t border-border pt-3">
                     <div className="flex items-center justify-between text-sm">
                       <span className="text-muted-foreground">AI Culling</span>
                       {plan.has_ai_culling ? (
                         <Check className="w-4 h-4 text-secondary" />
                       ) : (
                         <X className="w-4 h-4 text-muted-foreground/50" />
                       )}
                     </div>
                     <div className="flex items-center justify-between text-sm">
                       <span className="text-muted-foreground">Team Access</span>
                       {plan.has_team_access ? (
                         <Check className="w-4 h-4 text-secondary" />
                       ) : (
                         <X className="w-4 h-4 text-muted-foreground/50" />
                       )}
                     </div>
                     <div className="flex items-center justify-between text-sm">
                       <span className="text-muted-foreground">API Access</span>
                       {plan.has_api_access ? (
                         <Check className="w-4 h-4 text-secondary" />
                       ) : (
                         <X className="w-4 h-4 text-muted-foreground/50" />
                       )}
                     </div>
                   </div>

                   <div className="space-y-2 border-t border-border pt-3">
                     <div className="flex items-center justify-between text-sm">
                       <span className="text-muted-foreground">Subscribers</span>
                       <span className="folio">{(subscriberCounts[plan.id] || 0).toLocaleString()}</span>
                     </div>
                     <div className="flex items-center justify-between">
                       <Label htmlFor={`published-${plan.id}`} className="caption" title="Shown on the pricing page for new subscribers. Unpublishing never affects existing subscribers.">Published</Label>
                       <Switch
                         id={`published-${plan.id}`}
                         checked={(plan as any).is_published !== false}
                         onCheckedChange={() =>
                           updatePlanMutation.mutate({ id: plan.id, is_published: (plan as any).is_published === false } as any)
                         }
                       />
                     </div>
                     <div className="flex items-center justify-between">
                       <Label htmlFor={`active-${plan.id}`} className="caption">Active</Label>
                       <Switch
                         id={`active-${plan.id}`}
                         checked={plan.is_active}
                         onCheckedChange={() => togglePlanActive(plan)}
                       />
                     </div>
                     {(subscriberCounts[plan.id] || 0) > 0 && (
                       <p className="text-[10px] text-muted-foreground/60">
                         Has subscribers — can be unpublished, never deleted.
                       </p>
                     )}
                   </div>
                 </div>
               </div>
             </motion.div>
           ))}
         </div>
       )}
 
       {/* Edit Plan Dialog */}
       <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) { setIsCreating(false); setEditingPlan(null); } }}>
         <DialogContent className="max-w-lg">
           <DialogHeader>
             <DialogTitle>{isCreating ? "Create Plan" : `Edit Plan: ${editingPlan?.name}`}</DialogTitle>
             <DialogDescription>
               {isCreating
                 ? "New paid plans need “Sync to PayPal” before anyone can subscribe. A price change to an existing plan should be a new version, not an edit here."
                 : "Update the plan details and pricing"}
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
                   <Label>Slug</Label>
                   <Input
                     value={editingPlan.slug}
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
                 <div className="flex items-center justify-between">
                   <Label>AI Culling</Label>
                   <Switch
                     checked={editingPlan.has_ai_culling}
                     onCheckedChange={(checked) => setEditingPlan({ ...editingPlan, has_ai_culling: checked })}
                   />
                 </div>
                 <div className="flex items-center justify-between">
                   <Label>Team Access</Label>
                   <Switch
                     checked={editingPlan.has_team_access}
                     onCheckedChange={(checked) => setEditingPlan({ ...editingPlan, has_team_access: checked })}
                   />
                 </div>
                 <div className="flex items-center justify-between">
                   <Label>API Access</Label>
                   <Switch
                     checked={editingPlan.has_api_access}
                     onCheckedChange={(checked) => setEditingPlan({ ...editingPlan, has_api_access: checked })}
                   />
                 </div>
                 <div className="flex items-center justify-between">
                   <Label>Priority Support</Label>
                   <Switch
                     checked={editingPlan.has_priority_support}
                     onCheckedChange={(checked) => setEditingPlan({ ...editingPlan, has_priority_support: checked })}
                   />
                 </div>
                 <div className="flex items-center justify-between">
                   <Label>Full Style Library (30+)</Label>
                   <Switch
                     checked={(editingPlan as any).has_full_style_library || false}
                     onCheckedChange={(checked) => setEditingPlan({ ...editingPlan, has_full_style_library: checked } as any)}
                   />
                 </div>
               </div>
             </div>
           )}
 
           <DialogFooter>
             <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
               Cancel
             </Button>
             <Button onClick={handleSavePlan} disabled={updatePlanMutation.isPending || createPlanMutation.isPending}>
               {isCreating ? "Create plan" : "Save Changes"}
             </Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>

       {/* Delete confirmation (only reachable for plans with no subscribers) */}
       <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
         <DialogContent className="max-w-md">
           <DialogHeader>
             <DialogTitle>Delete “{deleteTarget?.name}”?</DialogTitle>
             <DialogDescription>
               This plan has no subscribers, so it can be permanently deleted. This can't be undone.
             </DialogDescription>
           </DialogHeader>
           <DialogFooter>
             <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
             <Button
               variant="destructive"
               disabled={deletePlanMutation.isPending}
               onClick={() => deleteTarget && deletePlanMutation.mutate(deleteTarget.id)}
             >
               Delete plan
             </Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>
       </div>
     </div>
   );
 }