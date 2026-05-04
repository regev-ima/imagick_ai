import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { X, Wand2, Tag, Plus, Check, Loader2, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getCullingLabels, supportedLanguages, type LanguageCode } from "@/lib/cullingLabels";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AICullingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (tags: string[]) => void;
  isProcessing: boolean;
  imageCount: number;
  showCullingRequiredNote?: boolean;
  cullingStatus?: string;
  isCullingStuck?: boolean;
  galleryType?: string | null;
}

export function AICullingModal({ 
  isOpen, 
  onClose, 
  onConfirm,
  isProcessing,
  imageCount,
  showCullingRequiredNote,
  cullingStatus = "idle",
  isCullingStuck = false,
  galleryType
}: AICullingModalProps) {
  const { user } = useAuth();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState("");
  const [cullingLanguage, setCullingLanguage] = useState<LanguageCode>("en");
  const [languageLoaded, setLanguageLoaded] = useState(false);

  // Fetch user's preferred language
  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_subscriptions")
      .select("preferred_language")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.preferred_language) {
          setCullingLanguage(data.preferred_language as LanguageCode);
        }
        setLanguageLoaded(true);
      });
  }, [user]);

  // Get localized labels based on gallery type and language
  const labels = useMemo(() => {
    return getCullingLabels(galleryType || "wedding", cullingLanguage);
  }, [galleryType, cullingLanguage]);

  // Reset selections when language changes
  useEffect(() => {
    if (!languageLoaded) return;
    setSelectedTags([]);
  }, [cullingLanguage, languageLoaded]);

  // Save language preference when changed
  const handleLanguageChange = async (lang: LanguageCode) => {
    setCullingLanguage(lang);
    if (user) {
      await supabase
        .from("user_subscriptions")
        .update({ preferred_language: lang })
        .eq("user_id", user.id);
    }
  };

  const allLabels = useMemo(() => {
    const custom = selectedTags.filter(t => !labels.includes(t));
    return [...labels, ...custom];
  }, [labels, selectedTags]);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => {
      if (prev.includes(tag)) return prev.filter(t => t !== tag);
      if (prev.length >= 20) return prev;
      return [...prev, tag];
    });
  };

  const handleSelectAll = () => {
    const allSelected = labels.every(l => selectedTags.includes(l));
    if (allSelected) {
      // Deselect all label-based tags, keep custom ones
      setSelectedTags(prev => prev.filter(t => !labels.includes(t)));
    } else {
      // Select all labels (up to 20 cap)
      setSelectedTags(prev => {
        const custom = prev.filter(t => !labels.includes(t));
        const remaining = 20 - custom.length;
        return [...custom, ...labels.slice(0, remaining)];
      });
    }
  };

  const addCustomTag = () => {
    const trimmed = customTag.trim();
    if (trimmed && !selectedTags.includes(trimmed) && selectedTags.length < 20) {
      setSelectedTags(prev => [...prev, trimmed]);
      setCustomTag("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addCustomTag();
    }
  };

  const handleConfirm = () => {
    onConfirm(selectedTags);
  };

  const handleClose = () => {
    setSelectedTags([]);
    setCustomTag("");
    onClose();
  };

  const allLabelsSelected = labels.length > 0 && labels.every(l => selectedTags.includes(l));

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <Card className="glass-card border-border/50 p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Wand2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold">AI Culling</h2>
                <p className="text-sm text-muted-foreground">
                  Analyze {imageCount} images
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={handleClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Culling Processing Note */}
          {cullingStatus === "processing" && !isCullingStuck && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-4">
              <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                ⏳ AI Culling is currently in progress. Please wait for it to finish before running again.
              </p>
            </div>
          )}

          {/* Culling Stuck Note */}
          {cullingStatus === "processing" && isCullingStuck && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-4">
              <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                ⚠️ AI Culling seems stuck. You can try running it again.
              </p>
            </div>
          )}

          {/* Re-run Warning */}
          {cullingStatus === "ready" && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-4">
              <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                ⚠️ Re-running AI Culling will overwrite existing ratings and groupings.
              </p>
            </div>
          )}

          {/* Culling Required Note */}
          {showCullingRequiredNote && cullingStatus !== "processing" && cullingStatus !== "ready" && (
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 mb-4">
              <p className="text-sm text-primary font-medium">
                ⭐ Star ratings and duplicate detection are only available after running AI Culling
              </p>
            </div>
          )}

          {/* Description */}
          <div className="p-4 rounded-lg bg-muted/50 mb-6">
            <p className="text-sm text-muted-foreground">
              AI Culling will analyze your images and provide:
            </p>
            <ul className="text-sm text-muted-foreground mt-2 space-y-1">
              <li>• Quality ratings (1-5 stars)</li>
              <li>• Smart tags and categorization</li>
              <li>• Duplicate/similar image detection</li>
            </ul>
          </div>

          {/* Tag Selection */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4" />
                <span className="font-medium">Select Topics ({selectedTags.length}/20)</span>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                <Select value={cullingLanguage} onValueChange={(v) => handleLanguageChange(v as LanguageCode)}>
                  <SelectTrigger className="h-8 w-[140px] text-xs bg-muted/50 border-border/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {supportedLanguages.map(lang => (
                      <SelectItem key={lang.code} value={lang.code} className="text-xs">
                        {lang.name} ({lang.englishName})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">
                Choose relevant topics to improve AI accuracy
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 px-2"
                onClick={handleSelectAll}
              >
                {allLabelsSelected ? "Deselect All" : "Select All"}
              </Button>
            </div>
            
            {/* Labels */}
            <div className="flex flex-wrap gap-2 mb-4">
              {allLabels.map(tag => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  disabled={selectedTags.length >= 20 && !selectedTags.includes(tag)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-sm font-medium transition-all",
                    selectedTags.includes(tag)
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80",
                    selectedTags.length >= 20 && !selectedTags.includes(tag) && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {selectedTags.includes(tag) && (
                    <Check className="w-3 h-3 inline mr-1" />
                  )}
                  {tag}
                </button>
              ))}
            </div>

            {/* Custom Tag Input */}
            <div className="flex gap-2">
              <Input
                placeholder="Add custom topic..."
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                onKeyPress={handleKeyPress}
                className="bg-muted/50 border-border/50"
                disabled={selectedTags.length >= 20}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={addCustomTag}
                disabled={!customTag.trim() || selectedTags.length >= 20}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              variant="glow"
              onClick={handleConfirm}
              disabled={isProcessing || (cullingStatus === "processing" && !isCullingStuck)}
              className="gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : cullingStatus === "processing" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Culling in Progress...
                </>
              ) : cullingStatus === "ready" ? (
                <>
                  <Wand2 className="w-4 h-4" />
                  Re-run AI Culling
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  Start AI Culling
                </>
              )}
            </Button>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}
