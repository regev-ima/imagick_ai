import { Link } from "react-router-dom";
import { ArrowRight, ScanSearch } from "lucide-react";
import { GalleryStatistics } from "@/components/gallery/GalleryStatistics";

interface InsightsTabProps {
  galleryId: string;
}

export function InsightsTab({ galleryId }: InsightsTabProps) {
  return (
    <div className="space-y-6">
      <Link
        to={`/dashboard/galleries/${galleryId}/insights`}
        className="group relative flex items-center justify-between overflow-hidden rounded-2xl border border-[hsl(var(--neon-pink)/0.3)] bg-gradient-to-br from-[hsl(var(--neon-pink)/0.08)] via-transparent to-[hsl(var(--neon-purple)/0.08)] p-5 transition-colors hover:border-[hsl(var(--neon-pink)/0.6)]"
      >
        <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-[hsl(var(--neon-pink)/0.15)] blur-3xl pointer-events-none" />
        <div className="relative flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[hsl(var(--neon-pink)/0.15)] flex items-center justify-center">
            <ScanSearch className="w-6 h-6 text-[hsl(var(--neon-pink))]" />
          </div>
          <div>
            <p className="text-sm font-medium">View per-photo heatmap and audit log</p>
            <p className="text-[11px] text-muted-foreground">
              Dwell, views, favorites, shares — ranked, and the full who-viewed-when log.
            </p>
          </div>
        </div>
        <ArrowRight className="relative w-5 h-5 text-[hsl(var(--neon-pink))] group-hover:translate-x-1 transition-transform" />
      </Link>

      <GalleryStatistics galleryId={galleryId} />
    </div>
  );
}
