import { Link, useNavigate } from "react-router-dom";
import { useBrandLogo } from "@/hooks/useBrandLogo";
import { appHref } from "@/lib/domains";
import { Sparkle } from "./Sparkle";
import { SITE } from "./data";
import { USE_CASES } from "./content";

const productLinks = [
  { label: "Features", id: "features" },
  { label: "How it works", id: "how" },
  { label: "Pricing", to: "/pricing" },
  { label: "Blog", to: "/blog" },
];

const useCaseLinks = USE_CASES.map((u) => ({
  label: `${u.niche} photographers`,
  to: `/for/${u.slug}`,
}));

const resourceLinks = [
  { label: "Sign in", href: appHref("/auth") },
  { label: "Start free", href: appHref("/auth?mode=signup") },
  { label: "Contact", href: `mailto:${SITE.email}` },
];

const legalLinks = [
  { label: "Privacy", to: "/legal/privacy" },
  { label: "Terms", to: "/legal/terms" },
];

export function MarketingFooter() {
  const navigate = useNavigate();
  const { logo } = useBrandLogo();

  const goAnchor = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
    else navigate(`/#${id}`);
  };

  const renderLink = (item: {
    label: string;
    id?: string;
    to?: string;
    href?: string;
  }) => {
    const cls =
      "text-sm text-muted-foreground transition-colors hover:text-foreground cursor-pointer";
    if (item.to)
      return (
        <Link key={item.label} to={item.to} className={cls}>
          {item.label}
        </Link>
      );
    if (item.href)
      return (
        <a key={item.label} href={item.href} className={cls}>
          {item.label}
        </a>
      );
    return (
      <button
        key={item.label}
        type="button"
        onClick={() => goAnchor(item.id!)}
        className={`${cls} text-left`}
      >
        {item.label}
      </button>
    );
  };

  return (
    <footer className="relative border-t border-border bg-background">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-[1.6fr_1fr_1fr_1fr_1fr]">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="inline-flex items-center" aria-label="Imagick.ai home">
              <img src={logo} alt="Imagick.ai" className="h-7 w-auto" />
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              The AI editing studio for photographers. Train your style, cull in
              seconds, deliver galleries clients love.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 caption text-primary">
              <Sparkle size={11} className="text-primary" />
              <span>Your editing. Your AI. Zero presets.</span>
            </div>
          </div>

          {/* Columns */}
          <div>
            <div className="aura-microlabel mb-4">Product</div>
            <div className="flex flex-col gap-3">{productLinks.map(renderLink)}</div>
          </div>
          <div>
            <div className="aura-microlabel mb-4">Use cases</div>
            <div className="flex flex-col gap-3">{useCaseLinks.map(renderLink)}</div>
          </div>
          <div>
            <div className="aura-microlabel mb-4">Get started</div>
            <div className="flex flex-col gap-3">{resourceLinks.map(renderLink)}</div>
          </div>
          <div>
            <div className="aura-microlabel mb-4">Legal</div>
            <div className="flex flex-col gap-3">{legalLinks.map(renderLink)}</div>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 sm:flex-row">
          <p className="caption !tracking-normal !normal-case text-muted-foreground/80">
            © {new Date().getFullYear()} {SITE.name} · Built for photographers, everywhere.
          </p>
          <div className="flex items-center gap-4">
            <a
              href="https://twitter.com/imagick_ai"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Imagick.ai on X"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
              </svg>
            </a>
            <a
              href={`mailto:${SITE.email}`}
              className="caption !tracking-normal !normal-case text-muted-foreground transition-colors hover:text-foreground"
            >
              {SITE.email}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
