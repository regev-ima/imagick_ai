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
 
   const togglePlanActive = async (plan: SubscriptionPlan) => {
     updatePlanMutation.mutate({ id: plan.id, is_active: !plan.is_active });
   };
 
   const handleSavePlan = () => {
     if (!editingPlan) return;
     updatePlanMutation.mutate(editingPlan);
   };
 
   return (
     <div className="min-h-full bg-background p-6 lg:p-8">
       <div className="mx-auto w-full max-w-[1320px] space-y-6">
       <div className="flex items-center gap-3">
         <Button variant="ghost" size="icon" asChild>
           <Link to="/dashboard/admin">
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
                   <Button
                     variant="ghost"
                     size="icon"
                     className="h-8 w-8 shrink-0"
                     onClick={() => {
                       setEditingPlan(plan);
                       setIsDialogOpen(true);
                     }}
                   >
                     <Edit className="w-4 h-4" />
                   </Button>
                 </div>

                 <div className="space-y-4 p-4">
                   {!plan.is_active && (
                     <Badge
                       variant="outline"
                       className="text-muted-foreground"
                       title="New subscriptions are disabled. Existing subscribers are unaffected."
                     >
                       Inactive (no new signups)
                     </Badge>
                   )}

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

                   <div className="flex items-center justify-between border-t border-border pt-3">
                     <Label htmlFor={`active-${plan.id}`} className="caption">Active</Label>
                     <Switch
                       id={`active-${plan.id}`}
                       checked={plan.is_active}
                       onCheckedChange={() => togglePlanActive(plan)}
                     />
                   </div>
                 </div>
               </div>
             </motion.div>
           ))}
         </div>
       )}
 
       {/* Edit Plan Dialog */}
       <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
         <DialogContent className="max-w-lg">
           <DialogHeader>
             <DialogTitle>Edit Plan: {editingPlan?.name}</DialogTitle>
             <DialogDescription>
               Update the plan details and pricing
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
             <Button onClick={handleSavePlan} disabled={updatePlanMutation.isPending}>
               Save Changes
             </Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>
       </div>
     </div>
   );
 }