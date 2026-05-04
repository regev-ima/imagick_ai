/**
 * Normalize a culling_label string for display:
 * - Replace underscores with spaces
 * - Title-case each word
 */
export function normalizeLabel(raw: string): string {
  return raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
