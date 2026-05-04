import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, AlertTriangle, Upload, ChevronDown, ChevronUp } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface ImportProgress {
  current: number;
  total: number;
}

interface StyleStatusCardProps {
  status: string;
  importProgress?: ImportProgress;
  errorDetails?: string[];
}

export function StyleStatusCard({ status, importProgress, errorDetails }: StyleStatusCardProps) {
  const { isAdmin } = useUserRole();
  if (status === "ready" || status === "deleted") return null;

  if (status === "importing") {
    const current = importProgress?.current ?? 0;
    const total = importProgress?.total ?? 0;
    const percent = total > 0 ? Math.round((current / total) * 100) : 0;
    const isComplete = (importProgress as any)?.isComplete === true;

    if (isComplete) {
      return (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-secondary/30 bg-secondary/5">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }}>
                  <Sparkles className="w-5 h-5 text-secondary" />
                </motion.div>
                <div>
                  <h3 className="font-semibold text-lg">Import Complete — Starting Training...</h3>
                  <p className="text-sm text-muted-foreground">All {total} files imported. Preparing AI training...</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      );
    }

    return (
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="border-accent/30 bg-accent/5">
          <CardContent className="p-6 space-y-3">
            <div className="flex items-center gap-3">
              <Upload className="w-5 h-5 text-accent animate-pulse" />
              <h3 className="font-semibold text-lg">Importing from Google Drive...</h3>
            </div>
            <Progress value={percent} className="h-2" />
            <p className="text-sm text-muted-foreground">
              {current}/{total} files ({percent}%)
            </p>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  if (status === "training") {
    return (
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="border-secondary/30 bg-secondary/5">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }}>
                <Sparkles className="w-5 h-5 text-secondary" />
              </motion.div>
              <div>
                <h3 className="font-semibold text-lg">Training in Progress</h3>
                <p className="text-sm text-muted-foreground">
                  Your AI style is being trained. This usually takes 30-60 minutes.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

   if (status === "error") {
    return (
      <ErrorCard isAdmin={isAdmin} errorDetails={errorDetails} />
    );
  }

  return null;
}

function ErrorCard({ isAdmin, errorDetails }: { isAdmin: boolean; errorDetails?: string[] }) {
  const [showDetails, setShowDetails] = useState(false);
  const hasDetails = isAdmin && errorDetails && errorDetails.length > 0;

  return (
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-lg text-destructive">Training Failed</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Something went wrong during training.{!hasDetails && " Please contact support for assistance."}
              </p>
              {hasDetails && (
                <>
                  <button
                    onClick={() => setShowDetails((v) => !v)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-2"
                  >
                    {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    {showDetails ? "Hide technical details" : "Show technical details"}
                  </button>
                  <AnimatePresence>
                    {showDetails && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="max-h-40 overflow-y-auto rounded-lg bg-destructive/5 p-3 mt-2 border border-destructive/10">
                          <ul className="font-mono text-xs text-muted-foreground space-y-1 list-disc list-inside">
                            {errorDetails.map((detail, i) => (
                              <li key={i} className="break-all">{detail}</li>
                            ))}
                          </ul>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
