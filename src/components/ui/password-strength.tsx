import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";

interface PasswordStrengthProps {
  password: string;
  className?: string;
}

export function PasswordStrength({ password, className }: PasswordStrengthProps) {
  const checks = useMemo(() => {
    return {
      minLength: password.length >= 8,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    };
  }, [password]);

  const strength = useMemo(() => {
    const passed = Object.values(checks).filter(Boolean).length;
    if (passed === 0) return { level: 0, label: "", color: "" };
    if (passed <= 2) return { level: 1, label: "Weak", color: "bg-destructive" };
    if (passed <= 3) return { level: 2, label: "Fair", color: "bg-yellow-500" };
    if (passed <= 4) return { level: 3, label: "Good", color: "bg-primary" };
    return { level: 4, label: "Strong", color: "bg-green-500" };
  }, [checks]);

  if (!password) return null;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Strength Bar */}
      <div className="space-y-1">
        <div className="flex gap-1">
          {[1, 2, 3, 4].map((level) => (
            <div
              key={level}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-all",
                level <= strength.level ? strength.color : "bg-muted"
              )}
            />
          ))}
        </div>
        {strength.label && (
          <p className={cn(
            "text-xs font-medium",
            strength.level <= 1 ? "text-destructive" :
            strength.level === 2 ? "text-yellow-500" :
            strength.level === 3 ? "text-primary" :
            "text-green-500"
          )}>
            Password strength: {strength.label}
          </p>
        )}
      </div>

      {/* Requirements Checklist */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <Requirement met={checks.minLength}>At least 8 characters</Requirement>
        <Requirement met={checks.hasUppercase}>Uppercase letter</Requirement>
        <Requirement met={checks.hasLowercase}>Lowercase letter</Requirement>
        <Requirement met={checks.hasNumber}>Number</Requirement>
        <Requirement met={checks.hasSpecial}>Special character</Requirement>
      </div>
    </div>
  );
}

function Requirement({ met, children }: { met: boolean; children: React.ReactNode }) {
  return (
    <div className={cn(
      "flex items-center gap-1.5",
      met ? "text-green-500" : "text-muted-foreground"
    )}>
      {met ? (
        <Check className="w-3 h-3" />
      ) : (
        <X className="w-3 h-3" />
      )}
      <span>{children}</span>
    </div>
  );
}
