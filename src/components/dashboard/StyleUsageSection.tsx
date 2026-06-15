import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, Loader2, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useEffectiveUser } from "@/hooks/useImpersonation";
import { getThumbnailUrl } from "@/lib/imageUrls";

export default function StyleUsageSection() {
  const { effectiveUserId } = useEffectiveUser();

  const { data: styleUsage = [], isLoading } = useQuery({
    queryKey: ["dashboard-style-usage", effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return [];

      // Get user's styles
      const { data: styles, error: stylesError } = await supabase
        .from("styles")
        .select("id, name, thumbnail_url")
        .eq("user_id", effectiveUserId)
        .order("created_at", { ascending: false })
        .limit(6);

      if (stylesError) throw stylesError;
      if (!styles || styles.length === 0) return [];

      // Get edit counts per style
      const { data: edits, error: editsError } = await supabase
        .from("image_edits")
        .select("style_id")
        .eq("user_id", effectiveUserId);

      if (editsError) throw editsError;

      const countMap: Record<string, number> = {};
      edits?.forEach((e) => {
        if (e.style_id) {
          countMap[e.style_id] = (countMap[e.style_id] || 0) + 1;
        }
      });

      return styles.map((s) => ({
        ...s,
        editCount: countMap[s.id] || 0,
      }));
    },
    enabled: !!effectiveUserId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (styleUsage.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 }}
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold tracking-tight">Style usage</h2>
        <Button variant="ghost" size="sm" asChild>
          <Link
            to="/dashboard/styles"
            className="gap-1 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground hover:text-primary"
          >
            All styles
            <ArrowRight className="h-3 w-3" />
          </Link>
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3">
        {styleUsage.map((style) => (
          <Link key={style.id} to={`/dashboard/styles/${style.id}`}>
            <Card className="glass-card group h-full overflow-hidden rounded-3xl border-border/60 transition-[transform,border-color] duration-200 [transition-timing-function:cubic-bezier(0.2,0,0,1)] hover:-translate-y-0.5 hover:border-primary/50">
              <CardContent className="p-0">
                <div className="relative h-20 overflow-hidden bg-muted">
                  {style.thumbnail_url ? (
                    <img
                      src={getThumbnailUrl(style.thumbnail_url)}
                      alt={style.name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Sparkles className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="truncate text-sm font-medium transition-colors group-hover:text-primary">
                    {style.name}
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                    {style.editCount} edit{style.editCount !== 1 ? "s" : ""}
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </motion.div>
  );
}
