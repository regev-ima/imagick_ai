import { useEffect, type ReactNode, type CSSProperties } from "react";

/**
 * BrandThemeProvider — injects photographer-controlled CSS variables and
 * dynamically loads the matching Google Fonts pair for the client gallery.
 *
 * The wrapper exposes `className="brand-themed-root"` and inline CSS
 * variables (`--brand-primary`, `--brand-accent`, `--brand-font-display`,
 * `--brand-font-body`) that templates can consume directly via inline
 * `style` props or Tailwind arbitrary values (e.g. `bg-[var(--brand-primary)]`).
 *
 * Falls back gracefully: if a prop is missing, the variable is omitted and
 * downstream templates can use their default tokens.
 */

export type BrandFontPair =
  | "playfair-inter"
  | "fraunces-geist"
  | "cormorant-manrope"
  | "bebas-spectral"
  | "tenor-inter";

interface BrandFontDefinition {
  // The Google Fonts CSS2 query string segment (e.g. `Fraunces:opsz,wght@9..144,400;9..144,700`).
  // Set to `null` when the font is already loaded globally (no-op).
  googleQuery: string | null;
  // CSS font-family stack to assign to the wrapper.
  display: string;
  body: string;
}

const FONT_PAIRS: Record<BrandFontPair, BrandFontDefinition> = {
  // Already loaded globally via index.css + a baseline <link> for Playfair Display.
  "playfair-inter": {
    googleQuery: "Playfair+Display:wght@400;500;600;700",
    display: "'Playfair Display', Georgia, serif",
    body: "'Inter', system-ui, sans-serif",
  },
  "fraunces-geist": {
    googleQuery:
      "Fraunces:opsz,wght@9..144,400;9..144,500;9..144,700&family=Geist:wght@300;400;500;600",
    display: "'Fraunces', Georgia, serif",
    body: "'Geist', system-ui, sans-serif",
  },
  "cormorant-manrope": {
    googleQuery:
      "Cormorant+Garamond:wght@300;400;500;600;700&family=Manrope:wght@300;400;500;600",
    display: "'Cormorant Garamond', Georgia, serif",
    body: "'Manrope', system-ui, sans-serif",
  },
  "bebas-spectral": {
    googleQuery: "Bebas+Neue&family=Spectral:wght@300;400;500;600",
    display: "'Bebas Neue', Impact, sans-serif",
    body: "'Spectral', Georgia, serif",
  },
  "tenor-inter": {
    googleQuery: "Tenor+Sans",
    display: "'Tenor Sans', Georgia, serif",
    body: "'Inter', system-ui, sans-serif",
  },
};

function resolveFontPair(pair: string | null | undefined): BrandFontDefinition {
  if (pair && pair in FONT_PAIRS) {
    return FONT_PAIRS[pair as BrandFontPair];
  }
  return FONT_PAIRS["playfair-inter"];
}

/**
 * Idempotent Google Fonts loader. Uses a stable element id derived from the
 * font-pair slug so React strict-mode double-invocation, re-mounts, and
 * navigations between galleries never inject duplicate <link> tags.
 */
function ensureFontLink(pair: BrandFontPair, font: BrandFontDefinition) {
  if (typeof document === "undefined") return;
  if (!font.googleQuery) return;

  const id = `brand-font-${pair}`;
  if (document.getElementById(id)) return;

  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${font.googleQuery}&display=swap`;
  document.head.appendChild(link);
}

interface BrandThemeProviderProps {
  primaryColor?: string | null;
  accentColor?: string | null;
  fontPair?: string | null;
  /** Available to consumers for header logo, OG previews, etc. Not consumed internally. */
  logoUrl?: string | null;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

export function BrandThemeProvider({
  primaryColor,
  accentColor,
  fontPair,
  logoUrl: _logoUrl,
  className,
  style,
  children,
}: BrandThemeProviderProps) {
  const resolvedPair: BrandFontPair =
    fontPair && fontPair in FONT_PAIRS ? (fontPair as BrandFontPair) : "playfair-inter";
  const font = resolveFontPair(resolvedPair);

  useEffect(() => {
    ensureFontLink(resolvedPair, font);
  }, [resolvedPair, font]);

  // CSS variable bag. Only set variables we actually have values for so the
  // cascade keeps falling back to the global tokens defined in index.css.
  const cssVars: Record<string, string> = {
    "--brand-font-display": font.display,
    "--brand-font-body": font.body,
  };
  if (primaryColor) cssVars["--brand-primary"] = primaryColor;
  if (accentColor) cssVars["--brand-accent"] = accentColor;

  return (
    <div
      className={["brand-themed-root", className].filter(Boolean).join(" ")}
      style={{ ...(cssVars as CSSProperties), ...style }}
    >
      {children}
    </div>
  );
}
