import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Orb } from "@/components/aura/Orb";
import { Card } from "@/components/ui/card";
import { LookGrid, Sparkle, type LookStyle } from "@/components/gallery/LookGrid";
import { toast } from "sonner";
import { useSubscription } from "@/hooks/useSubscription";

const MAX_LOOKS = 3;

interface ReEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedImageCount: number;
  styles: LookStyle[];
  usedStyleIds: string[];
  /** Gallery owner id — groups their trained models as "Your AI models". */
  ownerId?: string | null;
  onConfirm: (styleIds: string[]) => void;
  isProcessing?: boolean;
}

export function ReEditModal({
  isOpen,
  onClose,
  selectedImageCount,
  styles,
  usedStyleIds = [],
  ownerId,
  onConfirm,
  isProcessing: externalIsProcessing = false,
}: ReEditModalProps) {
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [touched, setTouched] = useState(false);
  const isProcessing = externalIsProcessing;
  const navigate = useNavigate();
  const { availableEdits, editsReserved, isUnlimited, canEdit, isSuspended, isExpired, isFreePlan } = useSubscription();

  const editsNeeded = selectedImageCount * selectedStyles.length;
  const hasInsufficientEdits = !isUnlimited && editsNeeded > availableEdits;

  useEffect(() => {
    if (isOpen) { setSelectedStyles([]); setTouched(false); }
  }, [isOpen]);

  // Same select/lock rules as the create-collection picker: cap at MAX_LOOKS,
  // and never let an already-applied look be re-selected (LookGrid disables it,
  // this is the belt-and-braces guard).
  const toggleStyle = (styleId: string) => {
    setTouched(true);
    if (usedStyleIds.includes(styleId)) return;
    setSelectedStyles((prev) => {
      if (prev.includes(styleId)) return prev.filter((id) => id !== styleId);
      if (prev.length >= MAX_LOOKS) { toast.error(`Up to ${MAX_LOOKS} looks`); return prev; }
      return [...prev, styleId];
    });
  };

  const handleConfirm = () => {
    if (selectedStyles.length === 0) { toast.error("Pick at least one look"); return; }
    onConfirm(selectedStyles);
  };

  if (!isOpen) return null;

  return (
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
        className="w-full max-w-2xl max-h-[85vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <Card className="glass-card border-border rounded-[--radius] flex flex-col max-h-[85vh]">
          <div className="flex items-center justify-between p-6 border-b border-border/50">
            <div className="flex items-center gap-3">
              <Orb className="w-10 h-10 shrink-0" />
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Sparkle size={16} className="text-primary" />
                  Edit in a new style
                </h2>
                <p className="aura-microlabel mt-0.5">
                  <span className="folio text-foreground">{selectedImageCount}</span> photo{selectedImageCount !== 1 ? "s" : ""} · re-edits leave your originals and other looks untouched
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          <div className="flex-1 overflow-hidden p-6 flex flex-col min-h-0">
            {/* Blocking banners */}
            {!canEdit && (isSuspended || isExpired) && (
              <div className="p-3 rounded-lg border text-sm bg-destructive/10 border-destructive/30 mb-4">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Your subscription is {isSuspended ? "suspended" : "expired"}. Please update your plan to continue.</span>
                </div>
              </div>
            )}

            {isFreePlan && availableEdits === 0 && (
              <div className="p-3 rounded-lg border text-sm bg-destructive/10 border-destructive/30 mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>You've used all 3,000 free edits.</span>
                  </div>
                  <Button size="sm" variant="default" className="ml-3 flex-shrink-0" onClick={() => navigate("/dashboard/billing")}>
                    Upgrade Plan
                  </Button>
                </div>
              </div>
            )}

            {/* Same picker as collection creation */}
            <div className="mb-3.5 flex shrink-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <Sparkle size={13} className="text-primary" /> Choose your AI look
                </div>
                <p className="caption mt-1">A trained AI model edits every selected photo in this look — pick up to {MAX_LOOKS}.</p>
              </div>
              {selectedStyles.length > 0 && <span className="aura-microlabel shrink-0 text-primary">{selectedStyles.length}/{MAX_LOOKS}</span>}
            </div>

            {styles.length === 0 ? (
              <div className="text-center py-8">
                <Sparkle size={48} className="text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No styles available</p>
                <p className="text-sm text-muted-foreground">Create a custom style first</p>
              </div>
            ) : (
              <LookGrid
                styles={styles}
                selectedIds={selectedStyles}
                usedIds={usedStyleIds}
                chosen={touched}
                ownerId={ownerId}
                onToggle={toggleStyle}
                max={MAX_LOOKS}
              />
            )}
          </div>

          {/* Edit Cost Summary */}
          {selectedStyles.length > 0 && (
            <div className="p-6 border-t border-border/50">
              {isUnlimited ? (
                <div className="text-sm text-muted-foreground">
                  {selectedImageCount} photo{selectedImageCount !== 1 ? "s" : ""} × {selectedStyles.length} look{selectedStyles.length !== 1 ? "s" : ""} = <span className="font-semibold text-foreground">{editsNeeded} edits</span>
                  <span className="ml-2 text-primary font-medium">Unlimited plan</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {selectedImageCount} photo{selectedImageCount !== 1 ? "s" : ""} × {selectedStyles.length} look{selectedStyles.length !== 1 ? "s" : ""} = <span className="font-semibold text-foreground">{editsNeeded} edits</span>
                    </span>
                    <span className="text-muted-foreground">
                      Available: <span className="font-semibold text-foreground">{availableEdits.toLocaleString()}</span>{editsReserved > 0 && <span className="text-xs ml-1">({editsReserved.toLocaleString()} reserved)</span>}
                    </span>
                  </div>
                  {hasInsufficientEdits && (
                    <div className="mt-3 flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-destructive">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>Not enough edits.</span>
                      </div>
                      <Button size="sm" variant="default" className="ml-3 flex-shrink-0" onClick={() => navigate("/dashboard/billing")}>
                        Upgrade Plan
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div className="p-6 border-t border-border/50 flex items-center justify-end gap-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="glow"
              disabled={selectedStyles.length === 0 || isProcessing || !canEdit || hasInsufficientEdits}
              onClick={handleConfirm}
            >
              {isProcessing
                ? "Sending to AI..."
                : `Apply ${selectedStyles.length > 0 ? selectedStyles.length : ""} look${selectedStyles.length !== 1 ? "s" : ""}`}
            </Button>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}
