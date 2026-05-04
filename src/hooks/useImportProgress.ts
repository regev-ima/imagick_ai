import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ImportProgress {
  current: number;
  total: number;
}

export function useImportProgress(
  styleId: string | undefined,
  userId: string | undefined,
  status: string | undefined,
  googleBeforeMetadata: any,
  googleAfterMetadata: any,
  dbImported?: number | null,
  dbTotal?: number | null
) {
  const [progress, setProgress] = useState<ImportProgress>({ current: 0, total: 0 });

  const isImporting = status === "importing";

  const expectedTotal =
    (dbTotal && dbTotal > 0) ? dbTotal :
    (googleBeforeMetadata?.totalImageCount ?? 0) +
    (googleAfterMetadata?.totalImageCount ?? 0);

  const fetchCount = useCallback(async (folder: string, retries = 2): Promise<number | null> => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return null;

        const res = await supabase.functions.invoke("count-files", {
          body: { folder },
        });

        if (res.error || !res.data?.success) {
          if (attempt < retries) {
            await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
            continue;
          }
          return null;
        }
        return res.data?.fileCount ?? null;
      } catch {
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
          continue;
        }
        return null;
      }
    }
    return null;
  }, []);

  useEffect(() => {
    if (!isImporting || !userId || !styleId || expectedTotal === 0) return;

    let cancelled = false;

    const poll = async () => {
      // Try the count-files API first
      const [beforeCount, afterCount] = await Promise.all([
        fetchCount(`styles/${userId}/${styleId}/before/`),
        fetchCount(`styles/${userId}/${styleId}/after/`),
      ]);

      if (cancelled) return;

      // If API succeeded, use its values
      if (beforeCount !== null && afterCount !== null) {
        setProgress({ current: beforeCount + afterCount, total: expectedTotal });
      } else if (dbImported != null && dbImported >= 0) {
        // Fallback to DB fields
        setProgress({ current: dbImported, total: expectedTotal });
      }
    };

    poll();
    const interval = setInterval(poll, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isImporting, userId, styleId, expectedTotal, fetchCount, dbImported]);

  const isComplete = progress.total > 0 && progress.current >= progress.total;

  return isImporting ? { ...progress, isComplete } : undefined;
}
