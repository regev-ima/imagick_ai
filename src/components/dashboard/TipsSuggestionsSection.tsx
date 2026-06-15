import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Lightbulb, Sparkles, Images, Share2, Palette } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface TipsSuggestionsSectionProps {
  hasGalleries: boolean;
  hasStyles: boolean;
}

const getTip = (hasGalleries: boolean, hasStyles: boolean) => {
  if (!hasGalleries) {
    return {
      icon: Images,
      title: "Upload your first collection",
      description:
        "Create a gallery and upload your photos to start editing with AI styles and sharing with clients.",
      cta: "Create Collection",
      to: "/dashboard/galleries/new",
    };
  }
  if (!hasStyles) {
    return {
      icon: Sparkles,
      title: "Create your first AI style",
      description:
        "Train a custom editing style from your before/after photos. Apply it to entire galleries in seconds.",
      cta: "Create Style",
      to: "/dashboard/styles/new",
    };
  }
  // Rotate between tips for active users
  const tips = [
    {
      icon: Share2,
      title: "Share a gallery with a client",
      description:
        "Generate a client link to let your clients view, like, and give feedback on your photos.",
      cta: "Go to Galleries",
      to: "/dashboard/galleries",
    },
    {
      icon: Palette,
      title: "Explore a new editing style",
      description:
        "Try creating another AI style to expand your editing toolkit. Each style learns your unique look.",
      cta: "Create Style",
      to: "/dashboard/styles/new",
    },
  ];
  return tips[Math.floor(Date.now() / 86400000) % tips.length];
};

export default function TipsSuggestionsSection({
  hasGalleries,
  hasStyles,
}: TipsSuggestionsSectionProps) {
  const tip = getTip(hasGalleries, hasStyles);
  const Icon = tip.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.7 }}
    >
      <Card className="glass-card relative overflow-hidden rounded-3xl border-border/60">
        {/* Suggestion = an AI moment → soft Gemini spectral wash */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(120% 90% at 0% 0%, hsl(var(--neon-blue) / 0.08), transparent 55%), radial-gradient(120% 90% at 100% 100%, hsl(var(--neon-pink) / 0.07), transparent 55%)",
          }}
        />
        <CardContent className="relative flex items-center gap-5 p-5">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[image:var(--gradient-primary)] text-white shadow-[0_0_22px_-6px_hsl(var(--glow-primary)/0.7)]">
            <Lightbulb className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <span className="aura-microlabel inline-flex items-center gap-1.5">
                <Icon className="h-3 w-3 text-primary" /> Aura suggests
              </span>
            </div>
            <h3 className="text-sm font-semibold">{tip.title}</h3>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {tip.description}
            </p>
          </div>
          <Button variant="outline" size="sm" asChild className="shrink-0 rounded-full">
            <Link to={tip.to}>{tip.cta}</Link>
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
