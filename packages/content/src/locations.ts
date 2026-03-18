/**
 * Location Hub Data
 * Defines service locations for metro areas with localized content
 */
import type { Testimonial } from './types';

export interface LocationNeighborhood {
  name: string;
  description?: string;
}

export interface LocationService {
  name: string;
  description: string;
  icon?: string;
}

export interface Location {
  // Basic Info
  slug: string;
  name: string;
  state: string;
  fullName: string; // e.g., "Seattle, WA"

  // SEO
  metaTitle: string;
  metaDescription: string;

  // Contact
  phone: string;
  email?: string;

  // Content
  heroHeadline: string;
  heroSubheadline: string;
  heroImage?: string;

  // Services (can reference main services or have location-specific ones)
  services: LocationService[];

  // Social Proof
  testimonials: Testimonial[];

  // Coverage Area
  neighborhoods: LocationNeighborhood[];

  // Stats (optional, can override global stats)
  stats?: {
    yearsInArea?: string;
    projectsCompleted?: string;
    satisfactionRate?: string;
  };

  // Geographic
  coordinates?: {
    lat: number;
    lng: number;
  };

  // GMB embed
  mapEmbedSrc?: string;
  // Full iframe src URL from Google Maps → Share → Embed a map.
  // References the GMB listing CID directly. No API key needed.
}

// Location data by service type
export const deckRepairLocations: Record<string, Location> = {
  seattle: {
    slug: 'seattle',
    name: 'Seattle',
    state: 'WA',
    fullName: 'Seattle, WA',

    metaTitle: 'Deck Repair Seattle | Expert Deck Services in Seattle, WA',
    metaDescription: 'Professional deck repair and building services in Seattle, WA. Serving all Seattle neighborhoods with expert craftsmanship. Free estimates.',

    phone: '(503) 905-9046',
    email: 'seattle@deckrepair.com',

    heroHeadline: 'Seattle\'s Trusted Deck Repair Experts',
    heroSubheadline: 'Serving the Greater Seattle Area with Premium Deck Services Since 1999',
    heroImage: 'https://cdn-ileeamj.nitrocdn.com/WrsmSvzGThHeWebWzpPigJcevuotdycK/assets/images/optimized/rev-26df6f7/rotrepairseattle.com/wp-content/uploads/2025/10/rot-repair-seattle.webp',

    services: [
      {
        name: 'Deck Repair & Restoration',
        description: 'Expert repairs for Seattle\'s weather-worn decks. We handle rot, structural issues, and weather damage.',
      },
      {
        name: 'Custom Deck Building',
        description: 'Custom deck designs perfect for Seattle\'s unique hillside lots and water views.',
      },
      {
        name: 'Deck Staining & Sealing',
        description: 'Protect your deck from Seattle\'s rain with our premium staining and sealing services.',
      },
      {
        name: 'Deck Maintenance',
        description: 'Regular maintenance programs to keep your Seattle deck beautiful year-round.',
      },
    ],

    testimonials: [],

    neighborhoods: [
      { name: 'Capitol Hill', description: 'Historic homes with unique deck requirements' },
      { name: 'Ballard', description: 'Craftsman homes and modern deck designs' },
      { name: 'West Seattle', description: 'Waterfront and hillside deck specialists' },
      { name: 'Queen Anne', description: 'Luxury deck building and restoration' },
      { name: 'Fremont', description: 'Creative deck solutions for urban spaces' },
      { name: 'Green Lake', description: 'Family-friendly outdoor living spaces' },
      { name: 'Wallingford', description: 'Custom deck designs for classic homes' },
      { name: 'Ravenna', description: 'Tree-integrated deck construction' },
      { name: 'Madison Park', description: 'High-end waterfront deck building' },
      { name: 'Magnolia', description: 'View-maximizing deck designs' },
      { name: 'University District', description: 'Affordable deck repair and building' },
      { name: 'Georgetown', description: 'Industrial-style modern decks' },
    ],

    stats: {
      yearsInArea: '25+',
      projectsCompleted: '2,500+',
      satisfactionRate: '99%',
    },

    coordinates: {
      lat: 47.6062,
      lng: -122.3321,
    },
  },

  portland: {
    slug: 'portland',
    name: 'Portland',
    state: 'OR',
    fullName: 'Portland, OR',

    metaTitle: 'Deck Repair Portland | Expert Deck Services in Portland, OR',
    metaDescription: 'Professional deck repair and building services in Portland, OR. Serving all Portland metro neighborhoods with expert craftsmanship. Free estimates.',

    phone: '(503) 905-9046',
    email: 'portland@deckrepair.com',

    heroHeadline: 'Portland\'s Premier Deck Builders',
    heroSubheadline: 'Crafting Beautiful Outdoor Spaces Across the Portland Metro Area',
    heroImage: 'https://cdn-ileeamj.nitrocdn.com/WrsmSvzGThHeWebWzpPigJcevuotdycK/assets/images/optimized/rev-26df6f7/rotrepairseattle.com/wp-content/uploads/2025/10/rot-repair-seattle.webp',

    services: [
      {
        name: 'Deck Repair & Restoration',
        description: 'Expert deck repairs for Portland\'s wet climate. Specializing in moisture damage and rot prevention.',
      },
      {
        name: 'Custom Deck Building',
        description: 'Eco-friendly deck designs using sustainable materials perfect for Portland homes.',
      },
      {
        name: 'Deck Staining & Sealing',
        description: 'Premium weatherproofing to protect against Portland\'s rainy seasons.',
      },
      {
        name: 'Cedar Deck Specialists',
        description: 'Expert cedar deck construction and restoration, perfect for Pacific Northwest homes.',
      },
    ],

    testimonials: [],

    neighborhoods: [
      { name: 'Pearl District', description: 'Urban rooftop and balcony decks' },
      { name: 'Hawthorne', description: 'Vintage home deck restoration' },
      { name: 'Lake Oswego', description: 'Luxury waterfront deck building' },
      { name: 'Alberta Arts', description: 'Creative and eco-friendly deck designs' },
      { name: 'Sellwood-Moreland', description: 'Historic home deck specialists' },
      { name: 'Northwest District', description: 'High-end custom deck construction' },
      { name: 'Division-Clinton', description: 'Modern deck designs for new homes' },
      { name: 'St. Johns', description: 'Affordable deck repair and building' },
      { name: 'Beaverton', description: 'Suburban family deck specialists' },
      { name: 'Hillsboro', description: 'Modern deck construction' },
      { name: 'Tigard', description: 'Deck building for growing families' },
      { name: 'West Linn', description: 'Premium deck building services' },
    ],

    stats: {
      yearsInArea: '20+',
      projectsCompleted: '1,800+',
      satisfactionRate: '98%',
    },

    coordinates: {
      lat: 45.5152,
      lng: -122.6784,
    },

    mapEmbedSrc: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d716251.5385569318!2d-122.71848044999999!3d45.47267295!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0xad5e3ad74c43a045%3A0xf875049f0c21743b!2sRot%20Repair%20Experts!5e0!3m2!1sen!2sus!4v1773330252687!5m2!1sen!2sus',
  },
};

// Helper function to get location by slug
export function getLocation(slug: string): Location | undefined {
  return deckRepairLocations[slug];
}

// Helper function to get all locations
export function getAllLocations(): Location[] {
  return Object.values(deckRepairLocations);
}

// Helper function to get location paths for static generation
export function getLocationPaths() {
  return Object.keys(deckRepairLocations).map((slug) => ({
    params: { slug },
  }));
}
