import { useEffect, useRef } from "react";
import { toast } from "sonner";

const STORAGE_KEY = "gift-credits-seen";

function getSeenGrantIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function markGrantsSeen(ids: string[]) {
  const existing = getSeenGrantIds();
  const merged = Array.from(new Set([...existing, ...ids]));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
}

function fireConfetti(): () => void {
  // Respect users who prefer no motion — skip the visual entirely.
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    return () => {};
  }

  const colors = ["#22c55e", "#4ade80", "#86efac", "#10b981", "#34d399", "#fbbf24", "#f59e0b"];
  const container = document.createElement("div");
  container.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden";
  document.body.appendChild(container);

  for (let i = 0; i < 60; i++) {
    const particle = document.createElement("div");
    const color = colors[Math.floor(Math.random() * colors.length)];
    const x = Math.random() * 100;
    const delay = Math.random() * 0.3;
    const duration = 1.5 + Math.random() * 1.5;
    const size = 6 + Math.random() * 6;
    const rotation = Math.random() * 360;

    particle.style.cssText = `
      position:absolute;
      top:-10px;
      left:${x}%;
      width:${size}px;
      height:${size * 0.6}px;
      background:${color};
      border-radius:${Math.random() > 0.5 ? "50%" : "2px"};
      opacity:1;
      transform:rotate(${rotation}deg);
      animation:confetti-fall ${duration}s ease-in ${delay}s forwards;
    `;
    container.appendChild(particle);
  }

  // Inject keyframes if not already present
  if (!document.getElementById("confetti-keyframes")) {
    const style = document.createElement("style");
    style.id = "confetti-keyframes";
    style.textContent = `
      @keyframes confetti-fall {
        0% { transform: translateY(0) rotate(0deg); opacity: 1; }
        100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  let removed = false;
  const remove = () => {
    if (removed) return;
    removed = true;
    container.remove();
  };
  const timeoutId = window.setTimeout(remove, 4000);
  return () => {
    clearTimeout(timeoutId);
    remove();
  };
}

interface CreditGrant {
  id: string;
  status: string;
  credits_remaining: number;
  [key: string]: any;
}

export function useGiftCreditsCelebration(creditGrants: CreditGrant[]) {
  const hasFired = useRef(false);

  useEffect(() => {
    if (hasFired.current) return;

    const activeGrants = creditGrants.filter(
      (g) => g.status === "active" && g.credits_remaining > 0
    );
    if (activeGrants.length === 0) return;

    const seenIds = getSeenGrantIds();
    const unseenGrants = activeGrants.filter((g) => !seenIds.includes(g.id));
    if (unseenGrants.length === 0) return;

    hasFired.current = true;

    const cleanup = fireConfetti();

    const totalNew = unseenGrants.reduce((s, g) => s + g.credits_remaining, 0);
    toast.success(`You received ${totalNew.toLocaleString()} bonus credits!`, {
      description: "These gift credits have been added to your account.",
      duration: 5000,
    });

    markGrantsSeen(unseenGrants.map((g) => g.id));

    return cleanup;
  }, [creditGrants]);
}
