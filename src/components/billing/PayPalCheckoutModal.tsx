import { useEffect, useRef, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Crown, Sparkles, CreditCard } from "lucide-react";

declare global {
  interface Window {
    paypal?: any;
  }
}

interface PayPalCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  planSlug: string;
  planName: string;
  billingCycle: "monthly" | "yearly";
  onSuccess: () => void;
}

export function PayPalCheckoutModal({
  isOpen,
  onClose,
  planSlug,
  planName,
  billingCycle,
  onSuccess,
}: PayPalCheckoutModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scriptLoadedRef = useRef(false);
  const buttonsRenderedRef = useRef(false);
  const abortedRef = useRef(false);

  const loadAndRender = useCallback(async () => {
    if (!isOpen) return;
    abortedRef.current = false;
    setLoading(true);
    setError(null);
    buttonsRenderedRef.current = false;

    try {
      // 1. Get client ID + plan ID + user ID from backend
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) throw new Error("Not authenticated");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/paypal-client-token`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ planSlug, billingCycle }),
        }
      );
      const tokenData = await res.json();
      if (abortedRef.current) return;
      if (!res.ok) throw new Error(tokenData.error || "Failed to get PayPal config");

      const { clientId, paypalPlanId } = tokenData;

      // 2. Load PayPal SDK
      // Reuse existing SDK if already loaded with Buttons available
      const expectedSrc = `https://www.paypal.com/sdk/js?client-id=${clientId}&vault=true&intent=subscription`;
      const existingScript = document.querySelector(`script[src^="${expectedSrc}"]`);

      if (!existingScript || !window.paypal?.Buttons) {
        // Remove old PayPal scripts and state to start fresh
        document.querySelectorAll('script[src*="paypal.com/sdk"]').forEach(s => s.remove());
        delete (window as any).paypal;
        scriptLoadedRef.current = false;

        // Small delay to allow cleanup
        await new Promise(r => setTimeout(r, 100));

        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = expectedSrc;
          script.setAttribute("data-sdk-integration-source", "button-factory");
          script.onload = () => {
            scriptLoadedRef.current = true;
            resolve();
          };
          script.onerror = () => reject(new Error("Failed to load PayPal SDK"));
          document.head.appendChild(script);
        });

        // Wait for Buttons to become available (SDK initializes async)
        let retries = 0;
        while (!window.paypal?.Buttons && retries < 20 && !abortedRef.current) {
          await new Promise(r => setTimeout(r, 300));
          retries++;
        }
      }

      if (abortedRef.current) return;
      if (!window.paypal?.Buttons) {
        throw new Error("PayPal SDK loaded but Buttons component is not available. Please try again or check your network connection.");
      }

      // 4. Render buttons
      if (!containerRef.current || buttonsRenderedRef.current || abortedRef.current) return;
      containerRef.current.innerHTML = "";

      window.paypal.Buttons({
        style: {
          shape: "rect",
          color: "gold",
          layout: "vertical",
          label: "subscribe",
        },
        createSubscription: (_data: any, actions: any) => {
          return actions.subscription.create({
            plan_id: paypalPlanId,
            custom_id: userId,
          });
        },
        onApprove: async (data: any) => {
          console.log("PayPal subscription approved:", data.subscriptionID);
          toast.success("Subscription activated! Updating your plan...");
          onClose();
          
          // Poll for subscription update (webhook may take a few seconds)
          let attempts = 0;
          const maxAttempts = 10;
          const poll = async () => {
            attempts++;
            const { data: sub } = await supabase
              .from("user_subscriptions")
              .select("plan_id, subscription_plans!inner(slug)")
              .eq("user_id", userId)
              .maybeSingle();
            
            const currentSlug = (sub as any)?.subscription_plans?.slug;
            if (currentSlug && currentSlug !== "free") {
              onSuccess();
              return;
            }
            
            if (attempts < maxAttempts) {
              setTimeout(poll, 2000);
            } else {
              onSuccess();
            }
          };
          setTimeout(poll, 2000);
        },
        onCancel: () => {
          toast.info("Checkout was cancelled.");
          onClose();
        },
        onError: (err: any) => {
          console.error("PayPal error:", err);
          toast.error("Something went wrong with the payment window. If you were charged, your plan will update automatically within a few minutes.");
          onClose();
        },
      }).render(containerRef.current);

      buttonsRenderedRef.current = true;
    } catch (err: any) {
      if (abortedRef.current) return;
      console.error("PayPal checkout error:", err);
      setError(err.message || "Failed to initialize PayPal checkout");
    } finally {
      if (!abortedRef.current) setLoading(false);
    }
  }, [isOpen, planSlug, billingCycle, onSuccess, onClose]);

  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure the DOM container is mounted
      const timer = setTimeout(loadAndRender, 100);
      return () => {
        clearTimeout(timer);
        abortedRef.current = true;
      };
    }
  }, [isOpen, loadAndRender]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        {/* Header with gradient */}
        <div className="relative px-6 pt-6 pb-4 bg-gradient-to-b from-primary/5 to-transparent">
          <DialogHeader className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 flex items-center justify-center ring-1 ring-amber-500/20">
                <Crown className="w-5 h-5 text-amber-500" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base sm:text-lg truncate">Subscribe to {planName}</DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  {billingCycle === "yearly" ? "Annual" : "Monthly"} billing
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Plan highlight chip */}
          <div className="mt-4 flex items-center gap-2 p-2.5 rounded-lg bg-muted/60 border border-border/50">
            <Sparkles className="w-4 h-4 text-primary flex-shrink-0" />
            <span className="text-sm text-muted-foreground">
              Complete your payment below to unlock <strong className="text-foreground">{planName}</strong> features
            </span>
          </div>
        </div>

        <div className="px-6 pb-6 space-y-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">Preparing secure checkout...</p>
            </div>
          )}

          {error && (
            <div className="text-center py-8 space-y-3">
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                <CreditCard className="w-5 h-5 text-destructive" />
              </div>
              <p className="text-sm text-destructive">{error}</p>
              <button
                className="text-sm text-primary hover:underline font-medium"
                onClick={loadAndRender}
              >
                Try again
              </button>
            </div>
          )}

          <div
            ref={containerRef}
            className={loading || error ? "hidden" : "min-h-[150px]"}
          />

          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-3 border-t border-border/50">
            <div className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <ShieldCheck className="w-3 h-3 text-emerald-500" />
            </div>
            <span>Secure payment powered by PayPal</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
