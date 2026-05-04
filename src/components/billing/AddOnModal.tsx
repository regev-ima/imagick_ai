import { useState } from "react";
import { motion } from "framer-motion";
import { X, Palette, HardDrive, Zap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSubscription } from "@/hooks/useSubscription";
import { PayPalAddOnCheckoutModal } from "./PayPalAddOnCheckoutModal";

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
  const planSlug = currentPlan?.slug || "free";
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
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="w-full max-w-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <Card className="glass-card border-border/50">
            <div className="flex items-center justify-between p-6 border-b border-border/50">
              <div>
                <h2 className="text-xl font-bold">Add-ons</h2>
                <p className="text-sm text-muted-foreground">Extend your plan with additional features</p>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="p-6 space-y-4">
              {ADDONS.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-4">
                  Upgrade to a paid plan to access add-ons.
                </p>
              )}
              {ADDONS.map((addon) => {
                const Icon = addon.icon;
                return (
                  <div
                    key={addon.type}
                    className="flex items-center justify-between p-4 rounded-lg border border-border/50 hover:border-primary/30 transition-colors cursor-pointer"
                    onClick={() => setSelectedAddon({ type: addon.type, label: addon.label, price: addon.price })}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{addon.label}</p>
                        <p className="text-sm text-muted-foreground">{addon.description}</p>
                      </div>
                    </div>
                    <Button size="sm" onClick={(e) => {
                      e.stopPropagation();
                      setSelectedAddon({ type: addon.type, label: addon.label, price: addon.price });
                    }}>
                      ${addon.price}
                    </Button>
                  </div>
                );
              })}
            </div>

            <div className="p-6 border-t border-border/50">
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
