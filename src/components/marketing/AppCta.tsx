import { forwardRef, type AnchorHTMLAttributes } from "react";
import { appHref } from "@/lib/domains";

/**
 * A link into the application (auth / dashboard). Renders a real anchor so it
 * performs a full navigation — on the marketing host that crosses to
 * app.imagick.ai; elsewhere it stays same-origin. Works as a `Button asChild`
 * child (forwards ref + className).
 */
export const AppCta = forwardRef<
  HTMLAnchorElement,
  { to: string } & AnchorHTMLAttributes<HTMLAnchorElement>
>(function AppCta({ to, children, ...rest }, ref) {
  return (
    <a ref={ref} href={appHref(to)} {...rest}>
      {children}
    </a>
  );
});
