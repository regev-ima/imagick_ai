import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { HardDrive } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStorageBreakdown } from "@/hooks/useStorageBreakdown";
import { useSubscription } from "@/hooks/useSubscription";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--secondary))",
  "hsl(var(--accent))",
  "hsl(var(--muted-foreground))",
];

const LABELS = ["Originals", "Edited", "Thumbnails", "Trash"];

function formatMb(mb: number) {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${Math.round(mb)} MB`;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border/50 bg-card/95 backdrop-blur-sm px-3 py-2 shadow-lg text-sm">
      <p className="font-semibold">{payload[0].name}</p>
      <p className="text-muted-foreground">{formatMb(payload[0].value)}</p>
    </div>
  );
};

export default function StorageBreakdownChart() {
  const { data, isLoading } = useStorageBreakdown();
  const { storageUsedMb, maxStorageGb } = useSubscription();

  const pieData =
    data?.storageByType
      ? [
          { name: "Originals", value: Math.round(data.storageByType.originals) },
          { name: "Edited", value: Math.round(data.storageByType.edited) },
          { name: "Thumbnails", value: Math.round(data.storageByType.thumbnails) },
          { name: "Trash", value: Math.round(data.storageByType.trash) },
        ].filter((d) => d.value > 0)
      : [];

  const hasData = pieData.length > 0;
  const usedPercent = maxStorageGb > 0 ? ((storageUsedMb / (maxStorageGb * 1024)) * 100).toFixed(1) : "0";

  return (
    <Card className="glass-card border-border/50 hover:border-primary/30 transition-all">
      <CardHeader className="pb-2 px-5 pt-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-secondary/15 flex items-center justify-center">
              <HardDrive className="w-4 h-4 text-secondary" />
            </div>
            <CardTitle className="text-base font-semibold">Storage</CardTitle>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold">{formatMb(storageUsedMb)}</p>
            <p className="text-xs text-muted-foreground">{usedPercent}% of {maxStorageGb} GB</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-2 pb-4">
        {hasData ? (
          <div className="flex items-center gap-4">
            <ResponsiveContainer width={140} height={140}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={38}
                  outerRadius={58}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2">
              {pieData.map((entry, index) => (
                <div key={entry.name} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-xs text-muted-foreground">{entry.name}</span>
                  </div>
                  <span className="text-xs font-medium">{formatMb(entry.value)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="h-[140px] flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <HardDrive className="w-8 h-8 opacity-20" />
            <p className="text-xs">No storage data available</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
