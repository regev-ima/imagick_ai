/**
 * AuraBackground — the single, canonical ambient wash for the whole app.
 *
 * Rendered once at the dashboard shell root so every screen shares the exact
 * same full-bleed background. It spans the shell root (a non-scrolling
 * `h-screen` box), not the inner `max-w` content column, so the wash reaches
 * edge to edge instead of being clipped to the centered content width.
 * Purely decorative + non-interactive.
 */
export function AuraBackground() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <div className="absolute -top-[18vh] left-1/2 h-[52vh] w-[60vw] -translate-x-1/2 rounded-full bg-primary/[0.10] blur-[140px]" />
      <div className="absolute top-[30vh] -right-[10vw] h-[40vh] w-[36vw] rounded-full bg-secondary/[0.08] blur-[130px]" />
      <div className="absolute bottom-0 -left-[8vw] h-[36vh] w-[32vw] rounded-full bg-accent/[0.07] blur-[120px]" />
    </div>
  );
}
