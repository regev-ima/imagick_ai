import { useTheme } from "@/components/theme/ThemeProvider";
import logoDark from "@/assets/imagick-logo.png";
import logoLight from "@/assets/imagick-logo-light.png";
import iconDark from "@/assets/imagick-icon.png";
import iconLight from "@/assets/imagick-icon-light.png";

/**
 * Returns the brand logo/icon variant that matches the *effective* background.
 *
 * The "-light" assets are the navy artwork for light surfaces; the default
 * assets are the white wordmark for dark surfaces. Standalone pages (auth,
 * reset, unsubscribe, 404) render on `bg-background`, which follows the theme
 * class — so the logo must follow it too, or the wordmark goes invisible.
 */
export function useBrandLogo() {
  const { theme } = useTheme();
  const isLightBg =
    theme === "light" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      !window.matchMedia("(prefers-color-scheme: dark)").matches);

  return {
    logo: isLightBg ? logoLight : logoDark,
    icon: isLightBg ? iconLight : iconDark,
  };
}
