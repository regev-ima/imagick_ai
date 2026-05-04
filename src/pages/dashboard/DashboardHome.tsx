import { useMemo } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Images,
  Plus,
  ArrowRight,
  Loader2,
  Camera,
  HardDrive,
  Zap,
  Gift,
  Calendar,
  Sparkles,
  ExternalLink,
  CheckCircle2,
  Palette,
  Share2,
  Lightbulb,
  TrendingUp,
} from "lucide-react";

import CreditsUsageChart from "@/components/dashboard/CreditsUsageChart";
import OnboardingQuestionnaire from "@/components/onboarding/OnboardingQuestionnaire";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useSubscription } from "@/hooks/useSubscription";
import { useGiftCreditsCelebration } from "@/hooks/useGiftCreditsCelebration";
import { useOnboardingQuestionnaire } from "@/hooks/useOnboardingQuestionnaire";
import { useEffectiveUser } from "@/hooks/useImpersonation";
import { getThumbnailUrl } from "@/lib/imageUrls";

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};


const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export default function DashboardHome() {
  const { effectiveUserId, effectiveDisplayName } = useEffectiveUser();
  const userName = effectiveDisplayName?.split(" ")[0] || "there";
  const { shouldShow: showQuestionnaire, unansweredQuestions, onSaveAnswer, onSkip: skipQuestionnaire, isSaving: isSavingQuestionnaire, dismiss: dismissQuestionnaire } = useOnboardingQuestionnaire();
  const {
    currentPlan,
    editsUsed,
    editsTotal,
    editsRemaining,
    isUnlimited,
    storageUsedMb,
    maxStorageGb,
    creditGrants,
    giftCreditsTotal,
    planCreditsRemaining,
  } = useSubscription();

  useGiftCreditsCelebration(creditGrants);
  const hasGiftCredits = giftCreditsTotal > 0 && !isUnlimited;

  const storagePercent = maxStorageGb > 0 ? (storageUsedMb / (maxStorageGb * 1024)) * 100 : 0;

  // Separate query for accurate totals across ALL galleries
  const { data: galleryTotals } = useQuery({
    queryKey: ["dashboard-gallery-totals", effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return { count: 0, images: 0 };
      const { data, error } = await supabase
        .from("galleries")
        .select("id, total_images")
        .eq("user_id", effectiveUserId);
      if (error) throw error;
      return {
        count: data.length,
        images: data.reduce((sum, g) => sum + (g.total_images || 0), 0),
      };
    },
    enabled: !!effectiveUserId,
  });

  const { data: galleries = [], isLoading: galleriesLoading } = useQuery({
    queryKey: ["dashboard-galleries", effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return [];
      const { data, error } = await supabase
        .from("galleries")
        .select("*")
        .eq("user_id", effectiveUserId)
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data;
    },
    enabled: !!effectiveUserId,
  });

  const totalCollections = galleryTotals?.count ?? 0;
  const totalImages = galleryTotals?.images ?? 0;

  // Smart Quick Actions — derived from gallery data
  const quickActions = useMemo(() => {
    const actions: Array<{
      id: string;
      icon: "processing" | "ready";
      label: string;
      detail: string;
      link: string;
      progress?: number;
    }> = [];

    for (const g of galleries) {
      if (actions.length >= 3) break;

      if (g.status === "processing" || g.status === "uploading") {
        const pct = g.total_images > 0
          ? Math.round((g.processed_images / g.total_images) * 100)
          : 0;
        actions.push({
          id: g.id,
          icon: "processing",
          label: `Continue with ${g.name}`,
          detail: `Processing ${pct}%`,
          link: `/dashboard/galleries/${g.id}`,
          progress: pct,
        });
      } else if (g.status === "ready") {
        const updatedAt = new Date(g.updated_at);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        if (updatedAt >= sevenDaysAgo) {
          actions.push({
            id: g.id,
            icon: "ready",
            label: `${g.name} is ready to share`,
            detail: `Updated ${updatedAt.toLocaleDateString()}`,
            link: `/dashboard/galleries/${g.id}`,
          });
        }
      }
    }

    return actions;
  }, [galleries]);

  const isEmpty = galleries.length === 0 && !galleriesLoading;

  return (
    <div className="relative p-4 lg:p-6 space-y-4">
      <OnboardingQuestionnaire
        isOpen={showQuestionnaire}
        questions={unansweredQuestions}
        onSaveAnswer={onSaveAnswer}
        onSkip={skipQuestionnaire}
        onDismiss={dismissQuestionnaire}
        isSaving={isSavingQuestionnaire}
      />
      {/* Subtle grid background */}
      <div className="absolute inset-0 bg-grid-pattern opacity-[0.04] pointer-events-none" />
      {/* Gradient glow behind hero */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-primary/[0.12] blur-[130px] pointer-events-none" />

      {/* Hero Welcome */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-3"
      >
        <div>
          <h1 className="text-3xl lg:text-4xl font-bold tracking-tight">
            {getGreeting()},{" "}
            <span className="text-gradient-primary">{userName}</span>
          </h1>
          <p className="text-muted-foreground mt-2 flex items-center gap-2 flex-wrap">
            <span>{totalCollections} collection{totalCollections !== 1 ? "s" : ""}</span>
            <span className="text-border">·</span>
            <span>{totalImages.toLocaleString()} images</span>
            {currentPlan && (
              <>
                <span className="text-border">·</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/15 text-primary border border-primary/20">
                  {currentPlan.name}
                </span>
              </>
            )}
          </p>
        </div>
        <Button variant="glow" asChild>
          <Link to="/dashboard/galleries/new" className="gap-2">
            <Plus className="w-4 h-4" />
            Create Collection
          </Link>
        </Button>
      </motion.div>

      {/* Loading state gates entire content area below hero */}
      {galleriesLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : isEmpty ? (
        /* ── Full Premium Onboarding Experience ── */
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="relative"
        >
          {/* Decorative gradient orbs */}
          <div className="absolute top-20 left-1/4 w-72 h-72 rounded-full bg-primary/[0.08] blur-[100px] pointer-events-none" />
          <div className="absolute top-40 right-1/4 w-56 h-56 rounded-full bg-secondary/[0.08] blur-[90px] pointer-events-none" />
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full bg-accent/[0.06] blur-[80px] pointer-events-none" />

          <motion.div variants={fadeUp} className="text-center pt-12 pb-8">
            <h2 className="text-2xl lg:text-3xl font-bold tracking-tight">
              Your AI photography studio{" "}
              <span className="text-gradient-primary">awaits</span>
            </h2>
            <p className="text-muted-foreground mt-3 max-w-md mx-auto">
              Upload your photos, enhance them with AI, and share stunning galleries — all in one place.
            </p>
          </motion.div>

          {/* 3-step visual flow */}
          <motion.div variants={fadeUp} className="relative max-w-3xl mx-auto px-4">
            {/* Connecting line (desktop only) */}
            <div className="hidden md:block absolute top-1/2 left-[16%] right-[16%] h-px bg-border/40 -translate-y-1/2 z-0" />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
              {[
                {
                  step: 1,
                  icon: Images,
                  title: "Upload Photos",
                  description: "Drag and drop your images or select from your device",
                },
                {
                  step: 2,
                  icon: Sparkles,
                  title: "AI Enhance",
                  description: "Let our AI enhance, retouch, and transform your photos",
                },
                {
                  step: 3,
                  icon: ExternalLink,
                  title: "Share Gallery",
                  description: "Publish beautiful galleries and share them with anyone",
                },
              ].map((item) => (
                <div
                  key={item.step}
                  className="glass-card rounded-2xl border border-border/30 p-6 text-center"
                >
                  <div className="w-12 h-12 mx-auto rounded-xl bg-primary/15 flex items-center justify-center mb-4">
                    <item.icon className="w-6 h-6 text-primary" />
                  </div>
                  <div className="text-xs text-muted-foreground/60 font-medium mb-1">
                    Step {item.step}
                  </div>
                  <h3 className="font-semibold mb-1">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div variants={fadeUp} className="text-center pt-8 pb-4">
            <Button variant="glow" size="lg" asChild>
              <Link to="/dashboard/galleries/new" className="gap-2">
                <Plus className="w-5 h-5" />
                Create Your First Collection
              </Link>
            </Button>
          </motion.div>
        </motion.div>
      ) : (
        /* ── With Collections: Stats + Actions + Collections + Edits + Chart ── */
        <>
          {/* Compact Stats Bar */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-card rounded-2xl border border-border/30 p-4"
          >
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-0">
              {/* Total Images */}
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                  <Camera className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg font-bold leading-tight">{totalImages.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Images</p>
                </div>
              </div>

              {/* Collections */}
              <div className="flex items-center gap-3 lg:border-l lg:border-border/30 lg:pl-4">
                <div className="w-9 h-9 rounded-lg bg-secondary/15 flex items-center justify-center shrink-0">
                  <Images className="w-4 h-4 text-secondary" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg font-bold leading-tight">{totalCollections}</p>
                  <p className="text-xs text-muted-foreground">Collections</p>
                </div>
              </div>

              {/* AI Edits */}
              <div className="flex items-center gap-3 lg:border-l lg:border-border/30 lg:pl-4">
                <div className={cn(
                  "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                  hasGiftCredits ? "bg-green-500/15" : "bg-primary/15"
                )}>
                  {hasGiftCredits ? (
                    <Gift className="w-4 h-4 text-green-500" />
                  ) : (
                    <Zap className="w-4 h-4 text-primary" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-bold leading-tight">
                      {isUnlimited ? "∞" : editsRemaining.toLocaleString()}
                    </p>
                    {hasGiftCredits && (
                      <span className="relative flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-green-500/10 text-green-500 border border-green-500/20 overflow-hidden">
                        <span className="absolute inset-0 bg-gradient-to-r from-transparent via-green-500/10 to-transparent animate-shimmer" />
                        <Gift className="w-2.5 h-2.5 relative" />
                        <span className="relative">+{giftCreditsTotal.toLocaleString()}</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">AI Edits</p>
                  {!isUnlimited && editsTotal > 0 && (
                    <Progress value={(editsUsed / editsTotal) * 100} className="h-1 w-24 mt-1" />
                  )}
                </div>
              </div>

              {/* Storage */}
              <div className="flex items-center gap-3 lg:border-l lg:border-border/30 lg:pl-4">
                <div className="w-9 h-9 rounded-lg bg-secondary/15 flex items-center justify-center shrink-0">
                  <HardDrive className="w-4 h-4 text-secondary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-bold leading-tight">
                    {storageUsedMb >= 1024
                      ? `${(storageUsedMb / 1024).toFixed(1)} GB`
                      : `${Math.round(storageUsedMb)} MB`}
                  </p>
                  <p className="text-xs text-muted-foreground">of {maxStorageGb} GB</p>
                  <Progress value={storagePercent} className="h-1 w-24 mt-1" />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Smart Quick Actions */}
          {quickActions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="flex flex-col sm:flex-row gap-3"
            >
              {quickActions.map((action) => (
                <Link
                  key={action.id}
                  to={action.link}
                  className="flex-1 flex items-center gap-3 rounded-xl bg-card/60 backdrop-blur-sm border border-border/30 hover:border-primary/30 transition-all p-3 group"
                >
                  <div className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                    action.icon === "processing" ? "bg-amber-500/15" : "bg-emerald-500/15"
                  )}>
                    {action.icon === "processing" ? (
                      <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{action.label}</p>
                    <p className="text-xs text-muted-foreground">{action.detail}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                </Link>
              ))}
            </motion.div>
          )}

          {/* Collections — full width, 4 columns, max 2 rows */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Recent Collections</h2>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/dashboard/galleries" className="gap-1 text-muted-foreground hover:text-foreground text-xs">
                  View All
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {galleries.map((gallery, index) => (
                <motion.div
                  key={gallery.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.25 + index * 0.05 }}
                >
                  <Link to={`/dashboard/galleries/${gallery.id}`}>
                    <Card className={cn(
                      "relative border-border/40 hover:border-primary/40 transition-all duration-300 group overflow-hidden rounded-xl bg-card/80 backdrop-blur-sm h-full",
                      "hover:shadow-lg hover:shadow-primary/5",
                      gallery.status === "ready" && "ring-1 ring-emerald-500/10",
                    )}>
                      <div className="relative overflow-hidden bg-muted aspect-[4/3]">
                        {gallery.hero_image_url ? (
                          <img
                            src={getThumbnailUrl(gallery.hero_image_url)}
                            alt={gallery.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                            onError={(e) => {
                              const target = e.currentTarget;
                              if (target.src !== gallery.hero_image_url) {
                                target.src = gallery.hero_image_url!;
                              }
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Images className="w-8 h-8 text-muted-foreground/40" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent opacity-80" />

                        {gallery.status !== "ready" && gallery.status !== "error" && (
                          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20">
                            <motion.div
                              className="h-full bg-gradient-to-r from-amber-500 to-primary"
                              initial={{ width: 0 }}
                              animate={{ width: `${gallery.total_images > 0 ? (gallery.processed_images / gallery.total_images) * 100 : 0}%` }}
                              transition={{ duration: 0.5, delay: index * 0.05 }}
                            />
                          </div>
                        )}
                      </div>

                      <CardContent className="p-2.5 space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className={cn(
                            "w-1.5 h-1.5 rounded-full shrink-0",
                            gallery.status === "ready" && "bg-emerald-500",
                            gallery.status === "error" && "bg-red-500",
                            gallery.status !== "ready" && gallery.status !== "error" && "bg-amber-500 animate-pulse",
                          )} />
                          <h3 className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                            {gallery.name}
                          </h3>
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground/70">
                          <span className="flex items-center gap-1">
                            <Images className="w-3 h-3" />
                            {gallery.total_images || 0}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(gallery.created_at).toLocaleDateString()}
                          </span>
                          {gallery.status !== "ready" && gallery.status !== "error" && gallery.total_images > 0 && (
                            <span className="ml-auto text-amber-500 font-medium">
                              {Math.round((gallery.processed_images / gallery.total_images) * 100)}%
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Bottom split: Usage (left) + Tips & CTAs (right) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left — Credits chart + Storage gauge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="space-y-4"
            >
              <CreditsUsageChart />

              {/* Storage gauge card */}
              <div className="glass-card rounded-2xl border border-border/30 p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-secondary/15 flex items-center justify-center shrink-0">
                    <HardDrive className="w-4 h-4 text-secondary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">Storage</p>
                    <p className="text-xs text-muted-foreground">
                      {storageUsedMb >= 1024
                        ? `${(storageUsedMb / 1024).toFixed(1)} GB`
                        : `${Math.round(storageUsedMb)} MB`}{" "}
                      of {maxStorageGb} GB used
                    </p>
                  </div>
                  <p className="text-lg font-bold text-foreground">{Math.round(storagePercent)}%</p>
                </div>
                <Progress value={storagePercent} className="h-2" />
              </div>
            </motion.div>

            {/* Right — Tips & Product CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="space-y-3"
            >
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-primary" />
                Tips & Quick Actions
              </h2>

              {/* AI Styles CTA */}
              <Link to="/dashboard/styles" className="block group">
                <div className="glass-card rounded-xl border border-border/30 hover:border-primary/30 transition-all p-4 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-violet-500/15 flex items-center justify-center shrink-0 mt-0.5">
                    <Palette className="w-5 h-5 text-violet-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold group-hover:text-primary transition-colors">Create AI Styles</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Build custom editing styles that match your brand. Apply them to entire collections in one click.
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-1" />
                </div>
              </Link>

              {/* Share Galleries CTA */}
              <Link to="/dashboard/galleries" className="block group">
                <div className="glass-card rounded-xl border border-border/30 hover:border-primary/30 transition-all p-4 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0 mt-0.5">
                    <Share2 className="w-5 h-5 text-blue-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold group-hover:text-primary transition-colors">Share with Clients</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Generate shareable gallery links for your clients. They can view, select favorites, and download — no account needed.
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-1" />
                </div>
              </Link>

              {/* Batch Editing Tip */}
              <Link to="/dashboard/galleries/new" className="block group">
                <div className="glass-card rounded-xl border border-border/30 hover:border-primary/30 transition-all p-4 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="w-5 h-5 text-amber-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold group-hover:text-primary transition-colors">Batch AI Enhancement</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Upload an entire shoot and let AI enhance all photos at once. Save hours of manual editing per session.
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-1" />
                </div>
              </Link>

              {/* Upgrade CTA — show only for non-unlimited users */}
              {!isUnlimited && (
                <Link to="/dashboard/billing" className="block group">
                  <div className="glass-card rounded-xl border border-primary/20 hover:border-primary/40 bg-primary/[0.03] transition-all p-4 flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                      <TrendingUp className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold group-hover:text-primary transition-colors">Upgrade Your Plan</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Get unlimited AI edits, more storage, and priority processing. Scale your photography business.
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-1" />
                  </div>
                </Link>
              )}
            </motion.div>
          </div>
        </>
      )}
    </div>
  );
}
