import { lazy, Suspense, useState, useRef, useEffect, type CSSProperties, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import {
  CreditCard,
  Zap,
  Check,
  Crown,
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
import { cn } from "@/lib/utils";
// Modals are only rendered after a user interaction, so lazy-load them so
// recharts (CreditsUsageModal) and the PayPal SDK loader stay out of the
// initial billing-page bundle.
const BillingHistoryModal = lazy(() =>
  import("@/components/billing/BillingHistoryModal").then(m => ({ default: m.BillingHistoryModal }))
);
const StorageBreakdownModal = lazy(() =>
  import("@/components/billing/StorageBreakdownModal").then(m => ({ default: m.StorageBreakdownModal }))
);
const CreditsUsageModal = lazy(() =>
  import("@/components/billing/CreditsUsageModal").then(m => ({ default: m.CreditsUsageModal }))
);
const CancelSubscriptionModal = lazy(() =>
  import("@/components/billing/CancelSubscriptionModal").then(m => ({ default: m.CancelSubscriptionModal }))
);
const DowngradeConfirmModal = lazy(() =>
  import("@/components/billing/DowngradeConfirmModal").then(m => ({ default: m.DowngradeConfirmModal }))
);
const AddOnModal = lazy(() =>
  import("@/components/billing/AddOnModal").then(m => ({ default: m.AddOnModal }))
);
const PayPalCheckoutModal = lazy(() =>
  import("@/components/billing/PayPalCheckoutModal").then(m => ({ default: m.PayPalCheckoutModal }))
);
import { useSubscription, type SubscriptionPlan } from "@/hooks/useSubscription";
import { useEffectiveUser } from "@/hooks/useImpersonation";
import { useInvoices } from "@/hooks/useInvoices";
import { downloadInvoicePdf } from "@/lib/download-invoice-pdf";
import { EDIT_LOW_THRESHOLD } from "@/lib/constants";
import { toast } from "sonner";

type CreditGrant = {
  id: string;
  status: string;
  expires_at: string | null;
  credits_remaining: number;
};

// LIGHTROOM motion — calm, responsive fades/slides. No bounce, no float.
const EASE: [number, number, number, number] = [0.22, 0.61, 0.36, 1];
const rise = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};

/**
 * The AI mark — a 4-point sparkle (the logo star). Royal blue by default.
 * Copied from the approved LightroomDashboard reference; tinted via
 * currentColor so it inherits text-primary / text-accent tokens.
 */
function Sparkle({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      style={{ display: "block" }}
    >
      <path
        d="M12 0 C12.9 7.2 16.8 11.1 24 12 C16.8 12.9 12.9 16.8 12 24 C11.1 16.8 7.2 12.9 0 12 C7.2 11.1 11.1 7.2 12 0 Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** A Lightroom-style tonal panel — hairline border, soft shadow. */
function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("glass-card overflow-hidden rounded-[--radius]", className)}>{children}</div>
  );
}

/** Mono section header — like a Lightroom module title bar. */
function PanelHeader({
  icon,
  label,
  trailing,
  tone = "muted",
}: {
  icon?: ReactNode;
  label: string;
  trailing?: ReactNode;
  tone?: "muted" | "ai";
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 border-b border-border px-4 py-2.5",
        tone === "ai" ? "bg-primary/[0.08] text-accent" : "bg-background/40 text-muted-foreground",
      )}
    >
      <span className="aura-microlabel flex items-center gap-2" style={tone === "ai" ? { color: "inherit" } : undefined}>
        {icon}
        {label}
      </span>
      {trailing}
    </div>
  );
}

