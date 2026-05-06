import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg truncate">
            <Zap className="w-5 h-5 text-primary shrink-0" />
            <span className="truncate">AI Edits Usage</span>
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-2xl font-bold">{editsUsed.toLocaleString()}</span>
                  <span className="text-muted-foreground"> / {isUnlimited ? "Unlimited" : editsTotal.toLocaleString()}</span>
                </div>
                <Button size="sm" className="gap-1" onClick={onBuyCredits}>
                  <Plus className="w-4 h-4" />
                  Upgrade Plan
                </Button>
              </div>
              <Progress value={Math.min(usagePercent, 100)} className="h-3" />
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{isUnlimited ? "Unlimited" : `${editsRemaining.toLocaleString()} remaining`}</span>
                <span>{periodLabel}</span>
              </div>
            </div>

            {/* Credit Sources */}
            {giftCreditsTotal > 0 && !isUnlimited && (
              <div>
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Edit Sources</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 text-sm">
                    <div className="flex items-center gap-2">
                      <Crown className="w-4 h-4 text-primary" />
                      <span>Plan edits</span>
                    </div>
                    <span className="font-medium">{planCreditsRemaining.toLocaleString()}</span>
                  </div>
                  {creditGrants.filter((g: any) => g.status === "active").map((grant: any) => (
                    <div key={grant.id} className="flex items-center justify-between p-3 rounded-lg bg-green-500/5 border border-green-500/20 text-sm">
                      <div className="flex items-center gap-2">
                        <Gift className="w-4 h-4 text-green-500" />
                        <div>
                          <span>Gift credits</span>
                          <p className="text-xs text-muted-foreground">
                            Expires {format(parseISO(grant.expires_at), "MMM d, yyyy")}
                          </p>
                          {grant.reason && (
                            <p className="text-xs text-muted-foreground italic">{grant.reason}</p>
                          )}
                        </div>
                      </div>
                      <span className="font-medium">{grant.credits_remaining.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* By Gallery */}
            {data?.editsByGallery && data.editsByGallery.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">AI Edits by Gallery</h3>
                <div className="rounded-lg border border-border overflow-hidden">
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
              <div className="text-center py-6 text-muted-foreground text-sm">
                No AI edits this billing period yet.
              </div>
            )}

            {/* Daily Timeline */}
            {data?.dailyUsage && data.dailyUsage.length > 1 && (
              <div>
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Daily Usage</h3>
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
                          borderRadius: "8px",
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
              <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Save Edits</h3>
              <div className="space-y-2">
                <Card className="border-border/50">
                  <CardContent className="p-3">
                    <p className="text-sm font-medium">Cull Before Editing</p>
                    <p className="text-xs text-muted-foreground">Run AI culling first to edit only the best photos</p>
                  </CardContent>
                </Card>
                <Card className="border-border/50">
                  <CardContent className="p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Upgrade Your Plan</p>
                      <p className="text-xs text-muted-foreground">Get more edits with a higher plan</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={onBuyCredits}>Upgrade Plan</Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
