import { useEffect, useState, useCallback } from "react";
import {
  CullingScoreMode,
  getStoredCullingScoreMode,
  setStoredCullingScoreMode,
  cullingScoreToStars,
} from "@/lib/cullingScore";

export function useCullingScoreMode() {
  const [mode, setModeState] = useState<CullingScoreMode>(getStoredCullingScoreMode());

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as CullingScoreMode | undefined;
      if (detail) setModeState(detail);
      else setModeState(getStoredCullingScoreMode());
    };
    window.addEventListener("culling-score-mode-change", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("culling-score-mode-change", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const setMode = useCallback((m: CullingScoreMode) => {
    setStoredCullingScoreMode(m);
    setModeState(m);
  }, []);

  const toStars = useCallback(
    (score: number | null | undefined) => cullingScoreToStars(score, mode),
    [mode]
  );

  return { mode, setMode, toStars };
}
