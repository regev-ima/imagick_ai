import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useStorageBreakdown } from "@/hooks/useStorageBreakdown";
import { HardDrive, Trash2, Copy, Archive, ArrowUpCircle, Image, Paintbrush, FileImage, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface StorageBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  onViewPlans?: () => void;
}

function formatSize(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${Math.round(mb)} MB`;
}

export function StorageBreakdownModal({ isOpen, onClose, onViewPlans }: StorageBreakdownModalProps) {
  const { data, isLoading } = useStorageBreakdown();
  const navigate = useNavigate();

  const totalMb = data?.totalStorageMb || 0;
  const maxGb = data?.maxStorageGb || 5;
  const maxMb = maxGb * 1024;
  const usagePercent = maxMb > 0 ? (totalMb / maxMb) * 100 : 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="surface-2 max-h-[85vh] overflow-y-auto p-0 sm:max-w-2xl sm:rounded-[--radius]">
        <DialogHeader className="space-y-0">
          <DialogTitle asChild>
            <span className="aura-microlabel sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background/40 px-4 py-2.5">
              <HardDrive className="h-3.5 w-3.5" />
              Storage Breakdown
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
              <div className="flex items-baseline justify-between">
                <span className="folio text-2xl text-foreground">{formatSize(totalMb)}</span>
                <span className="folio text-muted-foreground">/ {maxGb} GB</span>
              </div>
              <Progress value={Math.min(usagePercent, 100)} className="h-3" />
              <p className="text-sm text-muted-foreground">
                {usagePercent.toFixed(1)}% used
                {usagePercent < 80 && totalMb > 0 && ` · At this rate, you have plenty of room`}
                {usagePercent >= 80 && usagePercent < 95 && ` · Getting close to your limit`}
                {usagePercent >= 95 && ` · Almost full! Consider upgrading or cleaning up`}
              </p>
            </div>

            {/* By Gallery */}
            {data?.galleries && data.galleries.length > 0 && (
              <div>
                <h3 className="aura-microlabel mb-3">By Gallery</h3>
                <div className="overflow-hidden rounded-[--radius] border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Gallery</TableHead>
                        <TableHead className="text-right">Images</TableHead>
                        <TableHead className="text-right">Size</TableHead>
                        <TableHead className="text-right">%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.galleries.slice(0, 10).map((g) => (
                        <TableRow
                          key={g.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => {
                            onClose();
                            navigate(`/dashboard/gallery/${g.id}`);
                          }}
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <span className="truncate max-w-[200px]">{g.name}</span>
                              {g.percentOfTotal > 25 && (
                                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Large</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{g.imageCount.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{formatSize(g.estimatedSizeMb)}</TableCell>
                          <TableCell className="text-right">{g.percentOfTotal.toFixed(1)}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* By Type */}
            {data?.storageByType && totalMb > 0 && (
              <div>
                <h3 className="aura-microlabel mb-3">By Type</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Original Images", icon: Image, value: data.storageByType.originals },
                    { label: "Edited Images", icon: Paintbrush, value: data.storageByType.edited },
                    { label: "Thumbnails", icon: FileImage, value: data.storageByType.thumbnails },
                    { label: "Trash", icon: Trash2, value: data.storageByType.trash },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-3 rounded-[--radius] border border-border bg-card p-3">
                      <item.icon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">{item.label}</p>
                        <p className="folio text-sm text-foreground">{formatSize(item.value)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tips */}
            <div>
              <h3 className="aura-microlabel mb-3">Free Up Space</h3>
              <div className="space-y-2">
                {(data?.trashCount || 0) > 0 && (
                  <div className="flex items-center justify-between rounded-[--radius] border border-border bg-card p-3">
                    <div className="flex items-center gap-3">
                      <Trash2 className="h-4 w-4 text-destructive" />
                      <div>
                        <p className="text-sm font-medium tracking-tight">Empty Trash</p>
                        <p className="text-xs text-muted-foreground">
                          {data!.trashCount} images in trash · ~{formatSize(data!.storageByType.trash)}
                        </p>
                      </div>
                    </div>
                    <Button size="sm" variant="outline">Empty Now</Button>
                  </div>
                )}

                {(data?.inactiveGalleries?.length || 0) > 0 && (
                  <div className="flex items-center justify-between rounded-[--radius] border border-border bg-card p-3">
                    <div className="flex items-center gap-3">
                      <Archive className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium tracking-tight">Archive Old Galleries</p>
                        <p className="text-xs text-muted-foreground">
                          {data!.inactiveGalleries.length} galleries inactive for 90+ days
                        </p>
                      </div>
                    </div>
                    <Button size="sm" variant="outline">Review</Button>
                  </div>
                )}

                <div className="flex items-center justify-between rounded-[--radius] border border-border bg-card p-3">
                  <div className="flex items-center gap-3">
                    <ArrowUpCircle className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-sm font-medium tracking-tight">Need More Space?</p>
                      <p className="text-xs text-muted-foreground">Upgrade your plan for more storage</p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => { onClose(); onViewPlans?.(); }}>View Plans</Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
