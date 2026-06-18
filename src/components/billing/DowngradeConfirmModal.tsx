import { useState } from "react";
import { motion } from "framer-motion";
import { X, AlertTriangle, ArrowDownRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { SubscriptionPlan } from "@/hooks/useSubscription";

interface DowngradeConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlan: SubscriptionPlan;
  targetPlan: SubscriptionPlan;
  periodEnd: string;
  storageUsedMb: number;
  onConfirmed: () => void;
}

export function DowngradeConfirmModal({
  isOpen,
  onClose,
  currentPlan,
  targetPlan,
  periodEnd,
  storageUsedMb,
  onConfirmed,
}: DowngradeConfirmModalProps) {
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const storageUsedGb = storageUsedMb / 1024;
  const storageOverLimit = storageUsedGb > targetPlan.max_storage_gb;

  const handleDowngrade = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/paypal-change-plan`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ targetPlanSlug: targetPlan.slug }),
        }
      );
      const data = await res.json();
      if (res.ok) {
        toast.success(`Downgrade scheduled. Your ${currentPlan.name} plan remains active until ${periodEnd}.`);
        onConfirmed();
      } else {
        toast.error(data.error || "Failed to schedule downgrade");
      }
    } catch (err) {
      toast.error("Failed to schedule downgrade");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.97, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.97, opacity: 0 }}
        className="glass-card surface-2 w-full max-w-md overflow-hidden rounded-[--radius] border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border bg-background/40 px-4 py-2.5">
          <span className="aura-microlabel flex items-center gap-2">
            <ArrowDownRight className="h-3.5 w-3.5" />
            Downgrade Plan
          </span>
          <button onClick={onClose} className="text-muted-foreground transition-colors hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="flex items-center gap-3 rounded-[--radius] border border-border bg-card p-3">
            <div className="flex-1 text-center">
              <p className="caption">Current</p>
              <p className="mt-1 font-semibold tracking-tight">{currentPlan.name}</p>
              <p className="folio text-sm text-muted-foreground">${currentPlan.price_monthly}/mo</p>
            </div>
            <ArrowDownRight className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1 text-center">
              <p className="caption">New</p>
              <p className="mt-1 font-semibold tracking-tight">{targetPlan.name}</p>
              <p className="folio text-sm text-muted-foreground">${targetPlan.price_monthly}/mo</p>
            </div>
          </div>

          <div className="space-y-2 text-sm text-muted-foreground">
            <p>The downgrade will take effect on <strong className="text-foreground">{periodEnd}</strong>.</p>
            <p>Your current {currentPlan.name} features remain active until then.</p>
          </div>

          {storageOverLimit && (
            <div
              className="flex items-start gap-3 rounded-[--radius] border bg-card p-3"
              style={{ borderColor: "hsl(var(--rating) / 0.4)" }}
            >
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" style={{ color: "hsl(var(--rating))" }} />
              <div className="text-sm">
                <p className="font-semibold" style={{ color: "hsl(var(--rating))" }}>Storage warning</p>
                <p className="text-muted-foreground">
                  You're using {storageUsedGb.toFixed(1)} GB but the {targetPlan.name} plan only includes {targetPlan.max_storage_gb} GB.
                  Please free up storage before the switch date.
                </p>
              </div>
            </div>
          )}

          {currentPlan.max_styles > targetPlan.max_styles && targetPlan.max_styles >= 0 && (
            <div
              className="flex items-start gap-3 rounded-[--radius] border bg-card p-3"
              style={{ borderColor: "hsl(var(--rating) / 0.4)" }}
            >
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" style={{ color: "hsl(var(--rating))" }} />
              <div className="text-sm">
                <p className="font-semibold" style={{ color: "hsl(var(--rating))" }}>Custom AI Models</p>
                <p className="text-muted-foreground">
                  Your current plan includes {currentPlan.max_styles} custom model{currentPlan.max_styles > 1 ? "s" : ""} but {targetPlan.name} includes {targetPlan.max_styles || "none"}.
                  {targetPlan.max_styles === 0 && " Existing models will become inactive."}
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={loading}>
              Keep {currentPlan.name}
            </Button>
            <Button className="flex-1" onClick={handleDowngrade} disabled={loading}>
              {loading ? "Scheduling..." : "Confirm Downgrade"}
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
