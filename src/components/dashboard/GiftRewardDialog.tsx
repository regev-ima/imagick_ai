import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Gift, Coins, Sparkles } from "lucide-react";
import { fireConfetti } from "@/hooks/useGiftCreditsCelebration";

// Namespaced ids of gifts the user has already acknowledged, so the popup never
// fires twice for the same grant (whether they confirmed or closed it).
const SEEN_KEY = "gift-rewards-seen";
// Legacy key the old toast-based celebration used (credits only) — migrated so
// already-celebrated credit gifts don't re-pop as a modal.
const LEGACY_CREDIT_KEY = "gift-credits-seen";

function loadSeen(): Set<string> {
  const seen = new Set<string>();
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (raw) for (const id of JSON.parse(raw) as string[]) seen.add(id);
  } catch {
    /* ignore */
  }
  try {
    const legacy = localStorage.getItem(LEGACY_CREDIT_KEY);
    if (legacy) for (const id of JSON.parse(legacy) as string[]) seen.add(`credit:${id}`);
  } catch {
    /* ignore */
  }
  return seen;
}

function markSeen(keys: string[]) {
  const seen = loadSeen();
  keys.forEach((k) => seen.add(k));
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
  } catch {
    /* ignore quota */
  }
}

interface CreditGrant {
  id: string;
  status: string;
  grant_type?: string;
  credits_remaining?: number;
  credits_initial?: number;
}
interface ModelGrant {
  id: string;
  status: string;
  quantity?: number;
}

/**
 * Celebrates admin-granted gifts (bonus credits and/or extra style slots) with
 * confetti and a confirm/close popup. Fires once per grant — after the user
 * confirms OR closes it, that grant is marked seen and never pops again.
 */
export function GiftRewardDialog({
  creditGrants = [],
  modelGrants = [],
}: {
  creditGrants?: CreditGrant[];
  modelGrants?: ModelGrant[];
}) {
  const [open, setOpen] = useState(false);
  const cleanupRef = useRef<() => void>(() => {});
  const firedRef = useRef(false);

  const pending = useMemo(() => {
    const seen = loadSeen();
    const credits = creditGrants.filter(
      (g) =>
        g.status === "active" &&
        (g.credits_remaining ?? 0) > 0 &&
        g.grant_type === "gift" &&
        !seen.has(`credit:${g.id}`),
    );
    const models = modelGrants.filter((g) => g.status === "active" && !seen.has(`model:${g.id}`));
    return { credits, models };
  }, [creditGrants, modelGrants]);

  const creditTotal = pending.credits.reduce((s, g) => s + (g.credits_remaining ?? g.credits_initial ?? 0), 0);
  const modelTotal = pending.models.reduce((s, g) => s + (g.quantity ?? 1), 0);
  const hasGift = creditTotal > 0 || modelTotal > 0;

  const keys = useMemo(
    () => [
      ...pending.credits.map((g) => `credit:${g.id}`),
      ...pending.models.map((g) => `model:${g.id}`),
    ],
    [pending],
  );

  useEffect(() => {
    if (!hasGift || firedRef.current) return;
    firedRef.current = true;
    setOpen(true);
    cleanupRef.current = fireConfetti();
    return () => cleanupRef.current?.();
  }, [hasGift]);

  const dismiss = () => {
    markSeen(keys);
    cleanupRef.current?.();
    setOpen(false);
  };

  if (!hasGift) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) dismiss(); }}>
      <DialogContent className="text-center sm:max-w-md">
        <DialogHeader className="items-center">
          <div className="mx-auto mb-2 grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
            <Gift className="h-7 w-7" />
          </div>
          <DialogTitle className="text-xl">You've got a gift! 🎉</DialogTitle>
          <DialogDescription>A little something added to your account, on us.</DialogDescription>
        </DialogHeader>

        <div className="my-2 flex flex-col items-center gap-3">
          {creditTotal > 0 && (
            <div className="flex items-center gap-2 rounded-[--radius] border border-border bg-surface-2/40 px-4 py-2.5">
              <Coins className="h-5 w-5 text-rating" />
              <span className="text-lg font-semibold">+{creditTotal.toLocaleString()}</span>
              <span className="text-sm text-muted-foreground">bonus credits</span>
            </div>
          )}
          {modelTotal > 0 && (
            <div className="flex items-center gap-2 rounded-[--radius] border border-border bg-surface-2/40 px-4 py-2.5">
              <Sparkles className="h-5 w-5 text-accent" />
              <span className="text-lg font-semibold">+{modelTotal}</span>
              <span className="text-sm text-muted-foreground">extra style slot{modelTotal === 1 ? "" : "s"}</span>
            </div>
          )}
        </div>

        <DialogFooter className="sm:justify-center">
          <Button variant="glow" onClick={dismiss} className="min-w-[160px]">Awesome, thanks!</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
