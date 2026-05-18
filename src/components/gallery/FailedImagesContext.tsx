import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

// Per-image record stored when a thumbnail gives up retrying. The retry
// callback points back into the ImageCard's local state — that's how the
// "Retry all" button reaches every failed tile without a parent ref.
export interface FailedImageRecord {
  id: string;
  filename: string;
  retry: () => void;
}

interface FailedImagesContextValue {
  /** Ordered list of failed images (most-recently-failed first). */
  failed: FailedImageRecord[];
  /** Set of failed IDs for O(1) filtering of the main grid. */
  failedIds: Set<string>;
  reportFailed: (record: FailedImageRecord) => void;
  reportRecovered: (id: string) => void;
  retryAll: () => void;
}

const FailedImagesContext = createContext<FailedImagesContextValue | null>(null);

export function FailedImagesProvider({ children }: { children: React.ReactNode }) {
  // Use a ref for the actual storage so reportFailed/reportRecovered don't
  // need useState's stale-closure dance; mirror into a versioned state to
  // trigger re-renders + recomputation of `value` below.
  const recordsRef = useRef<Map<string, FailedImageRecord>>(new Map());
  const [version, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const reportFailed = useCallback(
    (record: FailedImageRecord) => {
      // Re-insert moves to end of Map iteration order; we reverse for
      // newest-first display below.
      recordsRef.current.delete(record.id);
      recordsRef.current.set(record.id, record);
      bump();
    },
    [bump],
  );

  const reportRecovered = useCallback(
    (id: string) => {
      if (recordsRef.current.delete(id)) bump();
    },
    [bump],
  );

  const retryAll = useCallback(() => {
    // Snapshot first — retry() triggers reportRecovered which mutates
    // the Map during iteration.
    const snapshot = Array.from(recordsRef.current.values());
    for (const record of snapshot) {
      try {
        record.retry();
      } catch {
        /* tile may have unmounted between failure and retry-all click */
      }
    }
  }, []);

  const value = useMemo<FailedImagesContextValue>(() => {
    const records = Array.from(recordsRef.current.values()).reverse();
    return {
      failed: records,
      failedIds: new Set(records.map((r) => r.id)),
      reportFailed,
      reportRecovered,
      retryAll,
    };
  }, [version, reportFailed, reportRecovered, retryAll]);

  return <FailedImagesContext.Provider value={value}>{children}</FailedImagesContext.Provider>;
}

/**
 * Returns the failed-images context, or a no-op fallback if no provider is
 * mounted. The no-op fallback lets ImageCard be rendered outside the gallery
 * editor (e.g. preview pages) without crashing.
 */
export function useFailedImages(): FailedImagesContextValue {
  const ctx = useContext(FailedImagesContext);
  if (ctx) return ctx;
  return {
    failed: [],
    failedIds: new Set(),
    reportFailed: () => {},
    reportRecovered: () => {},
    retryAll: () => {},
  };
}
