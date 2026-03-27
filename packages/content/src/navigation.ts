import { NavigationItem } from './types';

/** Default navigation used by most microsite homepages */
export const defaultNav: NavigationItem[] = [
  { label: 'Home', url: '/' },
  { label: 'Services', url: '/services' },
  { label: 'Blog', url: '/blog' },
  { label: 'Locations', url: '/locations' },
];

export const primaryNav: NavigationItem[] = [
  { label: 'Home', url: '/' },
  { label: 'Services', url: '/services' },
  { label: 'Service Areas', url: '/service-areas' },
  { label: 'About', url: '/about' },
  { label: 'Blog', url: '/blog' },
  { label: 'Contact', url: '/contact' },
];

export const footerNav: NavigationItem[] = [
  { label: 'Home', url: '/' },
  { label: 'Free Estimate', url: '/estimate' },
  { label: 'Blog', url: '/blog' },
  { label: 'Call Us', url: 'tel:5038850236' },
];
