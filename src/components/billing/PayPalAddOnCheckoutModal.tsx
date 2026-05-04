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
import { Loader2, ShieldCheck } from "lucide-react";

declare global {
  interface Window {
    paypal?: any;
  }
}

interface PayPalAddOnCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  addonType: string;
  addonLabel: string;
  addonPrice: number;
  onSuccess: () => void;
}

export function PayPalAddOnCheckoutModal({
  isOpen,
  onClose,
  addonType,
  addonLabel,
  addonPrice,
  onSuccess,
}: PayPalAddOnCheckoutModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const buttonsRenderedRef = useRef(false);

  const loadAndRender = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    setError(null);
    buttonsRenderedRef.current = false;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // Get clientId from backend (inline mode)
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/paypal-create-addon-order`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ addonType, quantity: 1, inline: true }),
        }
      );
      const config = await res.json();
      if (!res.ok) throw new Error(config.error || "Failed to get PayPal config");

      // Load PayPal SDK for one-time capture
      const expectedSrc = `https://www.paypal.com/sdk/js?client-id=${config.clientId}&intent=capture&currency=USD`;
      const existingScript = document.querySelector(`script[src^="${expectedSrc}"]`);

      if (!existingScript || !window.paypal?.Buttons) {
        document.querySelectorAll('script[src*="paypal.com/sdk"]').forEach(s => s.remove());
        delete (window as any).paypal;

        await new Promise(r => setTimeout(r, 100));

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
          await new Promise(r => setTimeout(r, 300));
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
          // Create order server-side
          const orderRes = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/paypal-create-addon-order`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({ addonType, quantity: 1 }),
            }
          );
          const orderData = await orderRes.json();
          if (!orderRes.ok) throw new Error(orderData.error || "Failed to create order");
          return orderData.orderId;
        },
        onApprove: async (data: any) => {
          // Capture via backend
          const captureRes = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/paypal-capture-addon`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({ orderId: data.orderID }),
            }
          );
          const captureData = await captureRes.json();
          if (!captureRes.ok) throw new Error(captureData.error || "Capture failed");

          toast.success("Add-on purchased successfully!");
          onClose();
          onSuccess();
        },
        onCancel: () => {
          toast.info("Payment was cancelled.");
          onClose();
        },
        onError: (err: any) => {
          console.error("PayPal add-on error:", err);
          toast.error("Something went wrong with the payment.");
          onClose();
        },
      }).render(containerRef.current);

      buttonsRenderedRef.current = true;
    } catch (err: any) {
      console.error("PayPal add-on checkout error:", err);
      setError(err.message || "Failed to initialize checkout");
    } finally {
      setLoading(false);
    }
  }, [isOpen, addonType, onSuccess, onClose]);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(loadAndRender, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, loadAndRender]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Purchase {addonLabel}</DialogTitle>
          <DialogDescription>
            One-time payment of ${addonPrice} • Complete below
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {loading && (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading payment options...</p>
            </div>
          )}

          {error && (
            <div className="text-center py-6">
              <p className="text-sm text-destructive mb-2">{error}</p>
              <button className="text-sm text-primary underline" onClick={loadAndRender}>
                Try again
              </button>
            </div>
          )}

          <div ref={containerRef} className={loading || error ? "hidden" : "min-h-[150px]"} />

          <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground pt-2 border-t border-border/50">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Secure payment powered by PayPal</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
