import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface CategoryNavProps {
  categories: string[];
  activeCategory: string | null;
  onCategoryChange: (category: string | null) => void;
  darkMode: boolean;
  totalCount: number;
}

/**
 * Brand category filter — a clean pill rail. The active pill carries the brand
 * royal blue (#2B50F0); inactive pills are calm tonal surfaces. Chrome recedes
 * so the photos stay the hero.
 *
 * `darkMode` is kept in the signature (every template passes it) but theming
 * now flows through the semantic tokens scoped on each template's root, so the
 * rail inherits the correct porcelain / graphite palette automatically, and the
 * accent stays brand royal blue across both themes.
 */
export function CategoryNav({
  categories,
  activeCategory,
  onCategoryChange,
  totalCount,
}: CategoryNavProps) {
  if (categories.length === 0) return null;

  const pillBase =
    "relative px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap font-sans";
  const items: Array<{ key: string; label: string; value: string | null }> = [
    { key: "__all__", label: `All · ${totalCount}`, value: null },
    ...categories.map((cat) => ({ key: cat, label: cat, value: cat })),
  ];

  return (
    <div className="w-full overflow-x-auto scrollbar-hide">
      <div className="flex items-center gap-2 py-2 px-1 min-w-min">
        {items.map((item) => {
          const isActive = activeCategory === item.value;
          return (
            <button
              key={item.key}
              onClick={() => onCategoryChange(item.value)}
              className={cn(
                pillBase,
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="category-pill"
                  transition={{ duration: 0.4, ease: [0.2, 0, 0, 1] }}
                  className="absolute inset-0 rounded-full bg-primary/10 ring-1 ring-primary/35"
                />
              )}
              {!isActive && (
                <span className="absolute inset-0 rounded-full bg-muted/60 border border-border/60" />
              )}
              <span className="relative z-10">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
