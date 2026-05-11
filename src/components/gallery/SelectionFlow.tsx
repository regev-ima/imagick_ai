import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, Check, X, ArrowLeftRight, Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import type { TemplateImage } from "@/components/gallery/templates/types";
import { toast } from "sonner";

interface SelectionFlowProps {
  galleryId: string;
  images: TemplateImage[];
  targetCount: number;
  suggestedImageIds: Set<string>;
  sessionToken?: string;
  clientEmail?: string;
  clientName?: string;
  onComplete: () => void;
  onClose: () => void;
}

/**
 * SelectionFlow — the "wow moment" for the client.
 *
 * Mode A: review AI suggestions in a swipeable carousel (Keep / Swap).
 * Mode B: open a grid of non-selected images and tap one to swap in.
 *
 * Visually: editorial silence. Generous spacing, Playfair captions, 320ms
 * cross-fades, no bouncy springs.
 */
export function SelectionFlow({
  galleryId,
  images,
  targetCount,
  suggestedImageIds,
  sessionToken: _sessionToken,
  clientEmail,
  clientName,
  onComplete,
  onClose,
}: SelectionFlowProps) {
  // Current "live" selection: starts as the AI-suggested set, mutated by swaps.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(suggestedImageIds)
  );
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());
  const [swapForImageId, setSwapForImageId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Order matters for the carousel — sort by ai_rating desc so the most
  // confident picks are at the front, gentle reveal of weaker ones later.
  const queue = useMemo(() => {
    const list = images.filter((img) => selectedIds.has(img.id));
    return list.sort((a, b) => (b.ai_rating ?? 0) - (a.ai_rating ?? 0));
  }, [images, selectedIds]);

  const [emblaRef, embla] = useEmblaCarousel({
    loop: false,
    align: "center",
    duration: 28, // ~320ms — matches the design grammar in SKILL.md
  });
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!embla) return;
    const onSelect = () => setActiveIndex(embla.selectedScrollSnap());
    embla.on("select", onSelect);
    onSelect();
    return () => {
      embla.off("select", onSelect);
    };
  }, [embla]);

  // Lock background scroll while the overlay is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Esc closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (swapForImageId) setSwapForImageId(null);
        else onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [swapForImageId, onClose]);

  const totalToReview = queue.length;
  const reviewedCount = reviewedIds.size;
  const allReviewed = reviewedCount >= totalToReview && totalToReview > 0;
  const currentImage = queue[activeIndex];

  const callToggle = async (imageId: string, selected: boolean) => {
    // RPC may not be typed in supabase/types.ts yet — cast to any.
    const { error } = await (supabase.rpc as any)("client_toggle_selection", {
      p_gallery_id: galleryId,
      p_image_id: imageId,
      p_client_email: clientEmail ?? null,
      p_client_name: clientName ?? null,
      p_selected: selected,
    });
    if (error) throw error;
  };

  const handleKeep = () => {
    if (!currentImage) return;
    setReviewedIds((prev) => new Set(prev).add(currentImage.id));
    // No RPC call — the AI's pre-selection rows already exist on the server.
    if (embla && activeIndex < totalToReview - 1) embla.scrollNext();
  };

  const handleSwap = (newImageId: string) => {
    if (!swapForImageId) return;
    const removeId = swapForImageId;
    setSwapForImageId(null);
    setIsSubmitting(true);

    // Optimistic UI: swap in local set immediately so the carousel updates.
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(removeId);
      next.add(newImageId);
      return next;
    });
    setReviewedIds((prev) => {
      const next = new Set(prev);
      next.delete(removeId);
      next.add(newImageId);
      return next;
    });

    // Fire RPC pair (remove old, add new). If either fails we surface a toast
    // but leave the optimistic state — selection is best-effort and the
    // server's cap-check is the source of truth on submit.
    Promise.allSettled([
      callToggle(removeId, false),
      callToggle(newImageId, true),
    ])
      .then((results) => {
        const failed = results.find((r) => r.status === "rejected");
        if (failed && failed.status === "rejected") {
          const message =
            (failed.reason as { message?: string })?.message ?? "Couldn't save swap";
          toast.error(message);
        }
      })
      .finally(() => setIsSubmitting(false));
  };

  const handleFinalize = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const { error: invokeError } = await supabase.functions.invoke(
        "gallery-finalize-selection",
        {
          body: {
            galleryId,
            clientEmail: clientEmail ?? null,
            clientName: clientName ?? null,
          },
        }
      );
      if (invokeError) throw invokeError;
      setSubmitted(true);
      // Hold on the confetti for a beat before yielding control.
      setTimeout(() => {
        onComplete();
      }, 2400);
    } catch (e: any) {
      setError(e?.message ?? "Couldn't send selection. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Pool of non-selected images for the swap modal (Mode B).
  const swapCandidates = useMemo(
    () => images.filter((img) => !selectedIds.has(img.id)),
    [images, selectedIds]
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-0 z-[70] overflow-hidden"
      style={{
        background: "#0b0a09",
        color: "#f5f3ee",
        fontFamily: "var(--brand-font-body, 'Inter', system-ui, sans-serif)",
      }}
    >
      {/* Subtle film-grain wash — keeps the surface feeling photographic rather than digital. */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180' viewBox='0 0 180 180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.5'/></svg>\")",
        }}
      />

      {/* Top bar — progress + close. Generous breathing room, no chrome. */}
      <div className="relative z-10 flex items-center justify-between px-5 md:px-10 pt-6 md:pt-8">
        <div className="flex-1 max-w-md">
          <p
            className="text-[10px] tracking-[0.32em] uppercase opacity-60 mb-2"
            style={{ fontFamily: "var(--brand-font-body)" }}
          >
            {submitted ? "Sent" : allReviewed ? "Ready to send" : "Review"}
          </p>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-white/15 rounded-full overflow-hidden">
              <motion.div
                className="h-full"
                style={{
                  background:
                    "linear-gradient(90deg, var(--brand-primary, #f5f3ee), var(--brand-accent, #f5f3ee))",
                }}
                initial={{ width: 0 }}
                animate={{
                  width: `${totalToReview ? (reviewedCount / totalToReview) * 100 : 0}%`,
                }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
            <span
              className="text-sm tabular-nums opacity-70 whitespace-nowrap"
              style={{ fontFamily: "var(--brand-font-display)" }}
            >
              {reviewedCount} <span className="opacity-50">/</span> {totalToReview}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="ml-6 p-2 rounded-full hover:bg-white/10 transition-colors"
          aria-label="Close selection"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Body — three states: review (carousel), swap (grid), finalize. */}
      <AnimatePresence mode="wait">
        {submitted ? (
          <FinalizeScreen
            key="finalize"
            count={selectedIds.size}
            target={targetCount}
          />
        ) : allReviewed && !swapForImageId ? (
          <ReadyToSendScreen
            key="ready"
            count={selectedIds.size}
            target={targetCount}
            onSend={handleFinalize}
            isSubmitting={isSubmitting}
            error={error}
          />
        ) : !swapForImageId && currentImage ? (
          <motion.div
            key="carousel"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.32 }}
            className="relative z-0 h-[calc(100%-72px)] flex flex-col"
          >
            <div className="flex-1 overflow-hidden" ref={emblaRef}>
              <div className="flex h-full">
                {queue.map((img, idx) => (
                  <div
                    key={img.id}
                    className="relative shrink-0 grow-0 basis-full h-full flex items-center justify-center px-4 md:px-12"
                  >
                    <div className="relative w-full max-w-[1100px] h-full flex flex-col items-center justify-center">
                      <motion.img
                        src={img.original_url}
                        alt={img.filename}
                        className="max-h-[58vh] md:max-h-[64vh] w-auto max-w-full object-contain select-none"
                        draggable={false}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: idx === activeIndex ? 1 : 0.35 }}
                        transition={{ duration: 0.32, ease: "easeOut" }}
                      />
                      <p
                        className="mt-6 md:mt-8 text-center max-w-2xl px-4 leading-relaxed text-base md:text-lg opacity-80"
                        style={{
                          fontFamily: "var(--brand-font-display)",
                          fontStyle: "italic",
                        }}
                      >
                        {/* TODO: replace placeholder reasoning with real per-image AI rationale once gallery-suggest-selection writes it back. */}
                        Photo {idx + 1} of {totalToReview} — picked for its
                        light, expression, and place in the story.
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Carousel controls + actions */}
            <div className="px-5 md:px-10 py-6 md:py-8 flex items-center justify-between gap-3">
              <button
                onClick={() => embla?.scrollPrev()}
                disabled={activeIndex === 0}
                className="p-3 rounded-full bg-white/8 hover:bg-white/14 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                aria-label="Previous"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3">
                <button
                  onClick={() =>
                    currentImage && setSwapForImageId(currentImage.id)
                  }
                  className="px-5 md:px-7 py-3 rounded-full border border-white/25 hover:border-white/60 hover:bg-white/5 transition-all flex items-center gap-2 text-sm tracking-wide"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  Swap
                </button>
                <button
                  onClick={handleKeep}
                  className={cn(
                    "px-7 md:px-9 py-3 rounded-full transition-all flex items-center gap-2 text-sm tracking-wide font-medium",
                    "bg-[color:var(--brand-primary,#f5f3ee)] text-[#0b0a09] hover:opacity-90"
                  )}
                >
                  <Check className="w-4 h-4" />
                  Keep
                </button>
              </div>

              <button
                onClick={() => embla?.scrollNext()}
                disabled={activeIndex === totalToReview - 1}
                className="p-3 rounded-full bg-white/8 hover:bg-white/14 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                aria-label="Next"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Swap modal — Mode B. */}
      <AnimatePresence>
        {swapForImageId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24 }}
            className="absolute inset-0 z-20 overflow-y-auto"
            style={{ background: "rgba(11,10,9,0.96)" }}
          >
            <div className="max-w-6xl mx-auto px-5 md:px-10 pt-20 pb-16">
              <div className="flex items-center justify-between mb-6 md:mb-10">
                <div>
                  <p className="text-[10px] tracking-[0.32em] uppercase opacity-60 mb-2">
                    Choose a replacement
                  </p>
                  <h2
                    className="text-2xl md:text-4xl"
                    style={{ fontFamily: "var(--brand-font-display)" }}
                  >
                    Pick the photo you want instead.
                  </h2>
                </div>
                <button
                  onClick={() => setSwapForImageId(null)}
                  className="p-2 rounded-full hover:bg-white/10 transition-colors"
                  aria-label="Cancel swap"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {swapCandidates.length === 0 ? (
                <p className="opacity-60">
                  No other photos available to swap in.
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
                  {swapCandidates.map((img) => (
                    <button
                      key={img.id}
                      onClick={() => handleSwap(img.id)}
                      className="group relative overflow-hidden rounded-md aspect-[3/4] bg-white/5"
                    >
                      <img
                        src={img.original_url}
                        alt={img.filename}
                        loading="lazy"
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                      <div className="absolute inset-x-0 bottom-0 p-2 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <span
                          className="text-[10px] tracking-[0.2em] uppercase px-2 py-1 rounded-full"
                          style={{
                            background:
                              "color-mix(in srgb, var(--brand-primary, #f5f3ee) 90%, transparent)",
                            color: "#0b0a09",
                          }}
                        >
                          Swap in
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ReadyToSendScreen({
  count,
  target,
  onSend,
  isSubmitting,
  error,
}: {
  count: number;
  target: number;
  onSend: () => void;
  isSubmitting: boolean;
  error: string | null;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="relative z-0 h-[calc(100%-72px)] flex flex-col items-center justify-center px-6 text-center"
    >
      <p className="text-[10px] tracking-[0.32em] uppercase opacity-60 mb-6">
        Selection complete
      </p>
      <h2
        className="text-3xl md:text-5xl lg:text-6xl leading-[1.1] max-w-3xl"
        style={{ fontFamily: "var(--brand-font-display)" }}
      >
        You've finalized {count} {count === 1 ? "photo" : "photos"} for your album.
      </h2>
      <p className="mt-6 max-w-md opacity-70 text-base md:text-lg leading-relaxed">
        Send this selection to your photographer? You can still revisit and swap
        before they start designing.
      </p>

      <button
        onClick={onSend}
        disabled={isSubmitting}
        className="mt-10 px-9 py-4 rounded-full text-sm tracking-[0.16em] uppercase font-medium disabled:opacity-60 flex items-center gap-3 transition-all"
        style={{
          background: "var(--brand-primary, #f5f3ee)",
          color: "#0b0a09",
        }}
      >
        {isSubmitting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Send className="w-4 h-4" />
        )}
        Send to my photographer
      </button>

      {error && (
        <p className="mt-6 text-sm text-red-400/90 max-w-sm">{error}</p>
      )}

      <p className="mt-10 text-[11px] opacity-40 tracking-widest uppercase">
        Target: {target}
      </p>
    </motion.div>
  );
}

function FinalizeScreen({ count, target: _target }: { count: number; target: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="relative z-0 h-[calc(100%-72px)] flex flex-col items-center justify-center px-6 text-center"
    >
      {/* Restrained confetti — twelve slow petals drift down. No bouncy springs. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 14 }).map((_, i) => {
          const left = (i * 73) % 100;
          const delay = (i % 5) * 0.18;
          const duration = 3 + ((i * 7) % 10) * 0.15;
          const palette = [
            "var(--brand-primary, #f5f3ee)",
            "var(--brand-accent, #d6cfc1)",
            "#f5f3ee",
          ];
          const color = palette[i % palette.length];
          return (
            <motion.span
              key={i}
              initial={{ y: -40, opacity: 0, rotate: 0 }}
              animate={{
                y: "110vh",
                opacity: [0, 1, 1, 0],
                rotate: 360,
              }}
              transition={{
                duration,
                delay,
                ease: "easeIn",
                repeat: Infinity,
                repeatDelay: 1.2,
              }}
              className="absolute top-0 block w-[6px] h-[16px] rounded-full"
              style={{ left: `${left}%`, background: color, opacity: 0.7 }}
            />
          );
        })}
      </div>
      <p className="text-[10px] tracking-[0.32em] uppercase opacity-60 mb-6 relative">
        Sent
      </p>
      <h2
        className="text-3xl md:text-5xl lg:text-6xl leading-[1.1] max-w-3xl relative"
        style={{ fontFamily: "var(--brand-font-display)" }}
      >
        Your photographer has your {count} {count === 1 ? "favorite" : "favorites"}.
      </h2>
      <p className="mt-6 max-w-md opacity-70 text-base md:text-lg leading-relaxed relative">
        Thank you. They'll be in touch when your album is ready.
      </p>
    </motion.div>
  );
}
