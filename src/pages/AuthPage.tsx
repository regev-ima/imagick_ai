import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, Loader2, MailCheck, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordStrength } from "@/components/ui/password-strength";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import imagickLogo from "@/assets/imagick-logo-light.png";
import heroPlate from "@/assets/hero-gallery-1.jpg";

// Editorial colophon — big folio numerals + tracked mono captions.
const colophon = [
  { stat: "10+", label: "Hours saved / week" },
  { stat: "90%", label: "Faster culling" },
  { stat: "99%", label: "AI accuracy" },
];

const EASE = [0.22, 0.61, 0.36, 1] as const;

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
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-8">
            <img src={imagickLogo} alt="Imagick.ai" className="h-7 mx-auto" />
          </div>

          <div className="plate rounded-md p-8 text-center">
            <div className="aura-microlabel mb-5">Verify · Account</div>
            <MailCheck className="w-10 h-10 text-accent mx-auto mb-5" />
            <h2 className="font-display text-3xl font-semibold mb-3 leading-tight">Check your email</h2>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
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

            <p className="text-xs text-muted-foreground mb-5">
              Didn't get it? Check your spam folder.
            </p>

            <div className="aura-hairline mb-5" />

            <button
              type="button"
              onClick={() => {
                setIsAwaitingVerification(false);
                setPendingEmail("");
                setIsLogin(true);
              }}
              className="text-sm text-accent underline decoration-accent/40 underline-offset-4 hover:decoration-accent font-medium inline-flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to sign in
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* ─────────────────────────────────────────────────────────────
          LEFT — the title page. Ivory canvas, Fraunces headline,
          editorial colophon. No glow, no gradient panel.
         ───────────────────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-3/5 relative border-r border-border">
        <div className="flex flex-col justify-between w-full px-14 xl:px-20 py-14">
          {/* Dateline / brand row */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="flex items-center justify-between"
          >
            <img src={imagickLogo} alt="Imagick.ai" className="h-7" />
            <span className="caption">Imagick.ai · No. 01 · 2026</span>
          </motion.div>

          {/* Title block */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.05 }}
            className="max-w-2xl"
          >
            <div className="aura-microlabel mb-6">The AI editing studio</div>

            <h1 className="font-display font-semibold leading-[0.98] tracking-[-0.02em] text-foreground text-6xl xl:text-7xl">
              Your editing.
              <br />
              Your AI.
              <br />
              <span className="text-accent">Zero presets.</span>
            </h1>

            <div className="aura-hairline my-9 max-w-md" />

            <p className="text-lg text-muted-foreground max-w-md leading-relaxed">
              Train an AI model on your unique editing style. Apply it to
              thousands of photos in seconds.
            </p>

            {/* Optional matted hero plate */}
            <motion.figure
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE, delay: 0.18 }}
              className="plate plate-keyline rounded-md mt-10 p-2.5 max-w-md"
            >
              <img
                src={heroPlate}
                alt="A photograph edited with a custom AI style"
                className="w-full aspect-[16/9] object-cover rounded-[2px]"
              />
              <figcaption className="caption flex items-center justify-between pt-2.5 px-0.5">
                <span>Plate I — Your style, applied</span>
                <span className="text-accent">●</span>
              </figcaption>
            </motion.figure>
          </motion.div>

          {/* Colophon — big folio numerals + tracked captions */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.3 }}
            className="border-t border-border pt-7"
          >
            <dl className="grid grid-cols-3 gap-8 max-w-xl">
              {colophon.map((item) => (
                <div key={item.label}>
                  <dt className="folio text-4xl xl:text-5xl text-foreground">{item.stat}</dt>
                  <dd className="caption mt-2">{item.label}</dd>
                </div>
              ))}
            </dl>
            <p className="caption mt-7">10,000+ photographers · already editing with AI</p>
          </motion.div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          RIGHT — the desk. Letterpress sign-in card on paper.
         ───────────────────────────────────────────────────────────── */}
      <div className="w-full lg:w-2/5 flex items-center justify-center p-6 lg:p-12 bg-surface-2/40">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE, delay: 0.1 }}
          className="w-full max-w-md"
        >
          {/* Mobile-only header */}
          <div className="text-center mb-8 lg:hidden">
            <img src={imagickLogo} alt="Imagick.ai" className="h-7 mx-auto mb-4" />
            <div className="aura-microlabel mb-3">The AI editing studio</div>
            <h1 className="font-display text-3xl font-semibold leading-tight">
              Your editing. Your AI.
              <br />
              <span className="text-accent">Zero presets.</span>
            </h1>
            <p className="caption mt-4">10,000+ photographers editing with AI</p>
          </div>

          {/* Desktop header */}
          <div className="hidden lg:block mb-8">
            <div className="aura-microlabel mb-3">
              {isForgotPassword ? "Recover · Access" : isLogin ? "The desk · Sign in" : "The desk · Register"}
            </div>
            <h2 className="font-display text-4xl font-semibold leading-tight">
              {isForgotPassword ? "Reset password" : isLogin ? "Welcome back" : "Start editing"}
            </h2>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              {isForgotPassword
                ? "Enter your email and we'll send you a reset link."
                : isLogin
                ? "Sign in to continue to your studio."
                : "Train your own AI style model. No presets, just you."}
            </p>
          </div>

          <div className="plate rounded-md p-7">
            {/* Google Sign In — prominent at top, hidden in forgot mode */}
            {!isForgotPassword && (
              <>
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading || isGoogleLoading}
                  className="relative w-full h-11 rounded-md text-sm font-semibold flex items-center justify-center gap-3 border border-border bg-card text-foreground transition-[border-color,background-color] duration-200 [transition-timing-function:cubic-bezier(0.22,0.61,0.36,1)] hover:border-foreground/30 hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
                >
                  {isGoogleLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
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

                {/* "or" hairline divider */}
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full aura-hairline" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-card px-3 caption">or continue with email</span>
                  </div>
                </div>
              </>
            )}

            {isForgotPassword && passwordResetSent && (
              <div className="rounded-md border border-border bg-surface-2/60 p-6 text-center space-y-3">
                <MailCheck className="w-10 h-10 mx-auto text-accent" />
                <h3 className="font-display text-2xl font-semibold">Check your email</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  If an account exists for <strong className="text-foreground">{formData.email}</strong>,
                  we've sent a reset link. It can take a minute to arrive — also check spam.
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  className="text-accent hover:text-accent"
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
                  <label className="caption mb-2 block">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="pl-10 rounded-md bg-background border-input focus-visible:border-accent focus-visible:ring-accent/25 focus-visible:shadow-none"
                      required
                    />
                  </div>
                </div>
              ) : (
              <>
              {!isLogin && (
                <div>
                  <label className="caption mb-2 block">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="John Doe"
                      value={formData.fullName}
                      onChange={(e) =>
                        setFormData({ ...formData, fullName: e.target.value })
                      }
                      className="pl-10 rounded-md bg-background border-input focus-visible:border-accent focus-visible:ring-accent/25 focus-visible:shadow-none"
                      required={!isLogin}
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="caption mb-2 block">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="pl-10 rounded-md bg-background border-input focus-visible:border-accent focus-visible:ring-accent/25 focus-visible:shadow-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="caption mb-2 block">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    className="pl-10 pr-10 rounded-md bg-background border-input focus-visible:border-accent focus-visible:ring-accent/25 focus-visible:shadow-none"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
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
                  <div className="text-right mt-2">
                    <button
                      type="button"
                      onClick={() => setIsForgotPassword(true)}
                      className="caption hover:text-accent transition-colors"
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
                variant={isLogin && !isForgotPassword ? "default" : "glow"}
                size="lg"
                className="w-full gap-2"
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
                    className="text-accent underline decoration-accent/40 underline-offset-4 hover:decoration-accent font-medium inline-flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back to sign in
                  </button>
                ) : (
                  <>
                    {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
                    <button
                      type="button"
                      onClick={() => setIsLogin(!isLogin)}
                      className="text-accent underline decoration-accent/40 underline-offset-4 hover:decoration-accent font-medium"
                    >
                      {isLogin ? "Sign up" : "Sign in"}
                    </button>
                  </>
                )}
              </p>
            </div>
          </div>

          {!isLogin && !isForgotPassword && (
            <div className="flex items-center justify-center gap-4 mt-5 caption">
              <span className="flex items-center gap-1.5"><Lock className="w-3 h-3" /> Secure</span>
              <span className="w-px h-3 bg-border" />
              <span>No credit card</span>
              <span className="w-px h-3 bg-border" />
              <span>Free forever plan</span>
            </div>
          )}

          <p className="text-[11px] leading-relaxed text-center text-muted-foreground/70 mt-5">
            By continuing, you agree to our{" "}
            <Link
              to="/legal/terms"
              className="underline underline-offset-2 hover:text-foreground transition-colors"
            >
              Terms of Service
            </Link>
            {" "}and{" "}
            <Link
              to="/legal/privacy"
              className="underline underline-offset-2 hover:text-foreground transition-colors"
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
