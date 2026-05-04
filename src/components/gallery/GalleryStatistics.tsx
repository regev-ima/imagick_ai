import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Eye, Users, Heart, Download, Clock, Globe, 
  MousePointer, TrendingUp, Calendar, Activity
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow, subDays, isAfter } from "date-fns";


interface GalleryStatisticsProps {
  galleryId: string;
}

interface Interaction {
  id: string;
  interaction_type: string;
  client_name: string | null;
  ip_address: string | null;
  image_id: string | null;
  feedback_text: string | null;
  created_at: string;
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subValue?: string;
  trend?: "up" | "down" | "neutral";
}

function StatCard({ icon, label, value, subValue, trend }: StatCardProps) {
  return (
    <Card className="p-4 bg-muted/30 border-border/30">
      <div className="flex items-start justify-between">
        <div className="p-2 rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        {trend && (
          <div className={`text-xs px-2 py-0.5 rounded-full ${
            trend === "up" ? "bg-green-500/10 text-green-500" :
            trend === "down" ? "bg-red-500/10 text-red-500" :
            "bg-muted text-muted-foreground"
          }`}>
            {trend === "up" ? "↑" : trend === "down" ? "↓" : "—"}
          </div>
        )}
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
        {subValue && (
          <p className="text-xs text-primary mt-1">{subValue}</p>
        )}
      </div>
    </Card>
  );
}

function getInteractionIcon(type: string) {
  switch (type) {
    case "view": return <Eye className="w-3 h-3" />;
    case "like": return <Heart className="w-3 h-3 text-red-400" />;
    case "unlike": return <Heart className="w-3 h-3" />;
    case "download": return <Download className="w-3 h-3 text-blue-400" />;
    case "feedback": return <MousePointer className="w-3 h-3 text-yellow-400" />;
    default: return <Activity className="w-3 h-3" />;
  }
}

function getInteractionLabel(type: string) {
  switch (type) {
    case "view": return "Gallery view";
    case "like": return "Liked image";
    case "unlike": return "Removed like";
    case "download": return "Downloaded image";
    case "feedback": return "Feedback";
    default: return type;
  }
}

