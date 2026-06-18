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
      <DialogContent className="surface-2 overflow-hidden p-0 sm:max-w-md sm:rounded-[--radius]">
        {/* Mono header — Lightroom module title bar */}
        <div className="flex items-center justify-between gap-2 border-b border-border bg-primary/[0.08] px-4 py-2.5 text-accent">
          <DialogHeader className="space-y-0">
            <DialogTitle asChild>
              <span className="aura-microlabel flex items-center gap-2" style={{ color: "inherit" }}>
                <Crown className="h-3.5 w-3.5" />
                Subscribe to {planName}
              </span>
            </DialogTitle>
            <DialogDescription className="sr-only">
              {billingCycle === "yearly" ? "Annual" : "Monthly"} billing
            </DialogDescription>
          </DialogHeader>
          <span className="caption" style={{ color: "inherit" }}>
            {billingCycle === "yearly" ? "Annual" : "Monthly"}
          </span>
        </div>

        <div className="space-y-4 p-5">
          {/* Plan identity */}
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[--radius] bg-primary text-primary-foreground">
              <Crown className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold tracking-tight">{planName}</p>
              <p className="folio text-sm text-muted-foreground">
                {billingCycle === "yearly" ? "Annual" : "Monthly"} billing
              </p>
            </div>
          </div>

          {/* Plan highlight chip */}
          <div className="flex items-center gap-2 rounded-[--radius] border border-primary/25 bg-primary/[0.06] p-2.5">
            <Sparkles className="h-4 w-4 flex-shrink-0 text-primary" />
            <span className="text-sm text-muted-foreground">
              Complete your payment below to unlock <strong className="text-foreground">{planName}</strong> features
            </span>
          </div>

          {loading && (
            <div className="flex flex-col items-center justify-center gap-3 py-10">
              <div className="grid h-12 w-12 place-items-center rounded-[--radius] bg-primary/10">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">Preparing secure checkout...</p>
            </div>
          )}

          {error && (
            <div className="space-y-3 py-8 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-[--radius] bg-destructive/10">
                <CreditCard className="h-5 w-5 text-destructive" />
              </div>
              <p className="text-sm text-destructive">{error}</p>
              <button
                className="text-sm font-medium text-primary hover:underline"
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

          <div className="flex items-center justify-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" style={{ color: "hsl(var(--secondary))" }} />
            <span>Secure payment powered by PayPal</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
