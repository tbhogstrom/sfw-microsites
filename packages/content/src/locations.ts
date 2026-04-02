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

// Shared neighborhood data (geographic, not service-specific)
const seattleNeighborhoods: LocationNeighborhood[] = [
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
];

const portlandNeighborhoods: LocationNeighborhood[] = [
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
];

// Location data by service type
export const deckRepairLocations: Record<string, Location> = {
  seattle: {
    slug: 'seattle',
    name: 'Seattle',
    state: 'WA',
    fullName: 'Seattle, WA',

    metaTitle: 'Deck Repair Seattle | Expert Deck Services in Seattle, WA',
    metaDescription:
      'Professional deck repair and building services in Seattle, WA. Serving all Seattle neighborhoods with expert craftsmanship. Free estimates.',

    phone: '(503) 905-9046',
    email: 'seattle@deckrepair.com',

    heroHeadline: "Seattle's Trusted Deck Repair Experts",
    heroSubheadline: 'Serving the Greater Seattle Area with Premium Deck Services Since 1999',
    heroImage:
      'https://cdn-ileeamj.nitrocdn.com/WrsmSvzGThHeWebWzpPigJcevuotdycK/assets/images/optimized/rev-26df6f7/rotrepairseattle.com/wp-content/uploads/2025/10/rot-repair-seattle.webp',

    services: [
      {
        name: 'Deck Repair & Restoration',
        description:
          "Expert repairs for Seattle's weather-worn decks. We handle rot, structural issues, and weather damage.",
      },
      {
        name: 'Custom Deck Building',
        description:
          "Custom deck designs perfect for Seattle's unique hillside lots and water views.",
      },
      {
        name: 'Deck Staining & Sealing',
        description:
          "Protect your deck from Seattle's rain with our premium staining and sealing services.",
      },
      {
        name: 'Deck Maintenance',
        description: 'Regular maintenance programs to keep your Seattle deck beautiful year-round.',
      },
    ],

    testimonials: [],

    neighborhoods: seattleNeighborhoods,

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
    metaDescription:
      'Professional deck repair and building services in Portland, OR. Serving all Portland metro neighborhoods with expert craftsmanship. Free estimates.',

    phone: '(503) 905-9046',
    email: 'portland@deckrepair.com',

    heroHeadline: "Portland's Premier Deck Builders",
    heroSubheadline: 'Crafting Beautiful Outdoor Spaces Across the Portland Metro Area',
    heroImage:
      'https://cdn-ileeamj.nitrocdn.com/WrsmSvzGThHeWebWzpPigJcevuotdycK/assets/images/optimized/rev-26df6f7/rotrepairseattle.com/wp-content/uploads/2025/10/rot-repair-seattle.webp',

    services: [
      {
        name: 'Deck Repair & Restoration',
        description:
          "Expert deck repairs for Portland's wet climate. Specializing in moisture damage and rot prevention.",
      },
      {
        name: 'Custom Deck Building',
        description:
          'Eco-friendly deck designs using sustainable materials perfect for Portland homes.',
      },
      {
        name: 'Deck Staining & Sealing',
        description: "Premium weatherproofing to protect against Portland's rainy seasons.",
      },
      {
        name: 'Cedar Deck Specialists',
        description:
          'Expert cedar deck construction and restoration, perfect for Pacific Northwest homes.',
      },
    ],

    testimonials: [],

    neighborhoods: portlandNeighborhoods,

    stats: {
      yearsInArea: '20+',
      projectsCompleted: '1,800+',
      satisfactionRate: '98%',
    },

    coordinates: {
      lat: 45.5152,
      lng: -122.6784,
    },

    mapEmbedSrc:
      'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d716251.5385569318!2d-122.71848044999999!3d45.47267295!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0xad5e3ad74c43a045%3A0xf875049f0c21743b!2sRot%20Repair%20Experts!5e0!3m2!1sen!2sus!4v1773330252687!5m2!1sen!2sus',
  },
};

