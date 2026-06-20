// The Imagick AI mark — a royal-blue 4-point sparkle (the logo star).
// Mirrors the mark used across the app (auth, dashboard) so the marketing
// site speaks the same brand language.
export function Sparkle({
  size = 16,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      focusable="false"
      style={{ display: "block" }}
    >
      <path
        d="M12 0 C12.9 7.2 16.8 11.1 24 12 C16.8 12.9 12.9 16.8 12 24 C11.1 16.8 7.2 12.9 0 12 C7.2 11.1 11.1 7.2 12 0 Z"
        fill="currentColor"
      />
    </svg>
  );
}
