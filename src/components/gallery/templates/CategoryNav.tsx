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
 * PRISM category filter — a tonal pill rail. The active pill is tinted from
 * the gallery's dynamic color (Material You); inactive pills are calm Material
 * tonal surfaces. Chrome recedes so the photos stay the hero.
 *
 * `darkMode` is kept in the signature (every template passes it) but theming
 * now flows through the semantic tokens scoped on each template's root, so the
 * rail inherits the correct porcelain / graphite palette automatically.
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
                  ? "text-[hsl(var(--dynamic-primary))]"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="category-pill"
                  transition={{ duration: 0.4, ease: [0.2, 0, 0, 1] }}
                  className="absolute inset-0 rounded-full bg-[hsl(var(--dynamic-primary)/0.14)] ring-1 ring-[hsl(var(--dynamic-primary)/0.35)]"
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
