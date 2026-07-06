import { useEffect, useRef, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Check } from "lucide-react";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    paypal?: any;
  }
}

interface CreditPack {
  id: string;
  credits: number;
  usd: number;
}

interface BuyCreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** How many credits the blocked action still needs — preselects the
   *  smallest sufficient pack and shows a "you're missing N" line. */
  neededCredits?: number;
  /** Called after a successful purchase (credits are already in the pool). */
  onSuccess?: (credits: number) => void;
}

/** The AI mark — 4-point sparkle (logo star), royal blue via currentColor. */
function Sparkle({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden style={{ display: "block" }}>
      <path
        d="M12 0 C12.9 7.2 16.8 11.1 24 12 C16.8 12.9 12.9 16.8 12 24 C11.1 16.8 7.2 12.9 0 12 C7.2 11.1 11.1 7.2 12 0 Z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * In-flow credit top-up: pick a pack, pay with the embedded PayPal buttons,
 * and the credits land in the pool immediately (purchased credits never
 * expire). Designed to be opened from any "insufficient credits" moment —
 * the caller's onSuccess can retry the blocked action without navigation.
 */
export function BuyCreditsModal({ isOpen, onClose, neededCredits, onSuccess }: BuyCreditsModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [packs, setPacks] = useState<CreditPack[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const buttonsRenderedRef = useRef(false);
  const selectedRef = useRef<string | null>(null);
  const queryClient = useQueryClient();
  selectedRef.current = selected;
  // Callback refs: parents pass inline closures, and putting them in the
  // effect deps would tear down + re-render the PayPal buttons on every
  // parent re-render (upload progress ticks!) mid-checkout.
  const onCloseRef = useRef(onClose);
  const onSuccessRef = useRef(onSuccess);
  onCloseRef.current = onClose;
  onSuccessRef.current = onSuccess;

  const fnUrl = (name: string) => `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`;

  const loadAndRender = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    setError(null);
    buttonsRenderedRef.current = false;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const authHeaders = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      };

      // One round-trip: catalog + PayPal clientId together.
      const catalogRes = await fetch(fnUrl("paypal-create-credits-order"), {
        method: "POST", headers: authHeaders, body: JSON.stringify({}),
      });
      const config = await catalogRes.json();
      if (!catalogRes.ok) throw new Error(config.error || "Failed to load credit packs");
      const loadedPacks: CreditPack[] = config.packs || [];
      setPacks(loadedPacks);

      // Preselect: smallest pack that covers the shortfall, else the middle one.
      const preferred = neededCredits
        ? loadedPacks.find((p) => p.credits >= neededCredits) ?? loadedPacks[loadedPacks.length - 1]
        : loadedPacks[1] ?? loadedPacks[0];
      setSelected((prev) => prev ?? preferred?.id ?? null);

      // Load the PayPal SDK for one-time capture (same pattern as add-ons).
      const expectedSrc = `https://www.paypal.com/sdk/js?client-id=${config.clientId}&intent=capture&currency=USD`;
      const existingScript = document.querySelector(`script[src^="${expectedSrc}"]`);
      if (!existingScript || !window.paypal?.Buttons) {
        document.querySelectorAll('script[src*="paypal.com/sdk"]').forEach((s) => s.remove());
        delete (window as any).paypal;
        await new Promise((r) => setTimeout(r, 100));
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = expectedSrc;
          script.setAttribute("data-sdk-integration-source", "button-factory");
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Failed to load PayPal SDK"));
          document.head.appendChild(script);
        });
        let retries = 0;
        while (!window.paypal?.Buttons && retries < 20) {
          await new Promise((r) => setTimeout(r, 300));
          retries++;
        }
      }
      if (!window.paypal?.Buttons) {
        throw new Error("PayPal SDK loaded but Buttons not available. Please try again.");
      }

      if (!containerRef.current || buttonsRenderedRef.current) return;
      containerRef.current.innerHTML = "";

      window.paypal.Buttons({
        style: { shape: "rect", color: "gold", layout: "vertical", label: "pay" },
        createOrder: async () => {
          const orderRes = await fetch(fnUrl("paypal-create-credits-order"), {
            method: "POST", headers: authHeaders,
            body: JSON.stringify({ packId: selectedRef.current }),
          });
          const orderData = await orderRes.json();
          if (!orderRes.ok) throw new Error(orderData.error || "Failed to create order");
          return orderData.orderId;
        },
        onApprove: async (data: any) => {
          const captureRes = await fetch(fnUrl("paypal-capture-credits"), {
            method: "POST", headers: authHeaders,
            body: JSON.stringify({ orderId: data.orderID }),
          });
          const captureData = await captureRes.json();
          if (!captureRes.ok) throw new Error(captureData.error || "Capture failed");

          // Refresh the balance everywhere before handing control back.
          await queryClient.invalidateQueries({ queryKey: ["user-subscription"] });
          await queryClient.invalidateQueries({ queryKey: ["user-credit-grants"] });
          toast.success(`${Number(captureData.credits).toLocaleString()} credits added to your account!`);
          onCloseRef.current();
          onSuccessRef.current?.(Number(captureData.credits) || 0);
        },
        onCancel: () => {
          toast.info("Payment was cancelled.");
        },
        onError: (err: any) => {
          console.error("PayPal credits error:", err);
          toast.error("Something went wrong with the payment.");
        },
      }).render(containerRef.current);

      buttonsRenderedRef.current = true;
    } catch (err: any) {
      console.error("Buy credits checkout error:", err);
      setError(err.message || "Failed to initialize checkout");
    } finally {
      setLoading(false);
    }
    // Callbacks intentionally excluded (see refs above); queryClient is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, neededCredits]);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(loadAndRender, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, loadAndRender]);

  const selectedPack = packs.find((p) => p.id === selected);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="surface-2 overflow-hidden p-0 sm:max-w-md sm:rounded-[--radius]">
        <div className="flex items-center justify-between gap-2 border-b border-border bg-background/40 px-4 py-2.5">
          <DialogHeader className="space-y-0">
            <DialogTitle asChild>
              <span className="aura-microlabel flex items-center gap-2">
                <Sparkle size={13} className="text-primary" />
                Buy credits
              </span>
            </DialogTitle>
            <DialogDescription className="sr-only">
              One-time credit purchase — credits never expire
            </DialogDescription>
          </DialogHeader>
          {selectedPack && <span className="folio text-sm text-foreground">${selectedPack.usd}</span>}
        </div>

        <div className="space-y-4 p-5">
          {typeof neededCredits === "number" && neededCredits > 0 && (
            <p className="rounded-[--radius] border border-primary/25 bg-primary/[0.06] px-3 py-2 text-sm">
              You're <strong className="folio">{neededCredits.toLocaleString()}</strong> credits short for this action.
            </p>
          )}

          {/* Pack picker */}
          {packs.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {packs.map((p) => {
                const on = p.id === selected;
                const covers = typeof neededCredits === "number" && neededCredits > 0 && p.credits >= neededCredits;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelected(p.id)}
                    className={cn(
                      "relative rounded-[--radius] border p-3 text-center transition-all",
                      on ? "border-primary bg-primary/10 ring-1 ring-inset ring-primary" : "border-border hover:border-primary/50",
                    )}
                  >
                    {on && (
                      <span className="absolute right-1.5 top-1.5 grid h-4 w-4 place-items-center rounded-full bg-primary text-primary-foreground">
                        <Check className="h-2.5 w-2.5" strokeWidth={3} />
                      </span>
                    )}
                    <div className="folio text-base font-bold">{p.credits.toLocaleString()}</div>
                    <div className="text-[11px] text-muted-foreground">credits</div>
                    <div className="mt-1 text-sm font-semibold">${p.usd}</div>
                    {covers && <div className="mt-0.5 text-[10px] font-medium text-primary">covers it</div>}
                  </button>
                );
              })}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            One-time payment · purchased credits <strong className="text-foreground">never expire</strong> and survive plan changes.
          </p>

          {loading && (
            <div className="flex flex-col items-center justify-center gap-3 py-8">
              <div className="grid h-12 w-12 place-items-center rounded-[--radius] bg-primary/10">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">Loading payment options...</p>
            </div>
          )}

          {error && (
            <div className="py-6 text-center">
              <p className="mb-2 text-sm text-destructive">{error}</p>
              <button className="text-sm font-medium text-primary hover:underline" onClick={loadAndRender}>
                Try again
              </button>
            </div>
          )}

          <div ref={containerRef} className={loading || error ? "hidden" : "min-h-[150px]"} />

          <div className="flex items-center justify-center gap-1.5 border-t border-border pt-3 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" style={{ color: "hsl(var(--secondary))" }} />
            <span>Secure payment powered by PayPal</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
