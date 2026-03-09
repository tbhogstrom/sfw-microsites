import { serviceConfigs } from '@sfw/content';
import type { Location } from '@sfw/content';

const config = serviceConfigs['siding-repair'];

export const sidingLocations: Record<string, Location> = {
  portland: {
    slug: 'portland',
    name: 'Portland',
    state: 'OR',
    fullName: 'Portland, OR',
    metaTitle: 'Siding Repair Portland | Hardie Board, Rot Repair & Replacement',
    metaDescription:
      'Professional siding repair and replacement in Portland, OR. We repair rot, moisture intrusion, damaged trim, and fiber cement siding across the Portland metro area.',
    phone: config.phone,
    heroHeadline: "Portland's Trusted Siding Repair Experts",
    heroSubheadline:
      'Repairing damaged siding, moisture intrusion, and exterior rot across the Portland metro area with durable, weather-ready solutions.',
    services: [
      {
        name: 'Siding Repair & Replacement',
        description:
          'We repair cracked, loose, and deteriorated siding, then match replacement materials for a clean, durable finish.',
      },
      {
        name: 'Hardie Board & Fiber Cement',
        description:
          'Installation and repair of fiber cement siding systems built for Portland rain, moisture exposure, and long-term durability.',
      },
      {
        name: 'Rot & Water Intrusion Repair',
        description:
          'We trace leaks behind siding, replace damaged sheathing or trim, and rebuild assemblies to keep water out.',
      },
      {
        name: 'Trim, Flashing & Weatherproofing',
        description:
          'Integrated repairs for trim, corner boards, and flashing to restore a complete exterior moisture barrier.',
      },
    ],
    testimonials: [
      {
        name: 'Emily Rodriguez',
        location: 'Pearl District, Portland',
        text: 'They found the moisture damage behind our siding, fixed the sheathing, and matched the new panels so well you cannot tell where the repair was made.',
        rating: 5,
        service: 'Siding Repair',
      },
      {
        name: 'James Wilson',
        location: 'Hawthorne, Portland',
        text: 'We expected a cosmetic patch. They corrected the flashing details and rebuilt the damaged wall section properly.',
        rating: 5,
        service: 'Rot & Water Intrusion Repair',
      },
      {
        name: 'Lisa Thompson',
        location: 'Lake Oswego',
        text: 'Clear estimate, fast scheduling, and solid workmanship. Our fiber cement siding looks better and feels substantially more weather-tight.',
        rating: 5,
        service: 'Fiber Cement Siding',
      },
    ],
    neighborhoods: [
      { name: 'Pearl District', description: 'Urban homes and mixed-material exterior repairs' },
      { name: 'Hawthorne', description: 'Older homes with moisture and trim repair needs' },
      { name: 'Lake Oswego', description: 'High-end siding replacement and envelope repairs' },
      { name: 'Alberta Arts', description: 'Exterior upgrades for vintage Portland homes' },
      { name: 'Sellwood-Moreland', description: 'Wood siding and corner board repair specialists' },
      { name: 'Northwest District', description: 'Tight-access projects and detailed exterior restoration' },
      { name: 'Division-Clinton', description: 'Modern siding upgrades and leak prevention' },
      { name: 'St. Johns', description: 'Affordable siding repairs and replacement planning' },
      { name: 'Beaverton', description: 'Full-service siding and water-intrusion repairs' },
      { name: 'Hillsboro', description: 'Fiber cement and composite siding work' },
      { name: 'Tigard', description: 'Fast-response siding damage repairs' },
      { name: 'West Linn', description: 'Premium exterior restoration and trim integration' },
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
  seattle: {
    slug: 'seattle',
    name: 'Seattle',
    state: 'WA',
    fullName: 'Seattle, WA',
    metaTitle: 'Siding Repair Seattle | Exterior Rot Repair & Replacement',
    metaDescription:
      'Professional siding repair and replacement in Seattle, WA. We handle moisture damage, rot remediation, fiber cement repairs, and exterior weatherproofing.',
    phone: config.phone,
    heroHeadline: "Seattle's Local Siding Repair Team",
    heroSubheadline:
      'Protecting Seattle homes with expert siding repairs, exterior rot remediation, and weatherproof detailing built for wet conditions.',
    services: [
      {
        name: 'Siding Repair & Replacement',
        description:
          'Targeted repairs for damaged panels, failed joints, and aging siding systems on Seattle homes.',
      },
      {
        name: 'Fiber Cement & Hardie Repairs',
        description:
          'Specialized repair and replacement for fiber cement siding with proper clearance, fastening, and detailing.',
      },
      {
        name: 'Moisture Damage Restoration',
        description:
          'We open up damaged wall sections, correct water pathways, and rebuild the assembly the right way.',
      },
      {
        name: 'Flashing & Trim Integration',
        description:
          'Window, door, trim, and corner transitions repaired to prevent recurring leaks and hidden rot.',
      },
    ],
    testimonials: [
      {
        name: 'Michael Chen',
        location: 'Capitol Hill, Seattle',
        text: 'They solved a recurring leak that two other contractors missed. The siding and flashing repairs were clean and well explained.',
        rating: 5,
        service: 'Siding & Flashing Repair',
      },
      {
        name: 'Sarah Johnson',
        location: 'Ballard, Seattle',
        text: 'Our cedar siding had hidden rot around a window. They repaired the framing, matched the exterior, and improved the waterproofing details.',
        rating: 5,
        service: 'Exterior Rot Repair',
      },
      {
        name: 'David Martinez',
        location: 'West Seattle',
        text: 'Professional crew, strong communication, and no shortcuts. The new fiber cement section blends in perfectly with the rest of the house.',
        rating: 5,
        service: 'Fiber Cement Siding',
      },
    ],
    neighborhoods: [
      { name: 'Capitol Hill', description: 'Older homes with complex exterior detailing' },
      { name: 'Ballard', description: 'Cedar siding repair and weather exposure upgrades' },
      { name: 'West Seattle', description: 'Wind- and rain-exposed exterior restoration' },
      { name: 'Queen Anne', description: 'Architectural siding repair for historic homes' },
      { name: 'Fremont', description: 'Custom siding solutions for urban properties' },
      { name: 'Green Lake', description: 'Family homes needing durable exterior protection' },
      { name: 'Wallingford', description: 'Classic homes with trim and siding repair needs' },
      { name: 'Ravenna', description: 'Moisture management and exterior envelope repairs' },
      { name: 'Madison Park', description: 'Premium siding replacement and detail work' },
      { name: 'Magnolia', description: 'Coastal-exposure siding and flashing upgrades' },
      { name: 'University District', description: 'Cost-conscious repairs and replacements' },
      { name: 'Georgetown', description: 'Durable siding systems for mixed-use properties' },
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
};

export function getLocation(slug: string): Location | undefined {
  return sidingLocations[slug];
}

export function getAllLocations(): Location[] {
  return Object.values(sidingLocations);
}

export function getLocationPaths() {
  return Object.keys(sidingLocations).map((slug) => ({
    params: { slug },
  }));
}
