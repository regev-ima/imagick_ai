import { useState } from "react";
import { motion } from "framer-motion";
import { X, Palette, HardDrive, Zap, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSubscription } from "@/hooks/useSubscription";
import { PayPalAddOnCheckoutModal } from "./PayPalAddOnCheckoutModal";
import { tierOf } from "@/lib/planTier";

interface AddOnModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const getAddons = (planSlug: string) => [
  {
    type: "extra_model",
    label: "Extra Custom AI Model",
    description: "Train one more custom AI model for your workflow",
    price: planSlug === "studio" ? 10 : 15,
    icon: Palette,
    availableFor: ["pro", "studio"],
  },
  {
    type: "extra_storage",
    label: "Extra 500GB Storage",
    description: "Add 500GB of additional cloud storage",
    price: 5,
    icon: HardDrive,
    availableFor: ["starter", "pro", "studio"],
  },
  {
    type: "priority_processing",
    label: "Priority Processing",
    description: "Get faster processing on all your edits",
    price: 10,
    icon: Zap,
    availableFor: ["starter"],
  },
];

export function AddOnModal({ isOpen, onClose }: AddOnModalProps) {
  const { currentPlan, refetch } = useSubscription();
  // Legacy plan versions ('studio-v1') must resolve to their tier for
  // add-on availability & pricing.
  const planSlug = tierOf(currentPlan?.slug) || "free";
  const ADDONS = getAddons(planSlug).filter(a => a.availableFor.includes(planSlug));

  const [selectedAddon, setSelectedAddon] = useState<{
    type: string;
    label: string;
    price: number;
  } | null>(null);

  if (!isOpen) return null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.97, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.97, opacity: 0 }}
          className="w-full max-w-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <Card className="glass-card surface-2 overflow-hidden rounded-[--radius] border border-border">
            <div className="flex items-center justify-between gap-2 border-b border-border bg-background/40 px-4 py-2.5">
              <span className="aura-microlabel flex items-center gap-2">
                <Package className="h-3.5 w-3.5" />
                Add-ons
              </span>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-3 p-5">
              <p className="font-sans text-sm text-muted-foreground">Extend your plan with additional features</p>
              {ADDONS.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Upgrade to a paid plan to access add-ons.
                </p>
              )}
              {ADDONS.map((addon) => {
                const Icon = addon.icon;
                return (
                  <div
                    key={addon.type}
                    className="flex cursor-pointer items-center justify-between rounded-[--radius] border border-border bg-card p-4 transition-colors hover:border-primary/40"
                    onClick={() => setSelectedAddon({ type: addon.type, label: addon.label, price: addon.price })}
                  >
                    <div className="flex items-center gap-4">
                      <div className="grid h-10 w-10 place-items-center rounded-[--radius] bg-primary/10">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium tracking-tight">{addon.label}</p>
                        <p className="mt-0.5 text-sm text-muted-foreground">{addon.description}</p>
                      </div>
                    </div>
                    <Button size="sm" className="folio" onClick={(e) => {
                      e.stopPropagation();
                      setSelectedAddon({ type: addon.type, label: addon.label, price: addon.price });
                    }}>
                      ${addon.price}
                    </Button>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-border p-5">
              <Button variant="outline" onClick={onClose} className="w-full">
                Close
              </Button>
            </div>
          </Card>
        </motion.div>
      </motion.div>

      {selectedAddon && (
        <PayPalAddOnCheckoutModal
          isOpen={!!selectedAddon}
          onClose={() => setSelectedAddon(null)}
          addonType={selectedAddon.type}
          addonLabel={selectedAddon.label}
          addonPrice={selectedAddon.price}
          onSuccess={() => {
            setSelectedAddon(null);
            refetch();
            onClose();
          }}
        />
      )}
    </>
  );
}
