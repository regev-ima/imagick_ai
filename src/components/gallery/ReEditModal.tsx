import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { X, Sparkles, Check, Lock, Eye, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { SHOWCASE_GALLERY_ID } from "@/lib/constants";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getThumbnailUrl } from "@/lib/imageUrls";
import heroImage1 from "@/assets/hero-gallery-1.jpg";
import { useSubscription } from "@/hooks/useSubscription";

interface Style {
  id: string;
  name: string;
  thumbnail_url: string | null;
  category: string | null;
}

interface ReEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedImageCount: number;
  styles: Style[];
  usedStyleIds: string[];
  onConfirm: (styleIds: string[]) => void;
  isProcessing?: boolean;
}

export function ReEditModal({
  isOpen,
  onClose,
  selectedImageCount,
  styles,
  usedStyleIds = [],
  onConfirm,
  isProcessing: externalIsProcessing = false
}: ReEditModalProps) {
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const isProcessing = externalIsProcessing;
  const navigate = useNavigate();
  const { editsRemaining, availableEdits, editsReserved, isUnlimited, canEdit, isSuspended, isExpired, isFreePlan } = useSubscription();

  const editsNeeded = selectedImageCount * selectedStyles.length;
  const hasInsufficientEdits = !isUnlimited && editsNeeded > availableEdits;

  // Fetch showcase cover images
  const { data: showcaseCovers = {} } = useQuery({
    queryKey: ["showcase-covers-reedit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("image_edits")
        .select("style_id, edited_url")
        .eq("gallery_id", SHOWCASE_GALLERY_ID);
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const row of data || []) {
        if (row.style_id && row.edited_url && !map[row.style_id]) {
          map[row.style_id] = row.edited_url;
        }
      }
      return map;
    },
    enabled: isOpen,
  });

  useEffect(() => {
    if (isOpen) setSelectedStyles([]);
  }, [isOpen]);

  const toggleStyle = (styleId: string) => {
    if (usedStyleIds.includes(styleId)) {
      toast.error("This style was already applied to selected images");
      return;
    }
    setSelectedStyles(prev => {
      if (prev.includes(styleId)) return prev.filter(id => id !== styleId);
      if (prev.length >= 3) { toast.error("Maximum 3 styles allowed"); return prev; }
      return [...prev, styleId];
    });
  };

  const handleConfirm = async () => {
    if (selectedStyles.length === 0) { toast.error("Please select at least one style"); return; }
    onConfirm(selectedStyles);
  };

  if (!isOpen) return null;

  const availableStyles = styles.filter(s => !usedStyleIds.includes(s.id));
  const usedStyles = styles.filter(s => usedStyleIds.includes(s.id));

  const getStyleCover = (style: Style) => {
    const cover = showcaseCovers[style.id];
    if (cover) return getThumbnailUrl(cover);
    return style.thumbnail_url || heroImage1;
  };

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
        className="w-full max-w-3xl max-h-[85vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <Card className="glass-card border-border/50 flex flex-col max-h-[85vh]">
          <div className="flex items-center justify-between p-6 border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Re-Edit Images</h2>
                <p className="text-sm text-muted-foreground">
                  {selectedImageCount} image{selectedImageCount > 1 ? 's' : ''} selected
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          <div className="flex-1 overflow-hidden p-6">
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
                  <Button
                    size="sm"
                    variant="default"
                    className="ml-3 flex-shrink-0"
                    onClick={() => navigate("/dashboard/billing")}
                  >
                    Upgrade Plan
                  </Button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold mb-1">Select AI Styles</h3>
                <p className="text-sm text-muted-foreground">Choose up to 3 styles to apply</p>
              </div>
              <div className={cn(
                "px-3 py-1.5 rounded-full text-sm font-semibold",
                selectedStyles.length > 0
                  ? "bg-primary/15 text-primary"
                  : "bg-muted text-muted-foreground"
              )}>
                {selectedStyles.length}/3
              </div>
            </div>

            <ScrollArea className="h-[400px] pr-2">
              {/* Available Styles */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {availableStyles.map((style) => {
                  const isSelected = selectedStyles.includes(style.id);
                  return (
                    <motion.div
                      key={style.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => toggleStyle(style.id)}
                      className={cn(
                        "relative rounded-xl overflow-hidden cursor-pointer transition-all h-36 flex flex-col justify-end group",
                        isSelected
                          ? "ring-2 ring-primary ring-offset-2 ring-offset-background shadow-lg shadow-primary/20"
                          : "ring-1 ring-border/50 hover:ring-primary/40"
                      )}
                    >
                      <img
                        src={getStyleCover(style)}
                        alt={style.name}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                      {/* Eye icon */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(`/dashboard/styles/${style.id}`, "_blank");
                        }}
                        className="absolute top-2.5 left-2.5 w-8 h-8 rounded-full bg-background/60 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background/80"
                      >
                        <Eye className="w-4 h-4 text-foreground" />
                      </button>

                      <div className="relative z-10 p-3">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-primary" />
                          <span className="font-semibold text-sm text-white truncate">{style.name}</span>
                        </div>
                        {style.category && (
                          <p className="text-xs text-white/60 capitalize mt-0.5 ml-6">{style.category}</p>
                        )}
                      </div>

                      {isSelected && (
                        <div className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-primary flex items-center justify-center shadow-lg">
                          <Check className="w-4 h-4 text-primary-foreground" />
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>

              {/* Already Used Styles (disabled) */}
              {usedStyles.length > 0 && (
                <>
                  <h4 className="font-medium mt-6 mb-3 text-muted-foreground flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Already Applied
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {usedStyles.map((style) => (
                      <div
                        key={style.id}
                        className="relative rounded-xl overflow-hidden ring-1 ring-border/30 opacity-50 cursor-not-allowed h-36 flex flex-col justify-end"
                      >
                        <img
                          src={getStyleCover(style)}
                          alt={style.name}
                          className="absolute inset-0 w-full h-full object-cover grayscale"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                        <div className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-muted/80 backdrop-blur-sm flex items-center justify-center">
                          <Lock className="w-3 h-3 text-muted-foreground" />
                        </div>
                        <div className="relative z-10 p-3">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-muted-foreground" />
                            <span className="font-semibold text-sm text-white/70 truncate">{style.name}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {styles.length === 0 && (
                <div className="text-center py-8">
                  <Sparkles className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No styles available</p>
                  <p className="text-sm text-muted-foreground">Create a custom style first</p>
                </div>
              )}

              {availableStyles.length === 0 && usedStyles.length > 0 && (
                <div className="text-center py-8">
                  <Lock className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">All styles already applied</p>
                  <p className="text-sm text-muted-foreground">Create new styles to apply different edits</p>
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Edit Cost Summary */}
          {selectedStyles.length > 0 && (
            <div className="p-6 border-t border-border/50">
              {isUnlimited ? (
                <div className="text-sm text-muted-foreground">
                  {selectedImageCount} image{selectedImageCount !== 1 ? 's' : ''} × {selectedStyles.length} style{selectedStyles.length !== 1 ? 's' : ''} = <span className="font-semibold text-foreground">{editsNeeded} edits</span>
                  <span className="ml-2 text-primary font-medium">Unlimited plan</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {selectedImageCount} image{selectedImageCount !== 1 ? 's' : ''} × {selectedStyles.length} style{selectedStyles.length !== 1 ? 's' : ''} = <span className="font-semibold text-foreground">{editsNeeded} edits</span>
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
                      <Button
                        size="sm"
                        variant="default"
                        className="ml-3 flex-shrink-0"
                        onClick={() => navigate("/dashboard/billing")}
                      >
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
              {isProcessing ? "Sending to AI..." : `Apply ${selectedStyles.length > 0 ? selectedStyles.length : ""} Style${selectedStyles.length !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}
