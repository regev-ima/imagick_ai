import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCreditsUsage } from "@/hooks/useCreditsUsage";
import { Zap, Plus, Loader2, Gift, Crown } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, CartesianGrid, ResponsiveContainer } from "recharts";
import { format, parseISO } from "date-fns";
import { useSubscription } from "@/hooks/useSubscription";

interface CreditsUsageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBuyCredits: () => void;
}

export function CreditsUsageModal({ isOpen, onClose, onBuyCredits }: CreditsUsageModalProps) {
  const { data, isLoading, editsUsed, editsTotal, editsRemaining, isUnlimited, periodStart, periodEnd } = useCreditsUsage();
  const { creditGrants, giftCreditsTotal, planCreditsRemaining } = useSubscription();

  const usagePercent = editsTotal > 0 ? (editsUsed / editsTotal) * 100 : 0;

  const dailyAvg = data?.dailyUsage && data.dailyUsage.length > 0
    ? Math.round(data.dailyUsage.reduce((s, d) => s + d.edits, 0) / data.dailyUsage.length)
    : 0;

  const periodLabel = periodStart && periodEnd
    ? `${format(parseISO(periodStart), "MMM d")} – ${format(parseISO(periodEnd), "MMM d, yyyy")}`
    : "This month";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="surface-2 max-h-[85vh] overflow-y-auto p-0 sm:max-w-2xl sm:rounded-[--radius]">
        <DialogHeader className="space-y-0">
          <DialogTitle asChild>
            <span className="aura-microlabel sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-primary/[0.08] px-4 py-2.5 text-accent">
              <Zap className="h-3.5 w-3.5" />
              <span className="truncate">AI Edits Usage</span>
            </span>
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 p-5">
            {/* Summary */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="folio">
                  <span className="text-2xl text-foreground">{editsUsed.toLocaleString()}</span>
                  <span className="text-muted-foreground"> / {isUnlimited ? "Unlimited" : editsTotal.toLocaleString()}</span>
                </div>
                <Button size="sm" className="gap-1" onClick={onBuyCredits}>
                  <Plus className="h-4 w-4" />
                  Upgrade Plan
                </Button>
              </div>
              <Progress value={Math.min(usagePercent, 100)} className="h-3" />
              <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                <span>{isUnlimited ? "Unlimited" : `${editsRemaining.toLocaleString()} remaining`}</span>
                <span>{periodLabel}</span>
              </div>
            </div>

            {/* Credit Sources */}
            {giftCreditsTotal > 0 && !isUnlimited && (
              <div>
                <h3 className="aura-microlabel mb-3">Edit Sources</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-[--radius] border border-border bg-card p-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Crown className="h-4 w-4 text-primary" />
                      <span>Plan edits</span>
                    </div>
                    <span className="folio">{planCreditsRemaining.toLocaleString()}</span>
                  </div>
                  {creditGrants.filter((g: any) => g.status === "active").map((grant: any) => (
                    <div
                      key={grant.id}
                      className="flex items-center justify-between rounded-[--radius] border bg-card p-3 text-sm"
                      style={{ borderColor: "hsl(var(--secondary) / 0.3)" }}
                    >
                      <div className="flex items-center gap-2">
                        <Gift className="h-4 w-4" style={{ color: "hsl(var(--secondary))" }} />
                        <div>
                          <span>Gift credits</span>
                          <p className="text-xs text-muted-foreground">
                            Expires {format(parseISO(grant.expires_at), "MMM d, yyyy")}
                          </p>
                          {grant.reason && (
                            <p className="text-xs italic text-muted-foreground">{grant.reason}</p>
                          )}
                        </div>
                      </div>
                      <span className="folio" style={{ color: "hsl(var(--secondary))" }}>{grant.credits_remaining.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* By Gallery */}
            {data?.editsByGallery && data.editsByGallery.length > 0 && (
              <div>
                <h3 className="aura-microlabel mb-3">AI Edits by Gallery</h3>
                <div className="overflow-hidden rounded-[--radius] border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Gallery</TableHead>
                        <TableHead className="text-right">Edits</TableHead>
                        <TableHead className="text-right">%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.editsByGallery.map((g) => (
                        <TableRow key={g.gallery_id}>
                          <TableCell className="font-medium truncate max-w-[220px]">{g.gallery_name}</TableCell>
                          <TableCell className="text-right">{g.edits.toLocaleString()}</TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {editsUsed > 0 ? ((g.edits / editsUsed) * 100).toFixed(0) : 0}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {data?.editsByGallery?.length === 0 && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No AI edits this billing period yet.
              </div>
            )}

            {/* Daily Timeline */}
            {data?.dailyUsage && data.dailyUsage.length > 1 && (
              <div>
                <h3 className="aura-microlabel mb-3">Daily Usage</h3>
                <div className="h-[180px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.dailyUsage}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(v) => format(parseISO(v), "d")}
                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                        stroke="hsl(var(--border))"
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                        stroke="hsl(var(--border))"
                        width={40}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "var(--radius)",
                          color: "hsl(var(--foreground))",
                        }}
                        labelFormatter={(v) => format(parseISO(v as string), "MMM d")}
                      />
                      <ReferenceLine
                        y={dailyAvg}
                        stroke="hsl(var(--muted-foreground))"
                        strokeDasharray="5 5"
                        label={{ value: `Avg: ${dailyAvg}`, position: "right", fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      />
                      <Line
                        type="monotone"
                        dataKey="edits"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, fill: "hsl(var(--primary))" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Tips */}
            <div>
              <h3 className="aura-microlabel mb-3">Save Edits</h3>
              <div className="space-y-2">
                <div className="rounded-[--radius] border border-border bg-card p-3">
                  <p className="text-sm font-medium tracking-tight">Cull Before Editing</p>
                  <p className="text-xs text-muted-foreground">Run AI culling first to edit only the best photos</p>
                </div>
                <div className="flex items-center justify-between rounded-[--radius] border border-border bg-card p-3">
                  <div>
                    <p className="text-sm font-medium tracking-tight">Upgrade Your Plan</p>
                    <p className="text-xs text-muted-foreground">Get more edits with a higher plan</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={onBuyCredits}>Upgrade Plan</Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
