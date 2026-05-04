import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Lock, Eye, EyeOff, ArrowRight, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordStrength } from "@/components/ui/password-strength";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import imagickLogo from "@/assets/imagick-logo.png";
import { BackgroundGradientAnimation } from "@/components/ui/background-gradient-animation";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
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
      {/* Left side - background */}
      <div className="hidden lg:flex lg:w-3/5">
        <BackgroundGradientAnimation
          gradientBackgroundStart="rgb(15, 5, 25)"
          gradientBackgroundEnd="rgb(5, 10, 40)"
          firstColor="232, 92, 155"
          secondColor="155, 90, 212"
          thirdColor="100, 180, 255"
          fourthColor="200, 50, 120"
          fifthColor="120, 80, 200"
          pointerColor="232, 92, 155"
          size="80%"
          containerClassName="h-full w-full"
          className="absolute z-50 inset-0 flex items-center justify-center"
        >
          <div className="max-w-lg px-12 pointer-events-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <img src={imagickLogo} alt="Imagick.ai" className="h-10 mb-8" />
              <h1 className="text-4xl xl:text-5xl font-bold leading-tight mb-4">
                Set your new{" "}
                <span className="text-gradient">password</span>
              </h1>
              <p className="text-lg text-muted-foreground">
                Choose a strong password to keep your account secure.
              </p>
            </motion.div>
          </div>
        </BackgroundGradientAnimation>
      </div>

      {/* Right side - form */}
      <div className="w-full lg:w-2/5 flex items-center justify-center p-6 lg:p-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="w-full max-w-md"
        >
          {/* Mobile header */}
          <div className="text-center mb-8 lg:hidden">
            <img src={imagickLogo} alt="Imagick.ai" className="h-8 mx-auto mb-4" />
          </div>

          <div className="hidden lg:block mb-8">
            <h2 className="text-2xl font-bold">Set new password</h2>
            <p className="text-muted-foreground mt-1">
              Enter your new password below.
            </p>
          </div>

          <Card className="glass-card border-border/50 p-6">
            {isSuccess ? (
              <div className="text-center py-8 space-y-4">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
                <h3 className="text-lg font-semibold">Password Updated!</h3>
                <p className="text-sm text-muted-foreground">
                  Redirecting you to the dashboard...
                </p>
              </div>
            ) : sessionError ? (
              <div className="text-center py-8 space-y-4">
                <p className="text-sm text-muted-foreground">
                  This reset link has expired or is invalid.
                </p>
                <Button variant="glow" onClick={() => navigate("/auth")}>
                  Back to Sign In
                </Button>
              </div>
            ) : !sessionReady ? (
              <div className="text-center py-8 space-y-4">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                <p className="text-sm text-muted-foreground">Verifying reset link...</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10 bg-muted border-border/50"
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {password && <PasswordStrength password={password} className="mt-3" />}
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type={showConfirm ? "text" : "password"}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10 pr-10 bg-muted border-border/50"
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
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
                  variant="glow"
                  className="w-full gap-2"
                  disabled={isLoading || !password || !confirmPassword}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      Update Password
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </form>
            )}
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
