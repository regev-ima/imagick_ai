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
      <Card className="glass-card border-border/50 overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-accent/5 pointer-events-none" />
        <CardContent className="p-5 flex items-center gap-5 relative">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Lightbulb className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Icon className="w-4 h-4 text-secondary" />
              <h3 className="font-semibold text-sm">{tip.title}</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {tip.description}
            </p>
          </div>
          <Button variant="outline" size="sm" asChild className="shrink-0">
            <Link to={tip.to}>{tip.cta}</Link>
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
