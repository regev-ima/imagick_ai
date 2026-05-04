import { cn } from "@/lib/utils";

interface TemplateMiniPreviewProps {
  templateId: string;
  darkMode: boolean;
}

export function TemplateMiniPreview({ templateId, darkMode }: TemplateMiniPreviewProps) {
  const bg = darkMode ? "bg-zinc-900" : "bg-stone-100";
  const block = darkMode ? "bg-zinc-700" : "bg-stone-300";
  const blockAlt = darkMode ? "bg-zinc-600" : "bg-stone-400";

  switch (templateId) {
    case "elegant":
      return (
        <div className={cn("w-full h-full rounded-lg overflow-hidden flex flex-col", bg)}>
          {/* Tall hero */}
          <div className={cn("w-full h-[45%]", blockAlt)} />
          {/* Masonry 3-col */}
          <div className="flex-1 p-1.5 grid grid-cols-3 gap-1">
            <div className={cn("rounded-sm", block)} style={{ gridRow: "span 2" }} />
            <div className={cn("rounded-sm", block)} />
            <div className={cn("rounded-sm", block)} />
            <div className={cn("rounded-sm", block)} />
            <div className={cn("rounded-sm", block)} style={{ gridRow: "span 2" }} />
            <div className={cn("rounded-sm", block)} />
          </div>
        </div>
      );

    case "modern":
      return (
        <div className={cn("w-full h-full rounded-lg overflow-hidden flex flex-col", bg)}>
          {/* Medium hero */}
          <div className={cn("w-full h-[35%]", blockAlt)} />
          {/* Tight 3-col grid */}
          <div className="flex-1 p-1 grid grid-cols-3 gap-0.5">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className={cn("rounded-sm", block)} />
            ))}
          </div>
        </div>
      );

    case "editorial":
      return (
        <div className={cn("w-full h-full rounded-lg overflow-hidden flex flex-col gap-1 p-1.5", bg)}>
          {/* Large hero */}
          <div className={cn("w-full h-[40%] rounded-sm", blockAlt)} />
          {/* 2-col pair */}
          <div className="flex gap-1 h-[25%]">
            <div className={cn("flex-1 rounded-sm", block)} />
            <div className={cn("flex-1 rounded-sm", block)} />
          </div>
          {/* Staggered grid */}
          <div className="flex-1 grid grid-cols-3 gap-1">
            <div className={cn("col-span-2 rounded-sm", block)} />
            <div className={cn("rounded-sm", block)} />
          </div>
        </div>
      );

    case "classic":
      return (
        <div className={cn("w-full h-full rounded-lg overflow-hidden flex flex-col", bg)}>
          {/* Full hero with centered text */}
          <div className={cn("w-full h-[40%] relative", blockAlt)}>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className={cn("w-8 h-1 rounded", darkMode ? "bg-white/30" : "bg-white/60")} />
            </div>
          </div>
          {/* Uniform 3-col grid */}
          <div className="flex-1 p-1.5 grid grid-cols-3 gap-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={cn("rounded-sm aspect-[3/2]", block)} />
            ))}
          </div>
        </div>
      );

    case "filmstrip":
      return (
        <div className={cn("w-full h-full rounded-lg overflow-hidden flex flex-col", bg)}>
          {/* Top bar */}
          <div className="px-2 pt-2">
            <div className={cn("w-12 h-1.5 rounded", block)} />
          </div>
          {/* Horizontal slides */}
          <div className="flex-1 flex items-center gap-1.5 px-2 overflow-hidden">
            <div className={cn("shrink-0 w-[55%] h-[70%] rounded-sm", blockAlt)} />
            <div className={cn("shrink-0 w-[55%] h-[70%] rounded-sm opacity-50", block)} />
          </div>
          {/* Bottom counter */}
          <div className="flex justify-center pb-2">
            <div className={cn("w-8 h-1 rounded", block)} />
          </div>
        </div>
      );

    case "story":
      return (
        <div className={cn("w-full h-full rounded-lg overflow-hidden flex flex-col", bg)}>
          {/* Full-screen sections stacked */}
          <div className={cn("w-full h-[50%]", blockAlt)} />
          <div className={cn("w-full h-[50%] opacity-60", block)} />
          {/* Overlay counter */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
            <div className={cn("w-6 h-1 rounded", darkMode ? "bg-white/30" : "bg-black/20")} />
          </div>
        </div>
      );

    default:
      return <div className={cn("w-full h-full rounded-lg", bg)} />;
  }
}
