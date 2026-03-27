/**
 * Compose class names — filters falsy values, joins with space.
 * Lightweight alternative to clsx + tailwind-merge for Astro components.
 */
export function cn(...inputs: (string | undefined | null | false)[]): string {
  return inputs.filter(Boolean).join(' ');
}
