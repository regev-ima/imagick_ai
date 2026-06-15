import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Zap, Eye, Images, Sparkles, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useEffectiveUser } from "@/hooks/useImpersonation";

interface ActivityItem {
  id: string;
  type: "ai_edit" | "client_view" | "upload" | "style_train";
  description: string;
  galleryName?: string;
  credits?: number;
  timestamp: string;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

function cleanDescription(raw: string | null): string {
  if (!raw) return "AI edit applied";
  // Replace UUIDs with empty string and clean up leftover whitespace / punctuation
  const cleaned = raw.replace(UUID_RE, "").replace(/\s{2,}/g, " ").replace(/\s+$/, "").replace(/for image\s*$/i, "").trim();
  return cleaned || "AI edit applied";
}

const iconMap = {
  ai_edit: { Icon: Sparkles, bg: "bg-primary/12", color: "text-primary" },
  client_view: { Icon: Eye, bg: "bg-secondary/15", color: "text-secondary" },
  upload: { Icon: Images, bg: "bg-accent/15", color: "text-accent" },
  style_train: { Icon: Zap, bg: "bg-primary/12", color: "text-primary" },
};

export default function ActivityFeed() {
  const { effectiveUserId } = useEffectiveUser();

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ["activity-feed", effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return [];

      // Fetch recent edit usage logs
      const { data: logs } = await (supabase as any)
        .from("edit_usage_logs")
        .select("id, action_type, description, gallery_id, edits_spent, created_at")
        .eq("user_id", effectiveUserId)
        .order("created_at", { ascending: false })
        .limit(5);

      if (!logs?.length) return [];

      // Fetch gallery names for context
      const galleryIds = [...new Set(logs.map((l) => l.gallery_id).filter(Boolean))];
      const galleryNames: Record<string, string> = {};
      if (galleryIds.length > 0) {
        const { data: galleries } = await supabase
          .from("galleries")
          .select("id, name")
          .in("id", galleryIds as string[]);
        galleries?.forEach((g) => {
          galleryNames[g.id] = g.name;
        });
      }

      return logs.map((log): ActivityItem => ({
        id: log.id,
        type: log.action_type as ActivityItem["type"],
        description: cleanDescription(log.description),
        galleryName: log.gallery_id ? galleryNames[log.gallery_id] : undefined,
        credits: log.edits_spent,
        timestamp: log.created_at,
      }));
    },
    enabled: !!effectiveUserId,
    staleTime: 30_000,
  });

  return (
    <Card className="glass-card rounded-3xl border-border/60 transition-colors hover:border-primary/30">
      <CardHeader className="px-5 pb-3 pt-5">
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary/12 text-primary">
            <Clock className="h-4 w-4" />
          </div>
          <CardTitle className="font-display text-base font-semibold tracking-tight">Recent activity</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-4">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex animate-pulse items-center gap-3">
                <div className="h-8 w-8 flex-shrink-0 rounded-xl bg-muted" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-3/4 rounded bg-muted" />
                  <div className="h-2.5 w-1/2 rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
            <Clock className="h-8 w-8 opacity-20" />
            <p className="font-mono text-[11px] uppercase tracking-[0.12em]">No recent activity</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activities.map((item, i) => {
              const { Icon, bg, color } = iconMap[item.type] || iconMap.ai_edit;
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-start gap-3"
                >
                  <div className={`mt-0.5 grid h-8 w-8 flex-shrink-0 place-items-center rounded-xl ${bg} ${color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm leading-snug">
                      {item.description}
                      {item.galleryName && (
                        <span className="text-muted-foreground"> · {item.galleryName}</span>
                      )}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="font-mono text-[11px] text-muted-foreground">{timeAgo(item.timestamp)}</span>
                      {item.credits != null && item.credits > 0 && (
                        <>
                          <span className="text-[11px] text-border">·</span>
                          <span className="font-mono text-[11px] font-medium text-primary">−{item.credits} cr</span>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
