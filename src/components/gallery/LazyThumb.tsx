import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { canPreviewInBrowser } from "@/lib/imageFileTypes";

// ── Lazy thumbnails ────────────────────────────────────────────────────────
// Selecting thousands of photos used to freeze the tab: the selection flows
// eagerly created an object URL for EVERY file and the browser decoded them all
// (and object URLs pin their File in memory). Instead, a tile builds its object
// URL only when it scrolls near the viewport (and revokes it on unmount), so
// memory stays flat no matter how many files are queued. One shared
// IntersectionObserver drives every tile, so even a review modal with thousands
// of tiles registers a single observer.
//
// Shared by CreateStylePage (before/after training sets) and CreateGalleryPage
// (collection uploads) so both behave identically.
const thumbCallbacks = new WeakMap<Element, () => void>();
let thumbObserver: IntersectionObserver | null = null;
function getThumbObserver(): IntersectionObserver {
  if (!thumbObserver) {
    thumbObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) thumbCallbacks.get(entry.target)?.();
        }
      },
      { rootMargin: "300px" },
    );
  }
  return thumbObserver;
}

export function LazyThumb({ file, dim = false }: { file: File; dim?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const previewable = canPreviewInBrowser(file);

  useEffect(() => {
    if (!previewable) return;
    const el = ref.current;
    if (!el) return;
    let created: string | null = null;
    const observer = getThumbObserver();
    const reveal = () => {
      if (created) return;
      created = URL.createObjectURL(file);
      setUrl(created);
      observer.unobserve(el);
      thumbCallbacks.delete(el);
    };
    thumbCallbacks.set(el, reveal);
    observer.observe(el);
    return () => {
      observer.unobserve(el);
      thumbCallbacks.delete(el);
      if (created) URL.revokeObjectURL(created);
    };
  }, [file, previewable]);

  return (
    <div ref={ref} className={cn("absolute inset-0 bg-surface-2", dim && "opacity-60")}>
      {!previewable && (
        <div className="absolute inset-0 grid place-items-center text-center">
          <span className="font-mono text-[8px] font-semibold uppercase tracking-wide text-muted-foreground">
            {file.name.split(".").pop()?.slice(0, 4).toUpperCase() || "IMG"}
          </span>
        </div>
      )}
      {url && (
        <img
          src={url}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
          onError={(e) => { e.currentTarget.style.display = "none"; }}
        />
      )}
    </div>
  );
}
