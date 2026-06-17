import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Lock, Eye, EyeOff, ArrowRight, Loader2, CheckCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordStrength } from "@/components/ui/password-strength";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useBrandLogo } from "@/hooks/useBrandLogo";

const EASE = [0.22, 0.61, 0.36, 1] as const;

// The AI mark — a royal-blue 4-point sparkle (the logo star).
function Sparkle({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      style={{ display: "block" }}
    >
      <path
        d="M12 0 C12.9 7.2 16.8 11.1 24 12 C16.8 12.9 12.9 16.8 12 24 C11.1 16.8 7.2 12.9 0 12 C7.2 11.1 11.1 7.2 12 0 Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { logo: imagickLogo } = useBrandLogo();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState(false);

  useEffect(() => {
    // Listen for the SIGNED_IN or PASSWORD_RECOVERY event from the hash token
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setSessionReady(true);
      }
    });

    // Also check if we already have a session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true);
    });

    // If no session after 5 seconds, show error
    const timeout = setTimeout(() => {
      setSessionReady((ready) => {
        if (!ready) setSessionError(true);
        return ready;
      });
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const isPasswordStrong = (pw: string) => {
    const checks = {
      minLength: pw.length >= 8,
      hasUppercase: /[A-Z]/.test(pw),
      hasLowercase: /[a-z]/.test(pw),
      hasNumber: /[0-9]/.test(pw),
      hasSpecial: /[^A-Za-z0-9]/.test(pw),
    };
    return Object.values(checks).every(Boolean);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }

    if (!isPasswordStrong(password)) {
      toast.error("Please use a stronger password");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setIsSuccess(true);
      toast.success("Password updated successfully!");
      setTimeout(() => navigate("/dashboard", { replace: true }), 2000);
    } catch (error: any) {
      toast.error(error.message || "Failed to update password");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* ─────────────────────────────────────────────────────────────
          LEFT — the studio. Dark graphite, royal-blue accents, mono
          microlabels, an Inter headline.
         ───────────────────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-3/5 relative bg-background border-r border-border overflow-hidden">
        {/* subtle royal-blue accent glow */}
        <div
          className="pointer-events-none absolute -left-32 top-1/4 h-[28rem] w-[28rem] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.14) 0%, transparent 70%)" }}
        />
        <div className="relative flex flex-col justify-between w-full px-14 xl:px-20 py-14">
          {/* Brand row */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-2.5">
              <Sparkle size={20} className="text-primary" />
              <img src={imagickLogo} alt="Imagick.ai" className="h-7" />
            </div>
            <span className="aura-microlabel">Recover · Access</span>
          </motion.div>

          {/* Title block */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.05 }}
            className="max-w-2xl"
          >
            <div className="aura-microlabel mb-6 flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              Secure password reset
            </div>

            <h1 className="font-sans font-bold leading-[0.98] tracking-[-0.03em] text-foreground text-6xl xl:text-7xl">
              Set your new
              <br />
              <span className="text-primary">password.</span>
            </h1>

            <div className="aura-hairline my-9 max-w-md" />

            <p className="text-lg text-muted-foreground max-w-md leading-relaxed">
              Choose a strong password to keep your account and your studio secure.
            </p>
          </motion.div>

          {/* Footnote */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.3 }}
            className="border-t border-border pt-7"
          >
            <p className="caption">The Imagick.ai workspace · AI editing studio</p>
          </motion.div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          RIGHT — the dark reset panel.
         ───────────────────────────────────────────────────────────── */}
      <div className="w-full lg:w-2/5 flex items-center justify-center p-6 lg:p-12 bg-background">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE, delay: 0.1 }}
          className="w-full max-w-md"
        >
          {/* Mobile-only header */}
          <div className="text-center mb-8 lg:hidden">
            <div className="flex items-center justify-center gap-2.5 mb-4">
              <Sparkle size={18} className="text-primary" />
              <img src={imagickLogo} alt="Imagick.ai" className="h-7" />
            </div>
          </div>

          {/* Desktop header */}
          <div className="hidden lg:block mb-8">
            <div className="aura-microlabel mb-3 flex items-center gap-2">
              <Sparkle size={11} className="text-primary" />
              Recover · Access
            </div>
            <h2 className="font-sans text-4xl font-bold tracking-tight leading-tight">Set new password</h2>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              Enter your new password below.
            </p>
          </div>

          <div className="glass-card rounded-md p-7">
            {isSuccess ? (
              <div className="py-8 text-center space-y-4">
                <CheckCircle className="mx-auto h-12 w-12 text-secondary" />
                <h3 className="font-sans text-2xl font-semibold tracking-tight">Password updated</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Redirecting you to the dashboard...
                </p>
              </div>
            ) : sessionError ? (
              <div className="py-8 text-center space-y-4">
                <div className="aura-microlabel">Link · Expired</div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  This reset link has expired or is invalid.
                </p>
                <Button className="w-full gap-2" onClick={() => navigate("/auth")}>
                  Back to sign in
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            ) : !sessionReady ? (
              <div className="py-8 text-center space-y-4">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Verifying reset link...</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="caption mb-2 block">New password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10 rounded-md bg-background border-input focus-visible:border-primary focus-visible:ring-primary/25 focus-visible:shadow-none"
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {password && <PasswordStrength password={password} className="mt-3" />}
                </div>

                <div>
                  <label className="caption mb-2 block">Confirm password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type={showConfirm ? "text" : "password"}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10 pr-10 rounded-md bg-background border-input focus-visible:border-primary focus-visible:ring-primary/25 focus-visible:shadow-none"
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {confirmPassword && password !== confirmPassword && (
                    <p className="text-xs text-destructive mt-1">Passwords don't match</p>
                  )}
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className="w-full gap-2"
                  disabled={isLoading || !password || !confirmPassword}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      Update password
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </form>
            )}
          </div>

          <div className="flex items-center justify-center gap-1.5 mt-5 caption text-primary">
            <Sparkle size={11} className="text-primary" />
            <span>The Imagick.ai workspace</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
