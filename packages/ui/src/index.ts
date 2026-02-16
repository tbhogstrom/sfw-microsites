/**
 * @sfw/ui - Shared UI Component Library
 * Main package exports for all reusable Astro components
 */

// Export all components by category
export * from './components/ui';
export * from './components/layout';
export * from './components/forms';
export * from './components/hero';
export * from './components/content';
export * from './components/blog';

// Export types
export * from './types';

// Export layouts (default export for convenience)
export { default } from './layouts/BaseLayout.astro';
export { default as BaseLayout } from './layouts/BaseLayout.astro';
export type { Props as BaseLayoutProps } from './layouts/BaseLayout.astro';
