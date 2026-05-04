import { useState } from "react";
import { motion } from "framer-motion";
import { X, AlertTriangle, Wand2, Cloud, HeadphonesIcon, Sparkles, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface CancelSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  planName: string;
  periodEnd: string;
  onCancelled: () => void;
}

export function CancelSubscriptionModal({
  isOpen,
  onClose,
  planName,
  periodEnd,
  onCancelled,
}: CancelSubscriptionModalProps) {
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleCancel = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/paypal-cancel-subscription`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ reason: "User requested cancellation" }),
        }
      );
      const data = await res.json();
      if (res.ok) {
        toast.success("Subscription cancelled. Your features remain active until the end of your billing period.");
        onCancelled();
      } else {
        toast.error(data.error || "Failed to cancel subscription");
      }
    } catch (err) {
      toast.error("Failed to cancel subscription");
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
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center ring-1 ring-destructive/20">
              <ShieldX className="w-5 h-5 text-destructive" />
            </div>
            <h3 className="text-lg font-semibold">Cancel Subscription</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Warning banner */}
          <div className="p-4 rounded-xl bg-amber-500/8 border border-amber-500/20">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <p className="text-sm font-semibold text-amber-500">Are you sure?</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Your <strong className="text-foreground">{planName}</strong> features stay active until <strong className="text-foreground">{periodEnd}</strong>. After that you'll lose:
            </p>
          </div>

          {/* Lost features list */}
          <div className="space-y-2">
            {[
              { icon: Wand2, color: "text-violet-400", bg: "bg-violet-500/10", label: "Unlimited AI editing & culling" },
              { icon: Sparkles, color: "text-cyan-400", bg: "bg-cyan-500/10", label: "Custom AI models access" },
              { icon: Cloud, color: "text-sky-400", bg: "bg-sky-500/10", label: "Cloud storage (galleries become read-only)" },
              { icon: HeadphonesIcon, color: "text-emerald-400", bg: "bg-emerald-500/10", label: "Priority processing & support" },
            ].map(({ icon: Icon, color, bg, label }) => (
              <div key={label} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/40">
                <div className={`w-7 h-7 rounded-md ${bg} flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-3.5 h-3.5 ${color}`} />
                </div>
                <span className="text-sm text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={loading}>
              Keep Plan
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={handleCancel}
              disabled={loading}
            >
              {loading ? "Cancelling..." : "Cancel Subscription"}
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
