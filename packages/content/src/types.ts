export interface SiteConfig {
  name: string;
  domain: string;
  title: string;
  description: string;
  primaryService: string;
  serviceKeywords: string[];
  searchVolume: number;
  avgDifficulty: number;
  avgCPC: number;
  trafficShare: number;
  phone: string;
  hubspotPortalId: string;
  hubspotFormId: string;
}

export interface CompanyInfo {
  name: string;
  legalName: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  phone: string;
  email: string;
  ccbNumber: string;
}

export interface Testimonial {
  quote?: string; // For backward compatibility
  text?: string; // Alternative to quote
  name?: string; // Alternative to author
  author?: string;
  location: string;
  service?: string;
  date?: string;
  rating?: number;
  image?: string;
}

export interface FAQ {
  question: string;
  answer: string;
}

export interface ServiceArea {
  name: string;
  slug: string;
  description?: string;
}

export interface BlogPost {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  date: string;
  image?: string;
  author?: string;
}

export interface CTAButton {
  text: string;
  url: string;
  style: 'primary' | 'secondary' | 'outline';
}

export interface NavigationItem {
  label: string;
  url: string;
  children?: NavigationItem[];
}

export interface ServiceCard {
  title: string;
  description: string;
  image: string;
  link: string;
}

export interface ProcessStep {
  number: number;
  title: string;
  description: string;
  icon?: string;
}
