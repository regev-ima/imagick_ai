import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X, Sun, Moon, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBrandLogo } from "@/hooks/useBrandLogo";
import { useTheme } from "@/components/theme/ThemeProvider";
import { useAuth } from "@/hooks/useAuth";
import { Sparkle } from "./Sparkle";

type NavItem = { label: string; id?: string; to?: string };

const NAV: NavItem[] = [
  { label: "Features", id: "features" },
  { label: "How it works", id: "how" },
  { label: "Showcase", id: "showcase" },
  { label: "Pricing", to: "/pricing" },
  { label: "FAQ", id: "faq" },
];

function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={`grid h-9 w-9 place-items-center rounded-md border border-border bg-surface-2 text-muted-foreground transition-colors duration-200 hover:text-foreground hover:border-primary/40 cursor-pointer ${className}`}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

export function MarketingNav() {
  const navigate = useNavigate();
  const { logo } = useBrandLogo();
  const { isAuthenticated } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock body scroll while the mobile sheet is open.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const goToAnchor = (id: string) => {
    setOpen(false);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      window.history.replaceState(null, "", `#${id}`);
    } else {
      navigate(`/#${id}`);
    }
  };

  const renderItem = (item: NavItem, mobile = false) => {
    const base = mobile
      ? "block w-full rounded-md px-3 py-3 text-lg font-medium text-foreground/90 hover:bg-muted transition-colors"
      : "text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer";
    if (item.to) {
      return (
        <Link key={item.label} to={item.to} className={base} onClick={() => setOpen(false)}>
          {item.label}
        </Link>
      );
    }
    return (
      <button key={item.label} type="button" className={base} onClick={() => goToAnchor(item.id!)}>
        {item.label}
      </button>
    );
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-4 sm:pt-4">
      <div
        className={`mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-xl border px-4 py-2.5 transition-[background-color,border-color,box-shadow] duration-300 ${
          scrolled
            ? "border-border bg-background/80 shadow-[var(--elevation-2)] backdrop-blur-xl"
            : "border-transparent bg-transparent"
        }`}
      >
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2 shrink-0" aria-label="Imagick.ai home">
          <img src={logo} alt="Imagick.ai" className="h-6 sm:h-7 w-auto" />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-7 lg:flex" aria-label="Primary">
          {NAV.map((item) => renderItem(item))}
        </nav>

        {/* Desktop actions */}
        <div className="hidden items-center gap-2.5 lg:flex">
          <ThemeToggle />
          {isAuthenticated ? (
            <Button asChild variant="glow" size="sm" className="h-9">
              <Link to="/dashboard">
                Open dashboard <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="h-9">
                <Link to="/auth">Sign in</Link>
              </Button>
              <Button asChild variant="glow" size="sm" className="h-9">
                <Link to="/auth?mode=signup">
                  Start free <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </>
          )}
        </div>

        {/* Mobile actions */}
        <div className="flex items-center gap-2 lg:hidden">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="grid h-9 w-9 place-items-center rounded-md border border-border bg-surface-2 text-foreground cursor-pointer"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile sheet */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: [0.22, 0.61, 0.36, 1] }}
            className="mx-auto mt-2 max-w-6xl rounded-xl border border-border bg-background/95 p-3 shadow-[var(--elevation-3)] backdrop-blur-xl lg:hidden"
          >
            <nav className="flex flex-col gap-1" aria-label="Mobile">
              {NAV.map((item) => renderItem(item, true))}
            </nav>
            <div className="mt-3 grid gap-2 border-t border-border pt-3">
              {isAuthenticated ? (
                <Button asChild variant="glow" className="w-full">
                  <Link to="/dashboard" onClick={() => setOpen(false)}>
                    Open dashboard <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              ) : (
                <>
                  <Button asChild variant="outline" className="w-full">
                    <Link to="/auth" onClick={() => setOpen(false)}>
                      Sign in
                    </Link>
                  </Button>
                  <Button asChild variant="glow" className="w-full">
                    <Link to="/auth?mode=signup" onClick={() => setOpen(false)}>
                      Start free <Sparkle size={13} className="text-primary-foreground" />
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
