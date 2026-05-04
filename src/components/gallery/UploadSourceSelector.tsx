import { HardDrive, CloudIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type UploadSource = "local" | "drive";

interface UploadSourceSelectorProps {
  value: UploadSource;
  onChange: (source: UploadSource) => void;
  disabled?: boolean;
}

const options = [
  { id: "local" as const, icon: HardDrive, label: "Local Files" },
  { id: "drive" as const, icon: CloudIcon, label: "Google Drive" },
];

export function UploadSourceSelector({ value, onChange, disabled = false }: UploadSourceSelectorProps) {
  return (
    <div className={cn("inline-flex items-center p-1 rounded-lg bg-muted/50 border border-border/50", disabled && "opacity-50 pointer-events-none")}>
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          disabled={disabled}
          className={cn(
            "inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
            value === opt.id
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <opt.icon className="w-4 h-4" />
          {opt.label}
        </button>
      ))}
    </div>
  );
}
