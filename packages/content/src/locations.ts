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
}

// Location data by service type
export const deckRepairLocations: Record<string, Location> = {
  seattle: {
    slug: 'seattle',
    name: 'Seattle',
    state: 'WA',
    fullName: 'Seattle, WA',

    metaTitle: 'Deck Repair Seattle | Expert Deck Services in Seattle, WA',
    metaDescription: 'Professional deck repair and building services in Seattle, WA. Serving all Seattle neighborhoods with expert craftsmanship. Free estimates. Call (206) 555-0100.',

    phone: '(206) 555-0100',
    email: 'seattle@deckrepair.com',

    heroHeadline: 'Seattle\'s Trusted Deck Repair Experts',
    heroSubheadline: 'Serving the Greater Seattle Area with Premium Deck Services Since 1999',
    heroImage: '/images/locations/seattle-deck-hero.jpg',

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

    testimonials: [
      {
        name: 'Michael Chen',
        location: 'Capitol Hill, Seattle',
        text: 'They completely transformed our old, rotting deck into a beautiful outdoor space. The team was professional and finished on time despite the rainy weather.',
        rating: 5,
        service: 'Deck Restoration',
      },
      {
        name: 'Sarah Johnson',
        location: 'Ballard, Seattle',
        text: 'Outstanding work on our deck rebuild. They understood the unique challenges of our hillside property and created a stunning multi-level deck.',
        rating: 5,
        service: 'Custom Deck Building',
      },
      {
        name: 'David Martinez',
        location: 'West Seattle',
        text: 'Best deck contractors in Seattle! They repaired our water-damaged deck and it looks brand new. Highly recommend their staining service.',
        rating: 5,
        service: 'Deck Repair',
      },
    ],

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
    metaDescription: 'Professional deck repair and building services in Portland, OR. Serving all Portland metro neighborhoods with expert craftsmanship. Free estimates. Call (503) 555-0200.',

    phone: '(503) 555-0200',
    email: 'portland@deckrepair.com',

    heroHeadline: 'Portland\'s Premier Deck Builders',
    heroSubheadline: 'Crafting Beautiful Outdoor Spaces Across the Portland Metro Area',
    heroImage: '/images/locations/portland-deck-hero.jpg',

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

    testimonials: [
      {
        name: 'Emily Rodriguez',
        location: 'Pearl District, Portland',
        text: 'Incredible attention to detail! Our new rooftop deck is the perfect addition to our condo. The team worked around our busy schedule.',
        rating: 5,
        service: 'Custom Deck Building',
      },
      {
        name: 'James Wilson',
        location: 'Hawthorne, Portland',
        text: 'They saved our old cedar deck! We thought we\'d need a complete rebuild, but they restored it beautifully at half the cost.',
        rating: 5,
        service: 'Deck Restoration',
      },
      {
        name: 'Lisa Thompson',
        location: 'Lake Oswego',
        text: 'Professional, punctual, and their work is top-notch. Our backyard deck is now our favorite space in the house.',
        rating: 5,
        service: 'Deck Building',
      },
    ],

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
