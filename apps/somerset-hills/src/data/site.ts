export interface Service {
  title: string;
  description: string;
  /** Inline SVG path data (24x24 viewBox) for the card icon. */
  icon: string;
}

export const site = {
  name: 'Somerset Hills Construction',
  legalName: 'Somerset Hills Construction LLC',
  tagline: 'Building Oregon homes with craftsmanship that lasts.',
  // PLACEHOLDER — replace with the real Oregon CCB license number.
  ccb: 'CCB #000000',
  // PLACEHOLDER — replace with the real phone number.
  phone: '(503) 555-0100',
  // PLACEHOLDER — replace with the real email address.
  email: 'info@somersethillsconstruction.com',
  serviceArea: 'Proudly serving the Willamette Valley and the greater Portland–Salem corridor.',
  hours: [
    { day: 'Monday – Friday', time: '7:00 AM – 5:00 PM' },
    { day: 'Saturday', time: 'By appointment' },
    { day: 'Sunday', time: 'Closed' },
  ],
  about: [
    'Somerset Hills Construction is a locally owned general contractor rooted in the hills and valleys of Oregon. We build and remodel homes the way they should be built — carefully, honestly, and to last for generations.',
    'From the first conversation to the final walkthrough, we treat every project like it’s our own. Our team brings decades of combined experience in residential construction, and we hold ourselves to a simple standard: do excellent work, communicate clearly, and stand behind everything we build.',
  ],
  credentials: ['Licensed', 'Bonded', 'Insured'],
};

export const services: Service[] = [
  {
    title: 'New Home Construction',
    description:
      'Custom homes built from the ground up, designed around how you actually live and finished with care in every detail.',
    icon: 'M3 12l9-9 9 9M5 10v10h14V10',
  },
  {
    title: 'Additions & Remodels',
    description:
      'More room, better flow, modern finishes. We expand and reimagine existing homes without losing their character.',
    icon: 'M4 21V8l8-5 8 5v13M9 21v-6h6v6',
  },
  {
    title: 'Kitchens & Baths',
    description:
      'The rooms you use most, rebuilt for beauty and function — cabinetry, tile, fixtures, and finishes done right.',
    icon: 'M4 4h16v6H4zM4 14h7v6H4zM14 14h6v6h-6z',
  },
  {
    title: 'Decks & Outdoor Living',
    description:
      'Decks, patios, and outdoor spaces engineered for Oregon weather and built to enjoy for decades.',
    icon: 'M3 10h18M5 10v8M19 10v8M3 18h18M8 6h8v4H8z',
  },
  {
    title: 'Framing & Structural',
    description:
      'Solid bones for any project. Precise framing and structural work that meets code and stands the test of time.',
    icon: 'M3 21V5l9-2 9 2v16M3 21h18M8 21V9h8v12',
  },
  {
    title: 'Repairs & Maintenance',
    description:
      'Dry rot, water damage, aging finishes — we diagnose the real problem and fix it properly the first time.',
    icon: 'M14 6l4 4-8 8H6v-4zM3 21h18',
  },
];