export function GalleryStatistics({ galleryId }: GalleryStatisticsProps) {
  // Fetch all interactions
  const { data: interactions = [], isLoading } = useQuery({
    queryKey: ["gallery-statistics", galleryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_interactions")
        .select("*")
        .eq("gallery_id", galleryId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as Interaction[];
    }
  });

  // Calculate statistics
  const stats = useMemo(() => {
    const now = new Date();
    const last7Days = subDays(now, 7);
    const last30Days = subDays(now, 30);

    // Group by type
    const byType = interactions.reduce((acc, i) => {
      acc[i.interaction_type] = (acc[i.interaction_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Unique visitors (by IP)
    const uniqueIps = new Set(interactions.filter(i => i.ip_address).map(i => i.ip_address));
    
    // Unique clients (by name)
    const uniqueClients = new Set(interactions.filter(i => i.client_name).map(i => i.client_name));

    // Recent activity (last 7 days)
    const recentInteractions = interactions.filter(i => isAfter(new Date(i.created_at), last7Days));
    const last7DaysViews = recentInteractions.filter(i => i.interaction_type === "view").length;

    // Monthly activity
    const monthlyInteractions = interactions.filter(i => isAfter(new Date(i.created_at), last30Days));

    // Peak activity hour
    const hourCounts = interactions.reduce((acc, i) => {
      const hour = new Date(i.created_at).getHours();
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);
    const peakHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];

    // Top clients
    const clientActivity = interactions.reduce((acc, i) => {
      const name = i.client_name || i.ip_address || "Anonymous";
      if (!acc[name]) {
        acc[name] = { views: 0, likes: 0, downloads: 0, lastSeen: i.created_at };
      }
      if (i.interaction_type === "view") acc[name].views++;
      if (i.interaction_type === "like") acc[name].likes++;
      if (i.interaction_type === "download") acc[name].downloads++;
      if (new Date(i.created_at) > new Date(acc[name].lastSeen)) {
        acc[name].lastSeen = i.created_at;
      }
      return acc;
    }, {} as Record<string, { views: number; likes: number; downloads: number; lastSeen: string }>);

    return {
      totalViews: byType["view"] || 0,
      totalLikes: byType["like"] || 0,
      totalDownloads: byType["download"] || 0,
      totalFeedback: byType["feedback"] || 0,
      uniqueVisitors: uniqueIps.size,
      uniqueClients: uniqueClients.size,
      last7DaysViews,
      monthlyInteractions: monthlyInteractions.length,
      peakHour: peakHour ? `${peakHour[0]}:00` : null,
      recentActivity: interactions.slice(0, 20),
      clientActivity: Object.entries(clientActivity)
        .sort((a, b) => (b[1].views + b[1].likes + b[1].downloads) - (a[1].views + a[1].likes + a[1].downloads))
        .slice(0, 10)
    };
  }, [interactions]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={<Eye className="w-4 h-4" />}
          label="Total Views"
          value={stats.totalViews}
          subValue={`${stats.last7DaysViews} in last 7 days`}
          trend={stats.last7DaysViews > 0 ? "up" : "neutral"}
        />
        <StatCard
          icon={<Users className="w-4 h-4" />}
          label="Unique Visitors"
          value={stats.uniqueVisitors}
          subValue={`${stats.uniqueClients} identified clients`}
        />
        <StatCard
          icon={<Heart className="w-4 h-4" />}
          label="Likes"
          value={stats.totalLikes}
        />
        <StatCard
          icon={<Download className="w-4 h-4" />}
          label="Downloads"
          value={stats.totalDownloads}
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4 bg-muted/30 border-border/30">
          <div className="flex items-center gap-2 text-sm font-medium mb-3">
            <Clock className="w-4 h-4 text-primary" />
            Peak Hour
          </div>
          <p className="text-xl font-bold">
            {stats.peakHour || "—"}
          </p>
          <p className="text-xs text-muted-foreground">
            Most popular viewing time
          </p>
        </Card>
        <Card className="p-4 bg-muted/30 border-border/30">
          <div className="flex items-center gap-2 text-sm font-medium mb-3">
            <TrendingUp className="w-4 h-4 text-primary" />
            Monthly Activity
          </div>
          <p className="text-xl font-bold">
            {stats.monthlyInteractions}
          </p>
          <p className="text-xs text-muted-foreground">
            Interactions in last 30 days
          </p>
        </Card>
      </div>

      {/* Top Clients */}
      {stats.clientActivity.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Active Clients
          </h4>
          <div className="space-y-2">
            {stats.clientActivity.map(([name, activity]) => (
              <Card key={name} className="p-3 bg-muted/30 border-border/30">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{name}</p>
                    <p className="text-xs text-muted-foreground">
                      Last seen {formatDistanceToNow(new Date(activity.lastSeen), { addSuffix: true })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" /> {activity.views}
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart className="w-3 h-3" /> {activity.likes}
                    </span>
                    <span className="flex items-center gap-1">
                      <Download className="w-3 h-3" /> {activity.downloads}
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity Timeline */}
      <div>
        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          Recent Activity
        </h4>
        <ScrollArea className="h-48">
          <div className="space-y-2">
            {stats.recentActivity.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Globe className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No activity yet</p>
                <p className="text-xs">Activity will appear here when clients view the gallery</p>
              </div>
            ) : (
              stats.recentActivity.map((interaction) => (
                <div 
                  key={interaction.id}
                  className="flex items-center gap-3 p-2 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors"
                >
                  <div className="p-1.5 rounded-full bg-muted">
                    {getInteractionIcon(interaction.interaction_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="font-medium">
                        {interaction.client_name || "Anonymous"}
                      </span>
                      {" "}
                      <span className="text-muted-foreground">
                        {getInteractionLabel(interaction.interaction_type)}
                      </span>
                    </p>
                    {interaction.feedback_text && (
                      <p className="text-xs text-muted-foreground truncate">
                        "{interaction.feedback_text}"
                      </p>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(interaction.created_at), { addSuffix: true })}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
