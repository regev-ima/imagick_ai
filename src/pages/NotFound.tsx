import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
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

const NotFound = () => {
  const location = useLocation();
  const { logo: imagickLogo } = useBrandLogo();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      {/* subtle royal-blue accent glow */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/3 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.12) 0%, transparent 70%)" }}
      />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Brand row — logo lockup (already includes the sparkle mark) */}
        <div className="mb-8 flex items-center justify-center">
          <img src={imagickLogo} alt="Imagick.ai" className="h-7" />
        </div>

        <div className="glass-card rounded-md p-8 text-center sm:p-10">
          <div className="aura-microlabel mb-6 flex items-center justify-center gap-2">
            <Sparkle size={11} className="text-primary" />
            Error · Route
          </div>

          <motion.p
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.4, ease: EASE }}
            className="folio text-[88px] leading-none text-foreground sm:text-[104px]"
          >
            404
          </motion.p>

          <div className="aura-microlabel mt-4 text-foreground/80">Page not found</div>

          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            The page you're looking for doesn't exist or has been moved.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild className="w-full gap-2 sm:w-auto">
              <Link to="/dashboard">
                <Home className="w-4 h-4" />
                Back to dashboard
              </Link>
            </Button>
            <Button
              variant="outline"
              onClick={() => window.history.back()}
              className="w-full gap-2 sm:w-auto"
            >
              <ArrowLeft className="w-4 h-4" />
              Go back
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default NotFound;