/** A status banner — hairline keyline cell tinted to its tone. */
function StatusBanner({
  tone,
  icon,
  title,
  children,
  action,
}: {
  tone: "warning" | "error";
  icon: ReactNode;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  const accent = tone === "warning" ? "var(--rating)" : "var(--destructive)";
  return (
    <div
      className="flex items-center gap-3 rounded-[--radius] border bg-card px-4 py-3.5"
      style={{ borderColor: `hsl(${accent} / 0.4)` }}
    >
      <span style={{ color: `hsl(${accent})` }} className="shrink-0">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold" style={{ color: `hsl(${accent})` }}>
          {title}
        </p>
        <p className="mt-0.5 font-sans text-sm leading-snug text-muted-foreground">{children}</p>
      </div>
      {action}
    </div>
  );
}

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
  const editsRemainingPct = isUnlimited ? 100 : editsTotal > 0 ? (editsRemaining / editsTotal) * 100 : 0;
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
    <div className="min-h-full bg-background px-5 py-7 lg:px-10 lg:py-10">
      <div className="mx-auto w-full max-w-[1320px] space-y-7">
        {/* ════ MASTHEAD ═══════════════════════════════════════════════════ */}
        <motion.header variants={rise} initial="hidden" animate="show">
          <div className="flex items-center justify-between gap-4 pb-3">
            <span className="caption">Account — billing &amp; usage</span>
            {currentPlan && (
              <span className="caption flex items-center gap-1.5 text-foreground">
                <Zap className="h-3 w-3 text-accent" />
                {currentPlan.name}
              </span>
            )}
          </div>
          <hr className="aura-hairline" />
          <h1 className="mt-6 text-3xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-4xl">
            Billing &amp; <span className="text-accent">Usage</span>
          </h1>
          <p className="mt-2 font-sans text-base text-muted-foreground">
            Manage your subscription and monitor usage.
          </p>
        </motion.header>

        {/* ════ STATUS BANNERS ═════════════════════════════════════════════ */}
        {isCancelling && (
          <StatusBanner
            tone="warning"
            icon={<AlertTriangle className="h-5 w-5" />}
            title="Subscription cancelling"
          >
            Your {currentPlan?.name} plan remains active until {subscription?.current_period_end || "the end of your billing period"}.
          </StatusBanner>
        )}

        {isSuspended && (
          <StatusBanner
            tone="error"
            icon={<XCircle className="h-5 w-5" />}
            title="Payment failed"
          >
            Your subscription is suspended due to a payment failure. Please update your payment method.
          </StatusBanner>
        )}

        {isExpired && (
          <StatusBanner
            tone="error"
            icon={<XCircle className="h-5 w-5" />}
            title="Subscription expired"
            action={<Button size="sm" onClick={scrollToPlans}>Upgrade Now</Button>}
          >
            Your subscription has expired. Upgrade to continue uploading and editing photos.
          </StatusBanner>
        )}

        {isFreePlan && !isUnlimited && editsRemaining <= EDIT_LOW_THRESHOLD && editsRemaining > 0 && (
          <StatusBanner
            tone="warning"
            icon={<AlertTriangle className="h-5 w-5" />}
            title="Running low on edits"
            action={<Button size="sm" variant="outline" onClick={scrollToPlans}>View Plans</Button>}
          >
            You have {editsRemaining.toLocaleString()} edits remaining. Upgrade for unlimited edits.
          </StatusBanner>
        )}

        {isFreePlan && editsRemaining === 0 && (
          <StatusBanner
            tone="error"
            icon={<XCircle className="h-5 w-5" />}
            title="All free edits used"
            action={<Button size="sm" onClick={scrollToPlans}>Upgrade Now</Button>}
          >
            You've used all 3,000 free edits. Upgrade to a paid plan for unlimited editing.
          </StatusBanner>
        )}

        {/* ════ CURRENT PLAN ═══════════════════════════════════════════════ */}
        <motion.section variants={rise} initial="hidden" animate="show">
          <Panel className="border-primary/30">
            <PanelHeader
              icon={<Crown className="h-3.5 w-3.5" />}
              label="Current plan"
              trailing={
                <span className="caption flex items-center gap-1.5" style={{ color: "inherit" }}>
                  <span
                    className="aura-led"
                    style={{ "--led": isPaidPlan ? "var(--secondary)" : "var(--muted-foreground)" } as CSSProperties}
                  />
                  {isPaidPlan ? "Active" : isCancelling ? "Cancelling" : "Free"}
                </span>
              }
            />
            <div className="flex flex-col gap-6 p-5 md:flex-row md:items-center">
              {/* Plan identity */}
              <div className="flex flex-1 items-center gap-4">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-[--radius] bg-primary text-primary-foreground">
                  <Crown className="h-7 w-7" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-semibold tracking-tight">{currentPlan?.name || "Free"}</h2>
                    {isPaidPlan && (
                      <span className="caption rounded-sm border border-secondary/40 bg-secondary/10 px-1.5 py-0.5" style={{ color: "hsl(var(--secondary))" }}>
                        Active
                      </span>
                    )}
                    {isCancelling && (
                      <span className="caption rounded-sm border px-1.5 py-0.5" style={{ color: "hsl(var(--rating))", borderColor: "hsl(var(--rating) / 0.4)", background: "hsl(var(--rating) / 0.1)" }}>
                        Cancelling
                      </span>
                    )}
                  </div>
                  <p className="folio mt-1 text-lg text-muted-foreground">{priceDisplay}</p>
                </div>
              </div>

              {/* Plan meta */}
              <div className="flex items-center gap-6 text-sm">
                {isPaidPlan && (
                  <div className="flex items-center gap-2.5">
                    <div className="grid h-9 w-9 place-items-center rounded-[--radius] bg-primary/10">
                      <CalendarDays className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="caption">{isCancelling ? "Active until" : "Next billing"}</p>
                      <p className="mt-0.5 font-mono text-sm text-foreground">{subscription?.current_period_end || "—"}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2.5">
                  <div className="grid h-9 w-9 place-items-center rounded-[--radius] bg-secondary/10">
                    <ShieldCheck className="h-4 w-4" style={{ color: "hsl(var(--secondary))" }} />
                  </div>
                  <div>
                    <p className="caption">Payment</p>
                    <p className="mt-0.5 font-mono text-sm text-foreground">{subscription?.paypal_subscription_id ? "PayPal" : "None"}</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex shrink-0 items-center gap-2">
                {isPaidPlan && !isCancelling && (
                  <>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowAddOnModal(true)}>
                      <Package className="h-3.5 w-3.5" /> Add-ons
                    </Button>
                    <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setShowCancelModal(true)}>
                      Cancel
                    </Button>
                  </>
                )}
                {isFreePlan && (
                  <Button size="sm" className="gap-1.5" onClick={scrollToPlans}>
                    <TrendingUp className="h-3.5 w-3.5" /> Upgrade Plan
                  </Button>
                )}
              </div>
            </div>
          </Panel>
        </motion.section>

        {/* ════ USAGE METERS ═══════════════════════════════════════════════ */}
        <motion.section variants={rise} initial="hidden" animate="show" className="grid gap-6 sm:grid-cols-2">
          {/* AI Edits */}
          <Panel
            className={cn(
              "group cursor-pointer transition-colors",
              giftCreditsTotal > 0 && !isUnlimited
                ? "border-secondary/40 hover:border-secondary/60"
                : "hover:border-primary/40",
            )}
          >
            <button type="button" className="block w-full text-left" onClick={() => setShowEditsUsage(true)}>
              <PanelHeader
                tone={giftCreditsTotal > 0 && !isUnlimited ? "muted" : "ai"}
                icon={
                  giftCreditsTotal > 0 && !isUnlimited ? (
                    <Gift className="h-3.5 w-3.5" style={{ color: "hsl(var(--secondary))" }} />
                  ) : (
                    <Sparkle size={12} className="text-accent" />
                  )
                }
                label="AI Edits"
                trailing={
                  <span className="flex items-center gap-2" style={{ color: "inherit" }}>
                    <span className="caption" style={{ color: "inherit" }}>
                      {isUnlimited ? "Unlimited" : "Lifetime balance"}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground" />
                  </span>
                }
              />
              <div className="p-5">
                {isUnlimited ? (
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="folio text-4xl leading-none text-foreground sm:text-[2.75rem]">
                        {editsUsed.toLocaleString()}
                      </p>
                      <p className="caption mt-3">edits used this period</p>
                      <p className="mt-1.5 font-mono text-[11px] text-muted-foreground">no cap</p>
                    </div>
                    <p className="folio text-4xl leading-none text-accent">∞</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="folio text-4xl leading-none text-foreground sm:text-[2.75rem]">
                          {editsRemaining.toLocaleString()}
                        </p>
                        <p className="caption mt-3">edits remaining</p>
                      </div>
                      <div className="relative h-11 w-11 shrink-0">
                        <div
                          className="aura-gauge absolute inset-0"
                          style={{ "--gauge": Math.round(editsRemainingPct) } as CSSProperties}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                        <span>{editsUsed.toLocaleString()} used</span>
                        <span className="flex items-center gap-1">
                          {editsTotal.toLocaleString()}
                          {giftCreditsTotal > 0 && (
                            <>
                              {" + "}
                              <Gift className="inline h-3 w-3" style={{ color: "hsl(var(--secondary))" }} />
                              {giftCreditsTotal.toLocaleString()}
                            </>
                          )}
                          {" total"}
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-accent"
                          style={{ width: `${Math.min(100, editsPercentage)}%` }}
                        />
                      </div>
                    </div>
                    {giftCreditsTotal > 0 && (
                      <div className="space-y-1 border-t border-border pt-3">
                        {activeCreditGrants.map((grant) => (
                          <div key={grant.id} className="flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Gift className="h-3 w-3" style={{ color: "hsl(var(--secondary))" }} />
                              Gift credits
                              <span className="text-[10px]">
                                (expires {new Date(grant.expires_at!).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })})
                              </span>
                            </span>
                            <span className="font-semibold" style={{ color: "hsl(var(--secondary))" }}>{grant.credits_remaining.toLocaleString()}</span>
                          </div>
                        ))}
                        <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                          <span>Plan credits</span>
                          <span className="font-semibold text-foreground">{planCreditsRemaining.toLocaleString()}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </button>
          </Panel>

          {/* Storage */}
          <Panel className="group cursor-pointer transition-colors hover:border-primary/40">
            <button type="button" className="block w-full text-left" onClick={() => setShowStorageBreakdown(true)}>
              <PanelHeader
                icon={<HardDrive className="h-3.5 w-3.5" />}
                label="Storage"
                trailing={
                  <span className="flex items-center gap-2">
                    <span className="caption">Cloud storage</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground" />
                  </span>
                }
              />
              <div className="p-5">
                <div className="space-y-4">
                  <div className="flex items-baseline gap-2">
                    <p className="folio text-4xl leading-none text-foreground sm:text-[2.75rem]">{storageUsedGb.toFixed(1)}</p>
                    <p className="font-mono text-sm text-muted-foreground">
                      GB of{" "}
                      {extraStorageGb > 0
                        ? `${(currentPlan?.max_storage_gb || 5) + extraStorageGb} GB`
                        : `${maxStorageGb} GB`}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                      <span>
                        {storageUsedMb < 1024
                          ? `${Math.round(storageUsedMb)} MB`
                          : `${storageUsedGb.toFixed(2)} GB`}{" "}
                        used
                      </span>
                      <span>{maxStorageGb} GB total</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${Math.min(100, storagePercentage)}%` }}
                      />
                    </div>
                  </div>
                  {extraStorageGb > 0 && (
                    <p className="font-mono text-[11px] text-muted-foreground">
                      Includes {extraStorageGb} GB from add-ons
                    </p>
                  )}
                </div>
              </div>
            </button>
          </Panel>
        </motion.section>

        {/* ════ ACTIVE ADD-ONS ═════════════════════════════════════════════ */}
        {activeAddons.length > 0 && (
          <motion.section variants={rise} initial="hidden" animate="show">
            <Panel>
              <PanelHeader icon={<Package className="h-3.5 w-3.5" />} label="Active add-ons" />
              <div className="grid gap-px overflow-hidden bg-border sm:grid-cols-2 lg:grid-cols-3">
                {extraModels > 0 && (
                  <div className="flex items-center gap-3 bg-card p-4">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[--radius] bg-primary/10">
                      <Sparkle size={16} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium tracking-tight">Custom AI Models</p>
                      <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                        {currentPlan?.max_styles || 0} + {extraModels} = {maxStyles} total
                      </p>
                    </div>
                  </div>
                )}
                {extraStorageGb > 0 && (
                  <div className="flex items-center gap-3 bg-card p-4">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[--radius] bg-accent/10">
                      <HardDrive className="h-4 w-4 text-accent" />
                    </div>
                    <div>
                      <p className="text-sm font-medium tracking-tight">Extra Storage</p>
                      <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                        {currentPlan?.max_storage_gb || 5} GB + {extraStorageGb} GB purchased
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </Panel>
          </motion.section>
        )}

        {/* ════ BILLING HISTORY ════════════════════════════════════════════ */}
        <motion.section variants={rise} initial="hidden" animate="show">
          <Panel>
            <PanelHeader
              icon={<Receipt className="h-3.5 w-3.5" />}
              label="Billing history"
              trailing={
                invoices.length > 0 ? (
                  <button
                    type="button"
                    className="group inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground transition-colors hover:text-accent"
                    onClick={() => setShowBillingHistory(true)}
                  >
                    View all
                    <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </button>
                ) : undefined
              }
            />
            {invoices.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
                <div className="grid h-12 w-12 place-items-center rounded-[--radius] border border-border bg-card">
                  <Receipt className="h-5 w-5" />
                </div>
                <p className="font-sans text-sm">
                  {isPaidPlan ? "Your invoices will appear here after your first payment." : "Upgrade to a paid plan to see billing history."}
                </p>
              </div>
            ) : (
              <div>
                {/* Mono table header */}
                <div className="hidden grid-cols-[1fr_auto_auto_2.5rem] items-center gap-4 border-b border-border px-5 py-2.5 sm:grid">
                  <span className="aura-microlabel">Description</span>
                  <span className="aura-microlabel text-right">Amount</span>
                  <span className="aura-microlabel text-right">Status</span>
                  <span />
                </div>
                <ul className="divide-y divide-border">
                  {invoices.slice(0, 3).map((inv) => (
                    <li
                      key={inv.id}
                      className="grid grid-cols-[1fr_auto_2.5rem] items-center gap-4 px-5 py-3.5 transition-colors hover:bg-foreground/[0.03] sm:grid-cols-[1fr_auto_auto_2.5rem]"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[--radius] border border-border bg-card">
                          <CreditCard className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium tracking-tight">{inv.description}</p>
                          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                            {new Date(inv.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </p>
                        </div>
                      </div>
                      <p className="folio text-right text-sm text-foreground">${inv.amount.toFixed(2)}</p>
                      <span
                        className="caption hidden justify-self-end rounded-sm border px-1.5 py-0.5 sm:inline-flex"
                        style={
                          inv.status === "paid"
                            ? { color: "hsl(var(--secondary))", borderColor: "hsl(var(--secondary) / 0.4)", background: "hsl(var(--secondary) / 0.1)" }
                            : { color: "hsl(var(--rating))", borderColor: "hsl(var(--rating) / 0.4)", background: "hsl(var(--rating) / 0.1)" }
                        }
                      >
                        {inv.status}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 justify-self-end text-muted-foreground hover:text-foreground"
                        disabled={downloadingInvoiceId === inv.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadInvoice(inv);
                        }}
                      >
                        {downloadingInvoiceId === inv.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Panel>
        </motion.section>

        {/* ════ PLANS ══════════════════════════════════════════════════════ */}
        <motion.section ref={plansRef} variants={rise} initial="hidden" animate="show" className="pt-2">
          <div className="text-center">
            <h2 className="text-2xl font-semibold tracking-tight">Simple pricing for photographers</h2>
            <p className="mt-1.5 font-sans text-base text-muted-foreground">
              Focus on shooting, not editing. Every paid plan includes unlimited AI editing.
            </p>
          </div>

          {/* Unlimited Strip */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 rounded-[--radius] border border-primary/25 bg-primary/[0.06] px-4 py-3">
            <span className="flex items-center gap-1.5 text-sm font-medium">
              <InfinityIcon className="h-4 w-4 text-primary" /> AI Editing
            </span>
            <span className="flex items-center gap-1.5 text-sm font-medium">
              <InfinityIcon className="h-4 w-4 text-primary" /> Culling &amp; Grouping
            </span>
            <span className="flex items-center gap-1.5 text-sm font-medium">
              <InfinityIcon className="h-4 w-4 text-primary" /> Galleries
            </span>
            <span className="aura-microlabel">Included in every paid plan</span>
          </div>

          {/* Billing cycle toggle */}
          <div className="mt-6 flex items-center justify-end">
            <div className="flex items-center gap-1 rounded-[--radius] border border-border bg-card p-1">
              <button
                onClick={() => setBillingCycle("monthly")}
                className={cn(
                  "rounded-sm px-4 py-2 font-mono text-xs uppercase tracking-wide transition-colors",
                  billingCycle === "monthly"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle("yearly")}
                className={cn(
                  "rounded-sm px-4 py-2 font-mono text-xs uppercase tracking-wide transition-colors",
                  billingCycle === "yearly"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Yearly
                <span className={cn("ml-1.5", billingCycle === "yearly" ? "text-primary-foreground" : "text-accent")}>-20%</span>
              </button>
            </div>
          </div>

          {/* Plan comparison cells */}
          <div className="mt-6 grid gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
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
                  whileHover={{ y: -3 }}
                  transition={{ duration: 0.2, ease: EASE }}
                  className={cn(
                    "relative flex flex-col rounded-[--radius] border bg-card p-6 transition-colors",
                    isPopular
                      ? "border-primary shadow-[var(--elevation-2)]"
                      : isCurrentPlan
                        ? "border-secondary/50"
                        : "border-border hover:border-muted-foreground/40",
                  )}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-primary px-3 py-1 text-primary-foreground shadow-[var(--elevation-2)]">
                      <Sparkle size={11} />
                      <span className="font-mono text-[10px] font-semibold uppercase tracking-wide">Most Popular</span>
                    </div>
                  )}

                  <div className="mb-4 flex items-center justify-between gap-2">
                    <h3 className="text-lg font-semibold tracking-tight">{plan.name}</h3>
                    {isCurrentPlan && (
                      <span
                        className="caption rounded-sm border px-1.5 py-0.5"
                        style={{ color: "hsl(var(--secondary))", borderColor: "hsl(var(--secondary) / 0.4)", background: "hsl(var(--secondary) / 0.1)" }}
                      >
                        Current
                      </span>
                    )}
                  </div>

                  <div className="flex h-[72px] flex-col justify-start">
                    <div className="flex items-baseline">
                      {billingCycle === "yearly" && priceMonthly > 0 && (
                        <span className="folio mr-1.5 text-lg text-muted-foreground line-through">${priceMonthly}</span>
                      )}
                      <span className="folio text-3xl text-foreground">
                        {billingCycle === "yearly" && priceYearly > 0
                          ? `$${monthlyEquivalent}`
                          : `$${priceMonthly}`}
                      </span>
                      <span className="ml-1 font-mono text-sm text-muted-foreground">/Month</span>
                    </div>
                    {billingCycle === "yearly" && priceYearly > 0 && (
                      <p className="mt-1 font-mono text-[11px] text-muted-foreground">*Billed annually (${priceYearly}/yr)</p>
                    )}
                  </div>

                  <Button
                    variant={getPlanButtonVariant(plan)}
                    className="mb-6 w-full gap-1"
                    disabled={isCurrentPlan}
                    onClick={() => handleSelectPlan(plan)}
                  >
                    {getPlanButtonLabel(plan)}
                    {!isCurrentPlan && plan.sort_order > (currentPlan?.sort_order ?? 0) && (
                      <ArrowUpRight className="h-4 w-4" />
                    )}
                    {!isCurrentPlan && plan.slug !== "free" && plan.sort_order < (currentPlan?.sort_order ?? 0) && (
                      <ArrowDownRight className="h-4 w-4" />
                    )}
                  </Button>

                  <p className="aura-microlabel mb-3">Plan includes</p>

                  <ul className="mb-2 flex-1 space-y-3">
                    {features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
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
          <div className="mt-8 rounded-[--radius] border border-dashed border-border bg-card/40 p-6 text-center">
            <div className="mb-2 flex items-center justify-center gap-2">
              <Store className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold tracking-tight">AI Style Marketplace</h3>
              <span className="caption rounded-sm border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-primary">
                Coming Soon
              </span>
            </div>
            <p className="mx-auto max-w-md font-sans text-sm text-muted-foreground">
              Buy and sell custom AI editing styles created by photographers. Share your unique look with the community.
            </p>
          </div>
        </motion.section>
      </div>

      {/* Modals (lazy-loaded; rendered only after user interaction) */}
      <AnimatePresence>
        <Suspense fallback={null}>
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
        </Suspense>
      </AnimatePresence>
    </div>
  );
}
