/**
 * Shared TypeScript types for SFW UI components
 */

export interface BaseProps {
  class?: string;
  id?: string;
}

export interface NavigationItem {
  label: string;
  url: string;
  children?: NavigationItem[];
}

export interface ImageProps extends BaseProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  loading?: 'lazy' | 'eager';
}

// Re-export types from @sfw/content for convenience
export type { SiteConfig, Testimonial, FAQ, ServiceArea, BlogPost } from '@sfw/content';
