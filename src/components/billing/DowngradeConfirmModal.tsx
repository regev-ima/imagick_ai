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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="glass-card w-full max-w-md mx-4 p-6 rounded-xl border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <ArrowDownRight className="w-5 h-5" />
            Downgrade Plan
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <div className="text-center flex-1">
              <p className="text-sm text-muted-foreground">Current</p>
              <p className="font-bold">{currentPlan.name}</p>
              <p className="text-sm text-muted-foreground">${currentPlan.price_monthly}/mo</p>
            </div>
            <ArrowDownRight className="w-5 h-5 text-muted-foreground" />
            <div className="text-center flex-1">
              <p className="text-sm text-muted-foreground">New</p>
              <p className="font-bold">{targetPlan.name}</p>
              <p className="text-sm text-muted-foreground">${targetPlan.price_monthly}/mo</p>
            </div>
          </div>

          <div className="text-sm text-muted-foreground space-y-2">
            <p>The downgrade will take effect on <strong>{periodEnd}</strong>.</p>
            <p>Your current {currentPlan.name} features remain active until then.</p>
          </div>

          {storageOverLimit && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
              <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-yellow-500">Storage warning</p>
                <p className="text-muted-foreground">
                  You're using {storageUsedGb.toFixed(1)} GB but the {targetPlan.name} plan only includes {targetPlan.max_storage_gb} GB.
                  Please free up storage before the switch date.
                </p>
              </div>
            </div>
          )}

          {currentPlan.max_styles > targetPlan.max_styles && targetPlan.max_styles >= 0 && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
              <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-yellow-500">Custom AI Models</p>
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
