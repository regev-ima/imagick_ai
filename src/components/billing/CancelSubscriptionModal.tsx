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
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-border bg-background/40 px-4 py-2.5">
          <span className="aura-microlabel flex items-center gap-2" style={{ color: "hsl(var(--destructive))" }}>
            <ShieldX className="h-3.5 w-3.5" />
            Cancel Subscription
          </span>
          <button onClick={onClose} className="text-muted-foreground transition-colors hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {/* Warning banner */}
          <div
            className="rounded-[--radius] border bg-card p-4"
            style={{ borderColor: "hsl(var(--rating) / 0.4)" }}
          >
            <div className="mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" style={{ color: "hsl(var(--rating))" }} />
              <p className="text-sm font-semibold" style={{ color: "hsl(var(--rating))" }}>Are you sure?</p>
            </div>
            <p className="text-sm leading-snug text-muted-foreground">
              Your <strong className="text-foreground">{planName}</strong> features stay active until <strong className="text-foreground">{periodEnd}</strong>. After that you'll lose:
            </p>
          </div>

          {/* Lost features list */}
          <div className="space-y-2">
            {[
              { icon: Wand2, color: "hsl(var(--primary))", bg: "bg-primary/10", label: "Unlimited AI editing & culling" },
              { icon: Sparkles, color: "hsl(var(--accent))", bg: "bg-accent/10", label: "Custom AI models access" },
              { icon: Cloud, color: "hsl(var(--accent))", bg: "bg-accent/10", label: "Cloud storage (galleries become read-only)" },
              { icon: HeadphonesIcon, color: "hsl(var(--secondary))", bg: "bg-secondary/10", label: "Priority processing & support" },
            ].map(({ icon: Icon, color, bg, label }) => (
              <div key={label} className="flex items-center gap-3 rounded-[--radius] bg-muted/40 p-2.5">
                <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[--radius] ${bg}`}>
                  <Icon className="h-3.5 w-3.5" style={{ color }} />
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
