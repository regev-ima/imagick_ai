import { type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";

/**
 * Consistent empty state for admin lists/tables — icon + message (+ optional
 * hint and action) instead of a bare "No X found" line on a blank table.
 */
export function AdminEmptyState({
  icon: Icon,
  title,
  hint,
  action,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Icon className="h-6 w-6 text-muted-foreground" aria-hidden />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {hint && <p className="caption mx-auto max-w-sm">{hint}</p>}
      </div>
      {action}
    </div>
  );
}