const beamRepairLocations: Record<string, Location> = {
  seattle: {
    slug: 'seattle',
    name: 'Seattle',
    state: 'WA',
    fullName: 'Seattle, WA',
    metaTitle: 'Structural Beam Repair Seattle | Beam Repair Experts in Seattle, WA',
    metaDescription:
      'Professional structural beam repair services in Seattle, WA. Load-bearing beam replacement, reinforcement, and restoration. Free estimates.',
    phone: '(503) 905-9046',
    heroHeadline: "Seattle's Trusted Structural Beam Repair Experts",
    heroSubheadline:
      'Load-Bearing Beam Replacement & Structural Restoration Across Greater Seattle',
    services: [
      {
        name: 'Load-Bearing Beam Repair',
        description:
          "Expert repair of damaged load-bearing beams in Seattle's older homes and commercial structures.",
      },
      {
        name: 'Beam Replacement',
        description:
          'Full structural beam replacement with engineered lumber and steel reinforcement.',
      },
      {
        name: 'Beam Sistering & Reinforcement',
        description:
          'Strengthen weakened beams with sistering techniques to restore structural integrity.',
      },
      {
        name: 'Rot-Damaged Beam Restoration',
        description: "Repair beams damaged by moisture and rot, common in Seattle's wet climate.",
      },
    ],
    testimonials: [],
    neighborhoods: seattleNeighborhoods,
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
    metaTitle: 'Structural Beam Repair Portland | Beam Repair Experts in Portland, OR',
    metaDescription:
      'Professional structural beam repair and replacement in Portland, OR. Licensed experts in load-bearing beam restoration. Free estimates.',
    phone: '(503) 905-9046',
    heroHeadline: "Portland's Premier Structural Beam Repair Team",
    heroSubheadline: 'Expert Beam Replacement & Reinforcement Across the Portland Metro Area',
    services: [
      {
        name: 'Load-Bearing Beam Repair',
        description:
          "Restore structural integrity to damaged beams in Portland's homes and buildings.",
      },
      {
        name: 'Beam Replacement',
        description:
          'Complete beam replacement using engineered lumber sized for Pacific Northwest construction.',
      },
      {
        name: 'Beam Sistering & Reinforcement',
        description:
          'Reinforce weakened beams without full replacement to preserve existing framing.',
      },
      {
        name: 'Foundation Beam Repair',
        description:
          "Repair and replace foundation-level beams damaged by Portland's moisture conditions.",
      },
    ],
    testimonials: [],
    neighborhoods: portlandNeighborhoods,
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

const chimneyRepairLocations: Record<string, Location> = {
  seattle: {
    slug: 'seattle',
    name: 'Seattle',
    state: 'WA',
    fullName: 'Seattle, WA',
    metaTitle: 'Chimney Repair Seattle | Chimney Repair Experts in Seattle, WA',
    metaDescription:
      'Professional chimney repair and restoration services in Seattle, WA. Wood chimney framing, rot repair, and waterproofing. Free estimates.',
    phone: '(503) 905-9046',
    heroHeadline: "Seattle's Trusted Chimney Repair Experts",
    heroSubheadline: 'Wood Chimney Framing, Rot Repair & Restoration Across Greater Seattle',
    services: [
      {
        name: 'Chimney Framing Repair',
        description: "Rebuild and restore wood chimney framing damaged by Seattle's wet weather.",
      },
      {
        name: 'Chimney Rot Remediation',
        description:
          'Remove rot and replace damaged wood around chimney structures to prevent further decay.',
      },
      {
        name: 'Chimney Flashing & Waterproofing',
        description:
          'Seal chimney penetrations against water intrusion with expert flashing installation.',
      },
      {
        name: 'Chimney Siding Restoration',
        description:
          'Replace damaged siding and trim around chimneys to restore appearance and protection.',
      },
    ],
    testimonials: [],
    neighborhoods: seattleNeighborhoods,
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
    metaTitle: 'Chimney Repair Portland | Chimney Repair Experts in Portland, OR',
    metaDescription:
      'Professional chimney repair and wood chimney restoration in Portland, OR. Expert framing, rot repair, and waterproofing. Free estimates.',
    phone: '(503) 905-9046',
    heroHeadline: "Portland's Premier Chimney Repair Specialists",
    heroSubheadline: 'Expert Chimney Restoration & Rot Repair Across the Portland Metro Area',
    services: [
      {
        name: 'Chimney Framing Repair',
        description:
          "Restore structural wood framing around chimneys damaged by Portland's rain and moisture.",
      },
      {
        name: 'Chimney Rot Remediation',
        description:
          'Complete rot removal and wood replacement for chimney structures and surrounds.',
      },
      {
        name: 'Chimney Flashing & Waterproofing',
        description: 'Professional chimney flashing to stop leaks and prevent water damage.',
      },
      {
        name: 'Chimney Siding Restoration',
        description: 'Repair and replace chimney siding and trim for lasting weather protection.',
      },
    ],
    testimonials: [],
    neighborhoods: portlandNeighborhoods,
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

const crawlspaceRotLocations: Record<string, Location> = {
  seattle: {
    slug: 'seattle',
    name: 'Seattle',
    state: 'WA',
    fullName: 'Seattle, WA',
    metaTitle: 'Crawlspace Rot Repair Seattle | Crawlspace Experts in Seattle, WA',
    metaDescription:
      'Professional crawlspace rot remediation in Seattle, WA. Subfloor repair, foundation wood replacement, and moisture control. Free estimates.',
    phone: '(503) 905-9046',
    heroHeadline: "Seattle's Trusted Crawlspace Rot Repair Experts",
    heroSubheadline:
      'Subfloor Repair, Foundation Restoration & Moisture Control Across Greater Seattle',
    services: [
      {
        name: 'Subfloor Rot Repair',
        description:
          "Replace rot-damaged subfloor sheathing and joists caused by Seattle's persistent moisture.",
      },
      {
        name: 'Foundation Wood Replacement',
        description:
          'Remove and replace rotted sill plates, rim joists, and foundation-level framing.',
      },
      {
        name: 'Crawlspace Moisture Control',
        description:
          'Install vapor barriers, drainage, and ventilation to prevent future rot in crawlspaces.',
      },
      {
        name: 'Structural Joist Repair',
        description:
          'Sister or replace damaged floor joists to restore structural support beneath your home.',
      },
    ],
    testimonials: [],
    neighborhoods: seattleNeighborhoods,
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
    metaTitle: 'Crawlspace Rot Repair Portland | Crawlspace Experts in Portland, OR',
    metaDescription:
      'Professional crawlspace rot remediation and subfloor repair in Portland, OR. Foundation wood replacement and moisture control. Free estimates.',
    phone: '(503) 905-9046',
    heroHeadline: "Portland's Premier Crawlspace Rot Repair Team",
    heroSubheadline: 'Expert Subfloor & Foundation Restoration Across the Portland Metro Area',
    services: [
      {
        name: 'Subfloor Rot Repair',
        description:
          'Repair and replace rotted subflooring in Portland homes affected by moisture intrusion.',
      },
      {
        name: 'Foundation Wood Replacement',
        description: 'Replace damaged sill plates and rim joists at the foundation level.',
      },
      {
        name: 'Crawlspace Encapsulation',
        description:
          'Full crawlspace encapsulation with vapor barriers and drainage for lasting moisture control.',
      },
      {
        name: 'Structural Joist Repair',
        description:
          'Restore floor support with joist sistering and replacement for sagging or damaged floors.',
      },
    ],
    testimonials: [],
    neighborhoods: portlandNeighborhoods,
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

const dryRotLocations: Record<string, Location> = {
  seattle: {
    slug: 'seattle',
    name: 'Seattle',
    state: 'WA',
    fullName: 'Seattle, WA',
    metaTitle: 'Dry Rot Repair Seattle | Rot Repair Experts in Seattle, WA',
    metaDescription:
      'Professional dry rot repair and wood restoration in Seattle, WA. Expert rot removal, structural repair, and prevention. Free estimates.',
    phone: '(503) 905-9046',
    heroHeadline: "Seattle's Trusted Dry Rot Repair Experts",
    heroSubheadline: 'Wood Rot Removal, Structural Repair & Prevention Across Greater Seattle',
    services: [
      {
        name: 'Dry Rot Removal & Repair',
        description:
          "Expert removal of rot-damaged wood and restoration of structural integrity in Seattle's damp climate.",
      },
      {
        name: 'Wood Rot Prevention',
        description: 'Preventive treatments and moisture management to stop rot before it starts.',
      },
      {
        name: 'Structural Wood Restoration',
        description:
          'Replace rotted framing, sheathing, and structural members with treated lumber.',
      },
      {
        name: 'Fungus Treatment & Remediation',
        description:
          'Identify and eliminate wood-decay fungi to protect your home from recurring rot damage.',
      },
    ],
    testimonials: [],
    neighborhoods: seattleNeighborhoods,
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
    metaTitle: 'Dry Rot Repair Portland | Rot Repair Experts in Portland, OR',
    metaDescription:
      'Professional dry rot repair and wood rot remediation in Portland, OR. Expert rot removal, wood restoration, and moisture control. Free estimates.',
    phone: '(503) 905-9046',
    heroHeadline: "Portland's Premier Dry Rot Repair Specialists",
    heroSubheadline: 'Expert Wood Rot Remediation & Restoration Across the Portland Metro Area',
    services: [
      {
        name: 'Dry Rot Removal & Repair',
        description:
          "Comprehensive rot removal and wood replacement for Portland's moisture-prone homes.",
      },
      {
        name: 'Wood Rot Prevention',
        description:
          'Moisture barriers, ventilation, and treated wood to prevent future rot damage.',
      },
      {
        name: 'Structural Wood Restoration',
        description: 'Restore load-bearing walls, beams, and framing compromised by rot and decay.',
      },
      {
        name: 'Exterior Rot Repair',
        description: 'Repair rotted siding, trim, fascia, and other exterior wood components.',
      },
    ],
    testimonials: [],
    neighborhoods: portlandNeighborhoods,
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

const flashingRepairLocations: Record<string, Location> = {
  seattle: {
    slug: 'seattle',
    name: 'Seattle',
    state: 'WA',
    fullName: 'Seattle, WA',
    metaTitle: 'Flashing Repair Seattle | Flashing Repair Experts in Seattle, WA',
    metaDescription:
      'Professional flashing repair and waterproofing in Seattle, WA. Window, roof, and wall flashing installation and replacement. Free estimates.',
    phone: '(503) 905-9046',
    heroHeadline: "Seattle's Trusted Flashing Repair Experts",
    heroSubheadline: 'Expert Flashing Repair & Waterproofing Across Greater Seattle',
    services: [
      {
        name: 'Window Flashing Repair',
        description:
          "Stop water intrusion around windows with expert flashing repair for Seattle's rainy climate.",
      },
      {
        name: 'Roof Flashing Replacement',
        description:
          'Replace worn or damaged roof flashing at valleys, chimneys, and penetrations.',
      },
      {
        name: 'Kickout Flashing Installation',
        description:
          'Install kickout flashing to redirect water away from walls and prevent hidden moisture damage.',
      },
      {
        name: 'Waterproofing & Sealing',
        description:
          'Comprehensive waterproofing solutions to protect your home from water intrusion.',
      },
    ],
    testimonials: [],
    neighborhoods: seattleNeighborhoods,
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
    metaTitle: 'Flashing Repair Portland | Flashing Repair Experts in Portland, OR',
    metaDescription:
      'Professional flashing repair and waterproofing services in Portland, OR. Expert window, roof, and wall flashing installation. Free estimates.',
    phone: '(503) 905-9046',
    heroHeadline: "Portland's Premier Flashing Repair Specialists",
    heroSubheadline: 'Expert Flashing Installation & Waterproofing Across the Portland Metro Area',
    services: [
      {
        name: 'Window Flashing Repair',
        description:
          "Prevent leaks and water damage with proper window flashing for Portland's wet climate.",
      },
      {
        name: 'Roof Flashing Replacement',
        description:
          'Replace deteriorated roof flashing to stop leaks at chimney, skylight, and vent penetrations.',
      },
      {
        name: 'Kickout Flashing Installation',
        description:
          'Critical kickout flashing to divert roof runoff away from siding and wall assemblies.',
      },
      {
        name: 'Wall Flashing & Waterproofing',
        description:
          'Protect wall assemblies from moisture intrusion with professional flashing systems.',
      },
    ],
    testimonials: [],
    neighborhoods: portlandNeighborhoods,
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

const leadPaintLocations: Record<string, Location> = {
  seattle: {
    slug: 'seattle',
    name: 'Seattle',
    state: 'WA',
    fullName: 'Seattle, WA',
    metaTitle: 'Lead Paint Removal Seattle | Lead Paint Professionals in Seattle, WA',
    metaDescription:
      'Certified lead paint testing, removal, and abatement in Seattle, WA. Protecting families in pre-1978 homes. Free estimates.',
    phone: '(503) 905-9046',
    heroHeadline: "Seattle's Certified Lead Paint Professionals",
    heroSubheadline: 'Lead Testing, Removal & Abatement Services Across Greater Seattle',
    services: [
      {
        name: 'Lead Paint Testing',
        description:
          'Certified lead paint testing using XRF analyzers and lab analysis for Seattle homes built before 1978.',
      },
      {
        name: 'Lead Paint Removal',
        description:
          'Safe, EPA-compliant lead paint removal following strict containment and disposal protocols.',
      },
      {
        name: 'Lead Abatement',
        description:
          'Permanent lead hazard elimination through encapsulation, enclosure, or complete removal.',
      },
      {
        name: 'Lead-Safe Renovation',
        description:
          'RRP-certified renovation work that maintains lead safety during remodeling projects.',
      },
    ],
    testimonials: [],
    neighborhoods: seattleNeighborhoods,
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
    metaTitle: 'Lead Paint Removal Portland | Lead Paint Professionals in Portland, OR',
    metaDescription:
      'Certified lead paint testing, removal, and abatement in Portland, OR. Protecting families in historic homes. Free estimates.',
    phone: '(503) 905-9046',
    heroHeadline: "Portland's Trusted Lead Paint Professionals",
    heroSubheadline: 'Certified Lead Testing, Removal & Abatement Across the Portland Metro Area',
    services: [
      {
        name: 'Lead Paint Testing',
        description:
          "Comprehensive lead testing for Portland's many pre-1978 homes using certified methods.",
      },
      {
        name: 'Lead Paint Removal',
        description: 'EPA-compliant lead paint removal with full containment and safe disposal.',
      },
      {
        name: 'Lead Abatement',
        description:
          'Permanent lead hazard solutions for historic Portland homes through certified abatement.',
      },
      {
        name: 'Lead-Safe Renovation',
        description:
          'RRP-certified remodeling that keeps your family safe from lead dust and debris.',
      },
    ],
    testimonials: [],
    neighborhoods: portlandNeighborhoods,
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

const leakRepairLocations: Record<string, Location> = {
  seattle: {
    slug: 'seattle',
    name: 'Seattle',
    state: 'WA',
    fullName: 'Seattle, WA',
    metaTitle: 'Leak Repair Seattle | Leak Detection Experts in Seattle, WA',
    metaDescription:
      'Professional leak detection and repair in Seattle, WA. Stop water damage with expert moisture intrusion solutions. Free estimates.',
    phone: '(503) 905-9046',
    heroHeadline: "Seattle's Trusted Leak Repair Experts",
    heroSubheadline: 'Leak Detection, Water Damage Prevention & Repair Across Greater Seattle',
    services: [
      {
        name: 'Leak Detection',
        description:
          "Advanced moisture detection to find hidden leaks in Seattle's rain-battered homes.",
      },
      {
        name: 'Window Leak Repair',
        description:
          'Stop window leaks with expert flashing, caulking, and weatherproofing solutions.',
      },
      {
        name: 'Roof Leak Repair',
        description:
          'Locate and repair roof leaks before they cause structural damage to your home.',
      },
      {
        name: 'Water Damage Restoration',
        description:
          'Repair and restore areas damaged by water intrusion, including framing and sheathing.',
      },
    ],
    testimonials: [],
    neighborhoods: seattleNeighborhoods,
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
    metaTitle: 'Leak Repair Portland | Leak Detection Experts in Portland, OR',
    metaDescription:
      'Professional leak detection and repair services in Portland, OR. Expert moisture intrusion solutions and water damage prevention. Free estimates.',
    phone: '(503) 905-9046',
    heroHeadline: "Portland's Premier Leak Detection & Repair Team",
    heroSubheadline: 'Expert Leak Repair & Water Damage Prevention Across the Portland Metro Area',
    services: [
      {
        name: 'Leak Detection',
        description: "Pinpoint hidden leaks and moisture intrusion in Portland's wet climate.",
      },
      {
        name: 'Window Leak Repair',
        description: 'Repair and weatherproof leaking windows to prevent interior water damage.',
      },
      {
        name: 'Roof Leak Repair',
        description:
          "Fix roof leaks at penetrations, valleys, and flashing failures common in Portland's rain.",
      },
      {
        name: 'Water Damage Restoration',
        description:
          'Restore walls, framing, and finishes damaged by chronic or acute water intrusion.',
      },
    ],
    testimonials: [],
    neighborhoods: portlandNeighborhoods,
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

const trimRepairLocations: Record<string, Location> = {
  seattle: {
    slug: 'seattle',
    name: 'Seattle',
    state: 'WA',
    fullName: 'Seattle, WA',
    metaTitle: 'Trim Repair Seattle | Trim Repair Experts in Seattle, WA',
    metaDescription:
      'Professional exterior trim repair and replacement in Seattle, WA. Fascia, soffit, and trim restoration. Free estimates.',
    phone: '(503) 905-9046',
    heroHeadline: "Seattle's Trusted Trim Repair Experts",
    heroSubheadline: 'Fascia, Soffit & Exterior Trim Restoration Across Greater Seattle',
    services: [
      {
        name: 'Fascia Board Repair',
        description:
          "Replace rotted and damaged fascia boards to protect Seattle's homes from water intrusion.",
      },
      {
        name: 'Soffit Repair & Replacement',
        description:
          'Restore damaged soffits to maintain proper attic ventilation and prevent pest entry.',
      },
      {
        name: 'Exterior Trim Restoration',
        description:
          'Repair and replace decorative and functional exterior trim on homes of all styles.',
      },
      {
        name: 'Corner Board & Rake Trim Repair',
        description:
          'Replace corner boards and rake trim to restore weather protection and curb appeal.',
      },
    ],
    testimonials: [],
    neighborhoods: seattleNeighborhoods,
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
    metaTitle: 'Trim Repair Portland | Trim Repair Experts in Portland, OR',
    metaDescription:
      'Professional exterior trim repair and replacement in Portland, OR. Fascia, soffit, and trim restoration specialists. Free estimates.',
    phone: '(503) 905-9046',
    heroHeadline: "Portland's Premier Trim Repair Specialists",
    heroSubheadline: 'Expert Fascia, Soffit & Trim Restoration Across the Portland Metro Area',
    services: [
      {
        name: 'Fascia Board Repair',
        description: "Repair and replace fascia boards damaged by Portland's rain and moisture.",
      },
      {
        name: 'Soffit Repair & Replacement',
        description:
          'Restore soffits to maintain ventilation and protect against moisture and pests.',
      },
      {
        name: 'Exterior Trim Restoration',
        description: "Replace rotted trim with durable materials suited to Portland's climate.",
      },
      {
        name: 'Window & Door Trim Repair',
        description: 'Repair trim around windows and doors to stop leaks and restore curb appeal.',
      },
    ],
    testimonials: [],
    neighborhoods: portlandNeighborhoods,
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

// Master map of site key → location data
export const siteLocations: Record<string, Record<string, Location>> = {
  'beam-repair': beamRepairLocations,
  'chimney-repair': chimneyRepairLocations,
  'crawlspace-rot': crawlspaceRotLocations,
  'deck-repair': deckRepairLocations,
  'dry-rot': dryRotLocations,
  'flashing-repair': flashingRepairLocations,
  'lead-paint': leadPaintLocations,
  'leak-repair': leakRepairLocations,
  'trim-repair': trimRepairLocations,
};

// Helper function to get the location record for a site (falls back to deck-repair)
function getLocationsForSite(siteKey?: string): Record<string, Location> {
  if (siteKey && siteLocations[siteKey]) {
    return siteLocations[siteKey];
  }
  return deckRepairLocations;
}

// Helper function to get location by slug
export function getLocation(slug: string, siteKey?: string): Location | undefined {
  return getLocationsForSite(siteKey)[slug];
}

// Helper function to get all locations
export function getAllLocations(siteKey?: string): Location[] {
  return Object.values(getLocationsForSite(siteKey));
}

// Helper function to get location paths for static generation
export function getLocationPaths(siteKey?: string) {
  return Object.keys(getLocationsForSite(siteKey)).map((slug) => ({
    params: { slug },
  }));
}
