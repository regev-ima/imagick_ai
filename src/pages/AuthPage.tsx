import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, Loader2, Camera, Sparkles, Zap, MailCheck, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordStrength } from "@/components/ui/password-strength";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import imagickLogo from "@/assets/imagick-logo.png";
import { BackgroundGradientAnimation } from "@/components/ui/background-gradient-animation";

const features = [
  { icon: Zap, title: "Save 10+ hrs/week", iconColor: "text-primary", stat: "10+" },
  { icon: Camera, title: "Faster culling", iconColor: "text-blue-400", stat: "90%" },
  { icon: Sparkles, title: "AI accuracy", iconColor: "text-accent", stat: "99%" },
];

export default function AuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, isEmailVerified, isLoading: authLoading } = useAuth();

  const [isAwaitingVerification, setIsAwaitingVerification] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [isResending, setIsResending] = useState(false);

  // Handle ?verify=pending from ProtectedRoute redirect
  useEffect(() => {
    if (searchParams.get("verify") === "pending" && user?.email) {
      setIsAwaitingVerification(true);
      setPendingEmail(user.email);
    }
  }, [searchParams, user]);

  useEffect(() => {
    if (!authLoading && isAuthenticated && isEmailVerified) {
      queryClient.clear();
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, isEmailVerified, authLoading, navigate, queryClient]);

  const handleResendVerification = async () => {
    if (!pendingEmail) return;
    setIsResending(true);
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email: pendingEmail });
      if (error) throw error;
      toast.success("Verification email resent! Check your inbox.");
    } catch (error: any) {
      toast.error(error.message || "Failed to resend verification email");
    } finally {
      setIsResending(false);
    }
  };

  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [passwordResetSent, setPasswordResetSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [loginFailures, setLoginFailures] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [, setTick] = useState(0);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
  });

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });
      if (error) throw error;
    } catch (error: any) {
      toast.error(error.message || "Failed to sign in with Google");
      setIsGoogleLoading(false);
    }
  };

  const isPasswordStrong = (password: string) => {
    const checks = {
      minLength: password.length >= 8,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecial: /[^A-Za-z0-9]/.test(password),
    };
    // All 5 checks must pass for a strong password
    return Object.values(checks).every(Boolean);
  };

  const isLockedOut = () => lockoutUntil !== null && Date.now() < lockoutUntil;
  const lockoutSecondsLeft = () =>
    lockoutUntil ? Math.ceil((lockoutUntil - Date.now()) / 1000) : 0;

  // Tick every second while locked out so the countdown updates
  useEffect(() => {
    if (!lockoutUntil) return;
    const interval = setInterval(() => {
      setTick(t => t + 1);
      if (Date.now() >= lockoutUntil) {
        setLockoutUntil(null);
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutUntil]);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email) {
      toast.error("Please enter your email address");
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-password-reset", {
        body: { email: formData.email },
      });
      if (error) throw error;
      if (data?.reason === "google_only") {
        toast.info("This account uses Google Sign-In. We sent you an email with instructions.");
        setPasswordResetSent(true);
        return;
      }
      // Stay on the page with a clear in-place confirmation instead of a
      // transient toast that the user might miss.
      setPasswordResetSent(true);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isLockedOut()) {
      toast.error(`Too many failed attempts. Try again in ${lockoutSecondsLeft()} seconds.`);
      return;
    }

    if (!isLogin && !isPasswordStrong(formData.password)) {
      toast.error("Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character.");
      return;
    }

    setIsLoading(true);
    const trimmedEmail = formData.email.trim().toLowerCase();

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password: formData.password,
        });

        if (error) {
          const newFailures = loginFailures + 1;
          setLoginFailures(newFailures);
          if (newFailures >= 5) {
            setLockoutUntil(Date.now() + 30_000); // 30-second lockout
            setLoginFailures(0);
            throw new Error("Too many failed attempts. Please wait 30 seconds before trying again.");
          }
          throw error;
        }
        setLoginFailures(0);
        setLockoutUntil(null);
        toast.success("Welcome back!");
        navigate("/dashboard");
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password: formData.password,
          options: {
            emailRedirectTo: window.location.origin + "/dashboard",
            data: {
              full_name: formData.fullName,
            },
          },
        });

        if (error) throw error;

        // Supabase returns success with empty identities when email already exists
        if (!data.user?.identities?.length) {
          toast.error("An account with this email already exists. Try signing in instead.");
          setIsLogin(true);
          return;
        }

        // Show the verification pending screen
        setPendingEmail(trimmedEmail);
        setIsAwaitingVerification(true);
      }
    } catch (error: any) {
      toast.error(error.message || "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  if (isAwaitingVerification) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md text-center"
        >
          <img src={imagickLogo} alt="Imagick.ai" className="h-8 mx-auto mb-8" />

          <Card className="glass-card border-border/50 p-8">
            <MailCheck className="w-12 h-12 text-primary mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Check your email</h2>
            <p className="text-muted-foreground mb-6">
              We sent a verification link to{" "}
              <span className="font-medium text-foreground">{pendingEmail}</span>.
              <br />
              Click the link to activate your account.
            </p>

            <Button
              variant="outline"
              className="w-full mb-3"
              onClick={handleResendVerification}
              disabled={isResending}
            >
              {isResending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Mail className="w-4 h-4 mr-2" />
              )}
              Resend verification email
            </Button>

            <p className="text-xs text-muted-foreground mb-4">
              Didn't get it? Check your spam folder.
            </p>

            <button
              type="button"
              onClick={() => {
                setIsAwaitingVerification(false);
                setPendingEmail("");
                setIsLogin(true);
              }}
              className="text-sm text-gradient hover:underline font-medium inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3 h-3" />
              Back to sign in
            </button>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Hero Section */}
      <div className="hidden lg:flex lg:w-3/5">
        <BackgroundGradientAnimation
          gradientBackgroundStart="rgb(8, 2, 18)"
          gradientBackgroundEnd="rgb(2, 5, 25)"
          firstColor="200, 60, 140"
          secondColor="130, 70, 200"
          thirdColor="80, 140, 255"
          fourthColor="180, 40, 100"
          fifthColor="100, 60, 180"
          pointerColor="200, 60, 140"
          size="80%"
          containerClassName="h-full w-full"
          className="absolute z-50 inset-0 flex items-center justify-center"
        >
          {/* Hero Content */}
          <div className="max-w-xl px-12 pointer-events-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1, duration: 0.4 }}
              >
                <img src={imagickLogo} alt="Imagick.ai" className="h-10 mb-10" />
              </motion.div>

              {/* AI badge */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.15, duration: 0.4 }}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-primary/20 to-violet-500/20 backdrop-blur-md border border-primary/30 rounded-full px-3.5 py-1.5 mb-6"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                </span>
                <span className="text-xs text-white/90 font-medium tracking-wide">Powered by AI · 2026</span>
              </motion.div>

              <h1 className="text-5xl xl:text-6xl font-bold leading-[1.1] mb-5">
                <span className="text-white/95">Your editing.</span>
                <br />
                <span className="text-gradient">Your AI.</span>
                <br />
                <span className="text-white/50 text-4xl xl:text-5xl">Zero presets.</span>
              </h1>

              <p className="text-lg text-white/50 mb-10 max-w-md leading-relaxed">
                Train an AI model on your unique editing style. Apply it to thousands of photos in seconds.
              </p>

              {/* Stats row */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="flex gap-6 mb-10"
              >
                {features.map((feature, i) => (
                  <motion.div
                    key={feature.title}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35 + i * 0.1, duration: 0.4 }}
                    className="relative"
                  >
                    <div className="text-3xl font-bold text-white/90 tabular-nums">{feature.stat}</div>
                    <div className="text-xs text-white/40 font-medium mt-0.5">{feature.title}</div>
                    <div className={`absolute -left-3 top-1 w-1 h-8 rounded-full ${feature.iconColor.replace("text-", "bg-")} opacity-50`} />
                  </motion.div>
                ))}
              </motion.div>

              {/* Social proof */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6, duration: 0.5 }}
                className="flex items-center gap-3"
              >
                <div className="flex -space-x-2">
                  {["S", "J", "A", "M", "R"].map((initial, i) => (
                    <div
                      key={i}
                      className="w-7 h-7 rounded-full border-2 border-background/50 flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                      style={{ background: `hsl(${280 + i * 25}, 70%, 45%)` }}
                    >
                      {initial}
                    </div>
                  ))}
                </div>
                <div>
                  <div className="text-sm text-white/70 font-medium">10,000+ photographers</div>
                  <div className="text-[10px] text-white/35">already editing with AI</div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </BackgroundGradientAnimation>
      </div>

      {/* Right Form Section */}
      <div className="w-full lg:w-2/5 flex items-center justify-center p-6 lg:p-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="w-full max-w-md"
        >
          {/* Mobile-only header */}
          <div className="relative text-center mb-8 lg:hidden overflow-hidden rounded-2xl p-6">
            <div className="absolute inset-0 animate-gradient-shift bg-[length:400%_400%] rounded-2xl opacity-80"
              style={{
                backgroundImage: "linear-gradient(135deg, hsl(272, 50%, 10%) 0%, hsl(318, 40%, 12%) 25%, hsl(258, 40%, 7%) 50%, hsl(192, 50%, 10%) 75%, hsl(272, 50%, 10%) 100%)",
              }}
            />
            <div className="relative z-10">
              <img src={imagickLogo} alt="Imagick.ai" className="h-8 mx-auto mb-3" />
              <div className="inline-flex items-center gap-1.5 bg-primary/20 border border-primary/30 rounded-full px-2.5 py-1 mb-3">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
                </span>
                <span className="text-[10px] text-white/80 font-medium">AI-Powered · 2026</span>
              </div>
              <h1 className="text-xl font-bold text-gradient">
                Your AI. Your Style.
              </h1>
              <p className="text-xs text-muted-foreground mt-1.5">
                10,000+ photographers already editing with AI
              </p>
            </div>
          </div>

          {/* Desktop header */}
          <div className="hidden lg:block mb-8">
            <div className="inline-flex items-center gap-1.5 bg-primary/10 border border-primary/20 rounded-full px-2.5 py-1 mb-4">
              <Sparkles className="w-3 h-3 text-primary" />
              <span className="text-[10px] text-primary font-medium uppercase tracking-wider">AI Photo Editor</span>
            </div>
            <h2 className="text-2xl font-bold">
              {isForgotPassword ? "Reset password" : isLogin ? "Welcome back" : "Start editing with AI"}
            </h2>
            <p className="text-muted-foreground mt-1.5 text-sm">
              {isForgotPassword
                ? "Enter your email and we'll send you a reset link."
                : isLogin
                ? "Sign in to continue to your AI workspace."
                : "Train your own AI style model. No presets, just you."}
            </p>
          </div>

          <Card className="glass-card border-border/50 p-6">
            {/* Google Sign In - prominent at top, hidden in forgot mode */}
            {!isForgotPassword && (
              <>
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading || isGoogleLoading}
                  className="relative w-full h-12 rounded-lg text-base font-semibold flex items-center justify-center gap-3 bg-white text-gray-800 transition-all duration-300 hover:bg-gray-50 hover:scale-[1.02] hover:shadow-[0_4px_24px_rgba(0,0,0,0.25)] disabled:pointer-events-none disabled:opacity-50"
                >
                  {isGoogleLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-gray-600" />
                  ) : (
                    <>
                      <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                      </svg>
                      {isLogin ? "Sign in with Google" : "Sign up with Google"}
                    </>
                  )}
                </button>

                <div className="relative my-5">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">or continue with email</span>
                  </div>
                </div>
              </>
            )}

            {isForgotPassword && passwordResetSent && (
              <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6 text-center space-y-3">
                <MailCheck className="w-12 h-12 mx-auto text-primary" />
                <h3 className="text-lg font-semibold">Check your email</h3>
                <p className="text-sm text-muted-foreground">
                  If an account exists for <strong className="text-foreground">{formData.email}</strong>,
                  we've sent a reset link. It can take a minute to arrive — also check spam.
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  className="text-primary hover:text-primary"
                  onClick={() => {
                    setIsForgotPassword(false);
                    setPasswordResetSent(false);
                  }}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to sign in
                </Button>
              </div>
            )}

            {!(isForgotPassword && passwordResetSent) && (
            <form onSubmit={isForgotPassword ? handleForgotPassword : handleSubmit} className="space-y-4">
              {isForgotPassword ? (
                <div>
                  <label className="text-sm font-medium mb-2 block">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="pl-10 bg-muted border-border/50"
                      required
                    />
                  </div>
                </div>
              ) : (
              <>
              {!isLogin && (
                <div>
                  <label className="text-sm font-medium mb-2 block">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="John Doe"
                      value={formData.fullName}
                      onChange={(e) =>
                        setFormData({ ...formData, fullName: e.target.value })
                      }
                      className="pl-10 bg-muted border-border/50"
                      required={!isLogin}
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm font-medium mb-2 block">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="pl-10 bg-muted border-border/50"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    className="pl-10 pr-10 bg-muted border-border/50"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {!isLogin && formData.password && (
                  <PasswordStrength password={formData.password} className="mt-3" />
                )}
                {isLogin && (
                  <div className="text-right mt-1">
                    <button
                      type="button"
                      onClick={() => setIsForgotPassword(true)}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}
              </div>
              </>
              )}

              <Button
                type="submit"
                variant="glow"
                className="w-full gap-2 font-semibold"
                disabled={isLoading || isGoogleLoading || isLockedOut()}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isLockedOut() ? (
                  `Locked — wait ${lockoutSecondsLeft()}s`
                ) : (
                  <>
                    {isForgotPassword ? "Send Reset Email" : isLogin ? "Sign In" : "Start for free"}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </form>
            )}

            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                {isForgotPassword ? (
                  <button
                    type="button"
                    onClick={() => setIsForgotPassword(false)}
                    className="text-gradient hover:underline font-medium"
                  >
                    ← Back to sign in
                  </button>
                ) : (
                  <>
                    {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
                    <button
                      type="button"
                      onClick={() => setIsLogin(!isLogin)}
                      className="text-gradient hover:underline font-medium"
                    >
                      {isLogin ? "Sign up" : "Sign in"}
                    </button>
                  </>
                )}
              </p>
            </div>
          </Card>

          {!isLogin && !isForgotPassword && (
            <div className="flex items-center justify-center gap-4 mt-4 text-[10px] text-muted-foreground/70">
              <span className="flex items-center gap-1"><Lock className="w-3 h-3" /> Secure</span>
              <span className="w-px h-3 bg-border" />
              <span>No credit card</span>
              <span className="w-px h-3 bg-border" />
              <span>Free forever plan</span>
            </div>
          )}

          <p className="text-[10px] text-center text-muted-foreground/50 mt-4">
            By continuing, you agree to our{" "}
            <Link
              to="/legal/terms"
              className="underline hover:text-muted-foreground transition-colors"
            >
              Terms of Service
            </Link>
            {" "}and{" "}
            <Link
              to="/legal/privacy"
              className="underline hover:text-muted-foreground transition-colors"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </motion.div>
      </div>
    </div>
  );
}
