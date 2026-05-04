import { cn } from "@/lib/utils";

interface CategoryNavProps {
  categories: string[];
  activeCategory: string | null;
  onCategoryChange: (category: string | null) => void;
  darkMode: boolean;
  totalCount: number;
}

export function CategoryNav({
  categories,
  activeCategory,
  onCategoryChange,
  darkMode,
  totalCount,
}: CategoryNavProps) {
  if (categories.length === 0) return null;

  const pillBase = "px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap";
  const pillActive = darkMode
    ? "bg-white text-black"
    : "bg-gray-900 text-white";
  const pillInactive = darkMode
    ? "bg-white/10 text-white/70 hover:bg-white/20"
    : "bg-black/5 text-gray-600 hover:bg-black/10";

  return (
    <div className="w-full overflow-x-auto scrollbar-hide">
      <div className="flex items-center gap-2 py-2 px-1 min-w-min">
        <button
          onClick={() => onCategoryChange(null)}
          className={cn(pillBase, activeCategory === null ? pillActive : pillInactive)}
        >
          All ({totalCount})
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => onCategoryChange(cat)}
            className={cn(pillBase, activeCategory === cat ? pillActive : pillInactive)}
          >
            {cat}
          </button>
        ))}
      </div>
    </div>
  );
}
