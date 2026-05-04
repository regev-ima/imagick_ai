import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Paintbrush } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useEffectiveUser } from "@/hooks/useImpersonation";
import { getThumbnailUrl } from "@/lib/imageUrls";

const formatTimeAgo = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
};

export default function RecentEditsSection() {
  const { effectiveUserId } = useEffectiveUser();

  const { data: recentEdits = [], isLoading } = useQuery({
    queryKey: ["dashboard-recent-edits", effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return [];
      const { data, error } = await supabase
        .from("image_edits")
        .select("id, edited_url, style_name, gallery_id, created_at")
        .eq("user_id", effectiveUserId)
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data;
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

  if (recentEdits.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.65 }}
    >
      <h2 className="text-xl font-semibold mb-4">Recent Edits</h2>
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-3 pb-2">
          {recentEdits.map((edit) => (
            <Link
              key={edit.id}
              to={`/dashboard/galleries/${edit.gallery_id}`}
              className="shrink-0"
            >
              <Card className="glass-card border-border/50 hover:border-primary/30 transition-all group overflow-hidden w-[160px]">
                <div className="h-24 bg-muted relative overflow-hidden">
                  <img
                    src={getThumbnailUrl(edit.edited_url)}
                    alt="Edited image"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    onError={(e) => {
                      e.currentTarget.src = edit.edited_url;
                    }}
                  />
                </div>
                <div className="p-2.5">
                  <p className="text-xs font-medium truncate flex items-center gap-1 text-foreground">
                    <Paintbrush className="w-3 h-3 text-primary shrink-0" />
                    {edit.style_name || "Unknown style"}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {formatTimeAgo(edit.created_at)}
                  </p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </motion.div>
  );
}
