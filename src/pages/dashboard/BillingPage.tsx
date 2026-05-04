import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import {
  CreditCard,
  Zap,
  Check,
  Crown,
  Sparkles,
  ChevronRight,
  HardDrive,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  XCircle,
  Gift,
  Infinity as InfinityIcon,
  Store,
  Download,
  Loader2,
  Receipt,
  CalendarDays,
  ShieldCheck,
  Package,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { BillingHistoryModal } from "@/components/billing/BillingHistoryModal";
import { StorageBreakdownModal } from "@/components/billing/StorageBreakdownModal";
import { CreditsUsageModal } from "@/components/billing/CreditsUsageModal";
import { CancelSubscriptionModal } from "@/components/billing/CancelSubscriptionModal";
import { DowngradeConfirmModal } from "@/components/billing/DowngradeConfirmModal";
import { AddOnModal } from "@/components/billing/AddOnModal";
import { PayPalCheckoutModal } from "@/components/billing/PayPalCheckoutModal";
import { useSubscription, type SubscriptionPlan } from "@/hooks/useSubscription";
import { useEffectiveUser } from "@/hooks/useImpersonation";
import { useInvoices } from "@/hooks/useInvoices";
import { downloadInvoicePdf } from "@/lib/download-invoice-pdf";
import { toast } from "sonner";

type CreditGrant = {
  id: string;
  status: string;
  expires_at: string | null;
  credits_remaining: number;
};

export default function BillingPage() {
  const {
    currentPlan,
    subscription,
    plans: dbPlans,
    editsUsed,
    editsTotal,
    editsRemaining,
    isUnlimited,
    isFreePlan,
    isPaidPlan,
    isCancelling,
    isSuspended,
    isExpired,
    storageUsedMb,
    maxStorageGb,
    maxStyles,
    refetch,
    creditGrants,
    giftCreditsTotal,
    planCreditsRemaining,
    extraModels,
    extraStorageGb,
    activeAddons,
  } = useSubscription();

  const { effectiveUserId } = useEffectiveUser();
  const queryClient = useQueryClient();

  const { data: invoices = [] } = useInvoices();
  const planSlug = currentPlan?.slug || "free";
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [showBillingHistory, setShowBillingHistory] = useState(false);
  const [showStorageBreakdown, setShowStorageBreakdown] = useState(false);
  const [showEditsUsage, setShowEditsUsage] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [downgradeTarget, setDowngradeTarget] = useState<SubscriptionPlan | null>(null);
  const [showAddOnModal, setShowAddOnModal] = useState(false);
  const [paypalCheckoutPlan, setPaypalCheckoutPlan] = useState<SubscriptionPlan | null>(null);
  const [syncingCheckout, setSyncingCheckout] = useState(false);
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null);
  const plansRef = useRef<HTMLDivElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  // Handle PayPal return
  useEffect(() => {
    const paypalResult = searchParams.get("paypal");
    const addonResult = searchParams.get("addon");
    if (paypalResult === "success") {
      toast.success("Subscription activated! Welcome to your new plan.");
      refetch();
      queryClient.invalidateQueries({ queryKey: ["invoices", effectiveUserId] });
      setSearchParams({}, { replace: true });
    } else if (paypalResult === "cancelled") {
      toast.info("Checkout was cancelled.");
      setSearchParams({}, { replace: true });
    } else if (addonResult === "success") {
      toast.success("Add-on purchased successfully!");
      refetch();
      queryClient.invalidateQueries({ queryKey: ["invoices", effectiveUserId] });
      setSearchParams({}, { replace: true });
    } else if (addonResult === "cancelled") {
      toast.info("Add-on purchase was cancelled.");
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, refetch, queryClient, effectiveUserId]);

  // After checkout, keep syncing briefly to catch delayed webhook updates.
  useEffect(() => {
    if (!syncingCheckout) return;
    if (isPaidPlan) {
      setSyncingCheckout(false);
      return;
    }

    const interval = setInterval(() => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ["invoices", effectiveUserId] });
      queryClient.invalidateQueries({ queryKey: ["user-subscription", effectiveUserId] });
    }, 3000);

    const timeout = setTimeout(() => {
      setSyncingCheckout(false);
    }, 60000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [syncingCheckout, isPaidPlan, refetch, queryClient, effectiveUserId]);

  const scrollToPlans = () => {
    setTimeout(() => plansRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const handleDownloadInvoice = async (invoice: typeof invoices[0]) => {
    setDownloadingInvoiceId(invoice.id);
    try {
      await downloadInvoicePdf(invoice.id, invoice.invoice_number);
    } catch {
      toast.error("Failed to download invoice");
    } finally {
      setDownloadingInvoiceId(null);
    }
  };

  const handleSelectPlan = async (plan: SubscriptionPlan) => {
    if (plan.slug === planSlug) return;

    const currentSort = currentPlan?.sort_order ?? 0;
    const targetSort = plan.sort_order;

    if (plan.slug === "free") {
      setShowCancelModal(true);
      return;
    }

    if (targetSort < currentSort && isPaidPlan) {
      setDowngradeTarget(plan);
      return;
    }

    setPaypalCheckoutPlan(plan);
  };

  const editsPercentage = !isUnlimited && editsTotal > 0 ? (editsUsed / editsTotal) * 100 : 0;
  const storageUsedGb = storageUsedMb / 1024;
  const storagePercentage = maxStorageGb > 0 ? (storageUsedGb / maxStorageGb) * 100 : 0;
  const activeCreditGrants = (creditGrants as CreditGrant[]).filter((grant) => grant.status === "active");

  const plansList = dbPlans.length > 0 ? dbPlans : [];
  const maxFeatures = plansList.length > 0 ? Math.max(...plansList.map(p => (p.features as string[])?.length || 0)) : 0;

  const getPlanButtonLabel = (plan: SubscriptionPlan) => {
    if (plan.slug === planSlug) return "Current Plan";
    if (plan.slug === "free") return "Free Plan";
    const currentSort = currentPlan?.sort_order ?? 0;
    if (plan.sort_order > currentSort) return "Upgrade";
    return "Downgrade";
  };

  const getPlanButtonVariant = (plan: SubscriptionPlan) => {
    if (plan.slug === planSlug) return "outline" as const;
    if (plan.slug === "studio") return "glow" as const;
    return "default" as const;
  };

  const priceDisplay = isPaidPlan
    ? subscription?.billing_cycle === "yearly"
      ? `$${currentPlan?.price_yearly || 0}/year`
      : `$${currentPlan?.price_monthly || 0}/month`
    : "Free forever";

  return (
    <div className="p-6 lg:p-8 space-y-10">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-3xl font-bold tracking-tight">
          <span className="text-gradient-primary">Billing</span> & Usage
        </h1>
        <p className="text-muted-foreground mt-1.5">Manage your subscription and monitor usage</p>
      </motion.div>

      {/* Status Banners */}
      {isCancelling && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
          <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
          <div>
            <p className="font-medium text-yellow-500">Subscription cancelling</p>
            <p className="text-sm text-muted-foreground">
              Your {currentPlan?.name} plan remains active until {subscription?.current_period_end || "the end of your billing period"}.
            </p>
          </div>
        </div>
      )}

      {isSuspended && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/30">
          <XCircle className="w-5 h-5 text-destructive flex-shrink-0" />
          <div>
            <p className="font-medium text-destructive">Payment failed</p>
            <p className="text-sm text-muted-foreground">
              Your subscription is suspended due to a payment failure. Please update your payment method.
            </p>
          </div>
        </div>
      )}

      {isExpired && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/30">
          <XCircle className="w-5 h-5 text-destructive flex-shrink-0" />
          <div>
            <p className="font-medium text-destructive">Subscription expired</p>
            <p className="text-sm text-muted-foreground">
              Your subscription has expired. Upgrade to continue uploading and editing photos.
            </p>
          </div>
          <Button size="sm" onClick={scrollToPlans}>Upgrade Now</Button>
        </div>
      )}

      {isFreePlan && !isUnlimited && editsRemaining <= 500 && editsRemaining > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
          <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
          <div>
            <p className="font-medium text-yellow-500">Running low on edits</p>
            <p className="text-sm text-muted-foreground">
              You have {editsRemaining.toLocaleString()} edits remaining. Upgrade for unlimited edits.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={scrollToPlans}>View Plans</Button>
        </div>
      )}

      {isFreePlan && editsRemaining === 0 && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/30">
          <XCircle className="w-5 h-5 text-destructive flex-shrink-0" />
          <div>
            <p className="font-medium text-destructive">All free edits used</p>
            <p className="text-sm text-muted-foreground">
              You've used all 3,000 free edits. Upgrade to a paid plan for unlimited editing.
            </p>
          </div>
          <Button size="sm" onClick={scrollToPlans}>Upgrade Now</Button>
        </div>
      )}

      {/* ── Hero: Current Plan ────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
      >
        <Card className="glass-card border-primary/30 overflow-hidden relative">
          {/* Subtle gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 pointer-events-none" />
          <CardContent className="pt-6 pb-6 relative">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              {/* Plan identity */}
              <div className="flex items-center gap-4 flex-1">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shrink-0">
                  <Crown className="w-7 h-7 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-bold">{currentPlan?.name || "Free"}</h2>
                    {isPaidPlan && (
                      <Badge className="bg-primary/10 text-primary border-primary/30">Active</Badge>
                    )}
                    {isCancelling && (
                      <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30">Cancelling</Badge>
                    )}
                  </div>
                  <p className="text-lg text-muted-foreground">{priceDisplay}</p>
                </div>
              </div>

              {/* Plan meta */}
              <div className="flex items-center gap-6 text-sm">
                {isPaidPlan && (
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-cyan-500/10">
                      <CalendarDays className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{isCancelling ? "Active until" : "Next billing"}</p>
                      <p className="font-medium">{subscription?.current_period_end || "—"}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Payment</p>
                    <p className="font-medium">{subscription?.paypal_subscription_id ? "PayPal" : "None"}</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                {isPaidPlan && !isCancelling && (
                  <>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowAddOnModal(true)}>
                      <Package className="w-3.5 h-3.5" /> Add-ons
                    </Button>
                    <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setShowCancelModal(true)}>
                      Cancel
                    </Button>
                  </>
                )}
                {isFreePlan && (
                  <Button size="sm" className="gap-1.5" onClick={scrollToPlans}>
                    <TrendingUp className="w-3.5 h-3.5" /> Upgrade Plan
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Usage Stats ───────────────────────────────────────────────── */}
      <motion.div
        className="grid gap-5 sm:grid-cols-2"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.15 }}
      >
        {/* AI Edits */}
        <Card
          className={cn(
            "glass-card cursor-pointer hover:border-primary/40 transition-all group",
            giftCreditsTotal > 0 && !isUnlimited
              ? "border-green-500/30 hover:border-green-500/50"
              : "border-border/50"
          )}
          onClick={() => setShowEditsUsage(true)}
        >
          <CardContent className="pt-6">
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-2.5 rounded-xl",
                  giftCreditsTotal > 0 && !isUnlimited ? "bg-green-500/10" : "bg-amber-500/10"
                )}>
                  {giftCreditsTotal > 0 && !isUnlimited ? (
                    <Gift className="w-5 h-5 text-green-500" />
                  ) : (
                    <Zap className="w-5 h-5 text-amber-400" />
                  )}
                </div>
                <div>
                  <p className="font-semibold">AI Edits</p>
                  <p className="text-xs text-muted-foreground">{isUnlimited ? "Unlimited plan" : "Lifetime balance"}</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground/0 group-hover:text-muted-foreground transition-all" />
            </div>

            {isUnlimited ? (
              <div className="flex items-baseline gap-2">
                <p className="text-4xl font-bold tabular-nums">{editsUsed.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">edits used this period</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-baseline gap-2">
                  <p className="text-4xl font-bold tabular-nums">{editsRemaining.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">remaining</p>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{editsUsed.toLocaleString()} used</span>
                    <span className="flex items-center gap-1">
                      {editsTotal.toLocaleString()}
                      {giftCreditsTotal > 0 && (
                        <> + <Gift className="w-3 h-3 text-green-500 inline" />{giftCreditsTotal.toLocaleString()}</>
                      )}
                      {" "}total
                    </span>
                  </div>
                  <Progress value={editsPercentage} className="h-2" />
                </div>
                {giftCreditsTotal > 0 && (
                  <div className="pt-2 border-t border-border/50 space-y-1">
                    {activeCreditGrants.map((grant) => (
                      <div key={grant.id} className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Gift className="w-3 h-3 text-green-500" />
                          Gift credits
                          <span className="text-[10px]">
                            (expires {new Date(grant.expires_at!).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })})
                          </span>
                        </span>
                        <span className="font-medium text-green-500">{grant.credits_remaining.toLocaleString()}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Plan credits</span>
                      <span className="font-medium">{planCreditsRemaining.toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Storage */}
        <Card className="glass-card border-border/50 cursor-pointer hover:border-primary/40 transition-all group" onClick={() => setShowStorageBreakdown(true)}>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-sky-500/10">
                  <HardDrive className="w-5 h-5 text-sky-400" />
                </div>
                <div>
                  <p className="font-semibold">Storage</p>
                  <p className="text-xs text-muted-foreground">Cloud storage</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground/0 group-hover:text-muted-foreground transition-all" />
            </div>

            <div className="space-y-3">
              <div className="flex items-baseline gap-2">
                <p className="text-4xl font-bold tabular-nums">{storageUsedGb.toFixed(1)}</p>
                <p className="text-sm text-muted-foreground">
                  GB of{" "}
                  {extraStorageGb > 0
                    ? `${(currentPlan?.max_storage_gb || 5) + extraStorageGb} GB`
                    : `${maxStorageGb} GB`}
                </p>
              </div>
              <Progress value={storagePercentage} className="h-2" />
              {extraStorageGb > 0 && (
                <p className="text-xs text-muted-foreground">
                  Includes {extraStorageGb} GB from add-ons
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Active Add-ons Summary */}
      {activeAddons.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.2 }}
        >
          <Card className="glass-card border-border/50">
            <CardHeader>
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-violet-500/10">
                  <Package className="w-4 h-4 text-violet-400" />
                </div>
                <CardTitle className="text-lg">Active Add-ons</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {extraModels > 0 && (
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-muted/20">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Sparkles className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Custom AI Models</p>
                      <p className="text-xs text-muted-foreground">
                        {currentPlan?.max_styles || 0} + {extraModels} = {maxStyles} total
                      </p>
                    </div>
                  </div>
                )}
                {extraStorageGb > 0 && (
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-muted/20">
                    <div className="p-2 rounded-lg bg-sky-500/10">
                      <HardDrive className="w-4 h-4 text-sky-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Extra Storage</p>
                      <p className="text-xs text-muted-foreground">
                        {currentPlan?.max_storage_gb || 5} GB + {extraStorageGb} GB purchased
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ── Billing History ───────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.25 }}
      >
        <Card className="glass-card border-border/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-emerald-500/10">
                  <Receipt className="w-4 h-4 text-emerald-400" />
                </div>
                <CardTitle>Billing History</CardTitle>
              </div>
              {invoices.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1"
                  onClick={() => setShowBillingHistory(true)}
                >
                  View All
                  <ChevronRight className="w-4 h-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {invoices.length === 0 ? (
              <div className="flex flex-col items-center py-8 gap-3 text-muted-foreground">
                <div className="p-3 rounded-2xl bg-muted/50">
                  <Receipt className="w-6 h-6" />
                </div>
                <p className="text-sm">
                  {isPaidPlan ? "Your invoices will appear here after your first payment." : "Upgrade to a paid plan to see billing history."}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {invoices.slice(0, 3).map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between p-3.5 rounded-lg border border-border/30 hover:bg-muted/20 transition-colors text-sm">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-muted/50">
                        <CreditCard className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">{inv.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(inv.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-semibold">${inv.amount.toFixed(2)}</p>
                        <Badge
                          className={cn(
                            "text-[10px] px-1.5 py-0",
                            inv.status === "paid"
                              ? "bg-green-500/10 text-green-500 border-green-500/30"
                              : "bg-amber-500/10 text-amber-500 border-amber-500/30"
                          )}
                        >
                          {inv.status}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        disabled={downloadingInvoiceId === inv.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadInvoice(inv);
                        }}
                      >
                        {downloadingInvoiceId === inv.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Plans ─────────────────────────────────────────────────────── */}
      <motion.div
        ref={plansRef}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.3 }}
      >
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold">Simple pricing for photographers</h2>
          <p className="text-muted-foreground mt-1">Focus on shooting, not editing. Every paid plan includes unlimited AI editing.</p>
        </div>

        {/* Unlimited Strip */}
        <div className="flex items-center justify-center gap-6 p-3 rounded-lg bg-primary/5 border border-primary/20 mb-6">
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <InfinityIcon className="w-4 h-4 text-primary" /> AI Editing
          </span>
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <InfinityIcon className="w-4 h-4 text-primary" /> Culling & Grouping
          </span>
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <InfinityIcon className="w-4 h-4 text-primary" /> Galleries
          </span>
          <span className="text-xs text-muted-foreground">Included in every paid plan</span>
        </div>

        <div className="flex items-center justify-end mb-6">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-muted border border-border/50">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={cn(
                "px-4 py-2 rounded-md text-sm font-medium transition-all",
                billingCycle === "monthly"
                  ? "bg-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle("yearly")}
              className={cn(
                "px-4 py-2 rounded-md text-sm font-medium transition-all",
                billingCycle === "yearly"
                  ? "bg-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Yearly
              <span className="ml-1 text-xs text-primary">-20%</span>
            </button>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {plansList.map((plan) => {
            const features = (plan.features as string[]) || [];
            const isCurrentPlan = plan.slug === planSlug;
            const isPopular = plan.slug === "pro";
            const priceMonthly = plan.price_monthly;
            const priceYearly = plan.price_yearly;
            const monthlyEquivalent = priceYearly > 0 ? Math.round((priceYearly / 12) * 100) / 100 : 0;

            return (
              <motion.div
                key={plan.id}
                whileHover={{ y: -4 }}
                className={cn(
                  "relative rounded-xl border p-6 transition-all flex flex-col",
                  isPopular
                    ? "glass-card border-primary shadow-lg shadow-primary/20"
                    : "bg-card/50 border-border/50"
                )}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r from-primary to-accent text-primary-foreground text-xs font-medium rounded-full flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Most Popular
                  </div>
                )}

                <div className="mb-4">
                  <h3 className="text-lg font-bold">{plan.name}</h3>
                </div>

                <div className="h-[72px] flex flex-col justify-start">
                  <div>
                    {billingCycle === "yearly" && priceMonthly > 0 && (
                      <span className="text-lg text-muted-foreground line-through mr-1">${priceMonthly}</span>
                    )}
                    <span className="text-3xl font-bold">
                      {billingCycle === "yearly" && priceYearly > 0
                        ? `$${monthlyEquivalent}`
                        : `$${priceMonthly}`}
                    </span>
                    <span className="text-muted-foreground"> /Month</span>
                  </div>
                  {billingCycle === "yearly" && priceYearly > 0 && (
                    <p className="text-xs text-muted-foreground">*Billed annually (${priceYearly}/yr)</p>
                  )}
                </div>

                <Button
                  variant={getPlanButtonVariant(plan)}
                  className="w-full mb-6 gap-1"
                  disabled={isCurrentPlan}
                  onClick={() => handleSelectPlan(plan)}
                >
                  {getPlanButtonLabel(plan)}
                  {!isCurrentPlan && plan.sort_order > (currentPlan?.sort_order ?? 0) && (
                    <ArrowUpRight className="w-4 h-4" />
                  )}
                  {!isCurrentPlan && plan.slug !== "free" && plan.sort_order < (currentPlan?.sort_order ?? 0) && (
                    <ArrowDownRight className="w-4 h-4" />
                  )}
                </Button>

                <p className="text-sm font-semibold mb-3">Plan includes:</p>

                <ul className="space-y-3 mb-6 flex-1">
                  {features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                  {[...Array(Math.max(0, maxFeatures - features.length))].map((_, i) => (
                    <li key={`empty-${i}`} className="h-6" />
                  ))}
                </ul>
              </motion.div>
            );
          })}
        </div>

        {/* Marketplace Teaser */}
        <div className="mt-8 p-6 rounded-xl border-2 border-dashed border-border/50 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Store className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-bold">AI Style Marketplace</h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary border border-primary/20">
              Coming Soon
            </span>
          </div>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Buy and sell custom AI editing styles created by photographers. Share your unique look with the community.
          </p>
        </div>
      </motion.div>


      {/* Modals */}
      <AnimatePresence>
        {showBillingHistory && (
          <BillingHistoryModal
            isOpen={showBillingHistory}
            onClose={() => setShowBillingHistory(false)}
          />
        )}
        {showStorageBreakdown && (
          <StorageBreakdownModal
            isOpen={showStorageBreakdown}
            onClose={() => setShowStorageBreakdown(false)}
            onViewPlans={scrollToPlans}
          />
        )}
        {showEditsUsage && (
          <CreditsUsageModal
            isOpen={showEditsUsage}
            onClose={() => setShowEditsUsage(false)}
            onBuyCredits={() => {
              setShowEditsUsage(false);
              scrollToPlans();
            }}
          />
        )}
        {showCancelModal && (
          <CancelSubscriptionModal
            isOpen={showCancelModal}
            onClose={() => setShowCancelModal(false)}
            planName={currentPlan?.name || ""}
            periodEnd={subscription?.current_period_end || ""}
            onCancelled={() => {
              setShowCancelModal(false);
              refetch();
            }}
          />
        )}
        {downgradeTarget && (
          <DowngradeConfirmModal
            isOpen={!!downgradeTarget}
            onClose={() => setDowngradeTarget(null)}
            currentPlan={currentPlan!}
            targetPlan={downgradeTarget}
            periodEnd={subscription?.current_period_end || ""}
            storageUsedMb={storageUsedMb}
            onConfirmed={() => {
              setDowngradeTarget(null);
              refetch();
            }}
          />
        )}
        {showAddOnModal && (
          <AddOnModal
            isOpen={showAddOnModal}
            onClose={() => setShowAddOnModal(false)}
          />
        )}
        {paypalCheckoutPlan && (
          <PayPalCheckoutModal
            isOpen={!!paypalCheckoutPlan}
            onClose={() => setPaypalCheckoutPlan(null)}
            planSlug={paypalCheckoutPlan.slug}
            planName={paypalCheckoutPlan.name}
            billingCycle={billingCycle}
            onSuccess={() => {
              setPaypalCheckoutPlan(null);
              refetch();
              queryClient.invalidateQueries({ queryKey: ["invoices", effectiveUserId] });
              setSyncingCheckout(true);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
