/**
 * DBA Companies and Domains
 * Central registry of all SFW Construction DBAs and their domains
 */

export interface DBA {
  name: string;
  domain: string;
  type: 'microsite' | 'wordpress' | 'astro-single';
  slug?: string; // For microsites only
}

export const dbas: DBA[] = [
  // Microsites (Astro multi-tenant)
  {
    name: 'Chimney Repair Experts',
    domain: 'https://woodchimneyrepair.com',
    type: 'microsite',
    slug: 'chimney-repair',
  },
  {
    name: 'Siding Repair Experts',
    domain: 'https://sidingrepairexperts.com',
    type: 'microsite',
    slug: 'siding-repair',
  },
  {
    name: 'Crawlspace Repair Experts',
    domain: 'https://crawlspacerot.com',
    type: 'microsite',
    slug: 'crawlspace-rot',
  },
  {
    name: 'Window Leak Experts',
    domain: 'https://leakingwindow.com',
    type: 'microsite',
    slug: 'leak-repair',
  },
  {
    name: 'Lead Paint Removal Experts',
    domain: 'https://leadpaintprofessionals.com',
    type: 'microsite',
    slug: 'lead-paint',
  },
  {
    name: 'Flashing Repair Experts',
    domain: 'https://flashingrepairs.com',
    type: 'microsite',
    slug: 'flashing-repair',
  },
  {
    name: 'Exterior Trim Repair Experts',
    domain: 'https://exteriortrimrepairs.com',
    type: 'microsite',
    slug: 'trim-repair',
  },
  {
    name: 'Historic Home Restoration Experts',
    domain: 'https://historicrenovationsnw.com',
    type: 'microsite',
    slug: 'restoration',
  },
  {
    name: 'Beam Repair Experts',
    domain: 'https://beamrepairexpert.com',
    type: 'microsite',
    slug: 'beam-repair',
  },
  {
    name: 'Deck Repair Experts',
    domain: 'https://deckrepairexpert.com',
    type: 'microsite',
    slug: 'deck-repair',
  },
  {
    name: 'Dry Rot Repair Experts',
    domain: '', // TBD
    type: 'microsite',
    slug: 'dry-rot',
  },

  // Non-microsites (Standalone sites)
  {
    name: 'Rot Repair Experts - Portland',
    domain: 'https://rotrepairportland.com',
    type: 'wordpress',
  },
  {
    name: 'Rot Repair Experts - Seattle',
    domain: 'https://rotrepairseattle.com',
    type: 'wordpress',
  },
];

/**
 * Get all microsites only
 */
export const microsites = dbas.filter((dba) => dba.type === 'microsite');

/**
 * Get DBA by slug
 */
export function getDBABySlug(slug: string): DBA | undefined {
  return dbas.find((dba) => dba.slug === slug);
}

/**
 * Get all DBAs with domains (exclude those without domains)
 */
export const dbasWithDomains = dbas.filter((dba) => dba.domain);
