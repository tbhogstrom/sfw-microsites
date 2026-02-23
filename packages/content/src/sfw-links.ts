/**
 * SFW Construction Interlinking Data
 * URLs and anchor text options for linking from microsites to SFW Construction
 */

export interface SFWLink {
  url: string;
  currentAnchor: string;
  broadMatchAnchor: string;
  naturalOption1: string;
  naturalOption2: string;
  relevantTopics: string[]; // Topics that should link to this page
}

export const sfwLinks: SFWLink[] = [
  {
    url: 'https://sfwconstruction.com/',
    currentAnchor: 'Exterior Home Repair & Construction Services',
    broadMatchAnchor: 'Exterior Home Repair Contractor in Portland & Seattle',
    naturalOption1: 'our exterior renovation services',
    naturalOption2: 'professional exterior repair team',
    relevantTopics: ['general', 'about', 'company', 'services-overview'],
  },
  {
    url: 'https://sfwconstruction.com/siding-calculator/',
    currentAnchor: 'Siding Cost Calculator',
    broadMatchAnchor: 'Siding Replacement Cost Calculator',
    naturalOption1: 'estimate your siding project cost',
    naturalOption2: 'get a siding price estimate',
    relevantTopics: ['siding', 'cost', 'pricing', 'budget'],
  },
  {
    url: 'https://sfwconstruction.com/siding-repair/',
    currentAnchor: 'Siding Repair Services',
    broadMatchAnchor: 'Professional Siding Repair Contractor',
    naturalOption1: 'fix damaged siding',
    naturalOption2: 'help with siding issues',
    relevantTopics: ['siding', 'exterior', 'repair'],
  },
  {
    url: 'https://sfwconstruction.com/repair-services/dry-rot-repair/',
    currentAnchor: 'Dry Rot Repair Services',
    broadMatchAnchor: 'Dry Rot Repair Contractor',
    naturalOption1: 'repair wood rot damage',
    naturalOption2: 'fix dry rot around your home',
    relevantTopics: ['dry-rot', 'rot', 'wood-damage', 'moisture'],
  },
  {
    url: 'https://sfwconstruction.com/repair-services/window-installation-portland/',
    currentAnchor: 'Window Installation in Portland',
    broadMatchAnchor: 'Portland Window Installation Contractor',
    naturalOption1: 'upgrade your home\'s windows',
    naturalOption2: 'install new energy-efficient windows',
    relevantTopics: ['windows', 'leaks', 'portland', 'installation'],
  },
  {
    url: 'https://sfwconstruction.com/locations/portland/',
    currentAnchor: 'Portland Exterior Contractor',
    broadMatchAnchor: 'Portland Exterior Home Repair Contractor',
    naturalOption1: 'our Portland service area',
    naturalOption2: 'exterior services in Portland',
    relevantTopics: ['portland', 'location'],
  },
  {
    url: 'https://sfwconstruction.com/mold-removal-and-testing/',
    currentAnchor: 'Mold Removal & Testing Services',
    broadMatchAnchor: 'Professional Mold Remediation Services',
    naturalOption1: 'remove mold safely',
    naturalOption2: 'schedule mold testing',
    relevantTopics: ['mold', 'moisture', 'water-damage', 'crawlspace'],
  },
  {
    url: 'https://sfwconstruction.com/contact-us/',
    currentAnchor: 'Contact SFW Construction',
    broadMatchAnchor: 'Contact Our Exterior Repair Team',
    naturalOption1: 'request a consultation',
    naturalOption2: 'get in touch with us',
    relevantTopics: ['contact', 'quote', 'consultation'],
  },
  {
    url: 'https://sfwconstruction.com/locations/seattle/',
    currentAnchor: 'Seattle Exterior Contractor',
    broadMatchAnchor: 'Seattle Exterior Home Repair Contractor',
    naturalOption1: 'our Seattle service area',
    naturalOption2: 'exterior services in Seattle',
    relevantTopics: ['seattle', 'location'],
  },
  {
    url: 'https://sfwconstruction.com/repair-services/portland-deck-repair/',
    currentAnchor: 'Portland Deck Repair Services',
    broadMatchAnchor: 'Deck Repair Contractor in Portland',
    naturalOption1: 'restore your deck',
    naturalOption2: 'repair structural deck damage',
    relevantTopics: ['deck', 'portland', 'structural'],
  },
  {
    url: 'https://sfwconstruction.com/locations/portland/house-painting-portland/lead-based-paint-removal/',
    currentAnchor: 'Lead-Based Paint Removal in Portland',
    broadMatchAnchor: 'Portland Lead Paint Removal Contractor',
    naturalOption1: 'safely remove lead paint',
    naturalOption2: 'certified lead paint removal services',
    relevantTopics: ['lead-paint', 'portland', 'safety', 'historic'],
  },
  {
    url: 'https://sfwconstruction.com/repair-services/roof-repair-flat-roof-repair/',
    currentAnchor: 'Roof & Flat Roof Repair Services',
    broadMatchAnchor: 'Roof Repair and Flat Roof Repair Contractor',
    naturalOption1: 'fix roof leaks',
    naturalOption2: 'repair flat roofing systems',
    relevantTopics: ['roof', 'leaks', 'flashing', 'chimney'],
  },
  {
    url: 'https://sfwconstruction.com/repair-services/crawl-space-repair-portland/',
    currentAnchor: 'Crawl Space Repair in Portland',
    broadMatchAnchor: 'Portland Crawl Space Repair Contractor',
    naturalOption1: 'fix moisture issues in your crawl space',
    naturalOption2: 'crawl space structural repairs',
    relevantTopics: ['crawlspace', 'portland', 'moisture', 'foundation'],
  },
  {
    url: 'https://sfwconstruction.com/repair-services/construction-defect-repair-portland/',
    currentAnchor: 'Construction Defect Repair in Portland',
    broadMatchAnchor: 'Portland Construction Defect Repair Contractor',
    naturalOption1: 'repair construction defects',
    naturalOption2: 'fix builder-related damage',
    relevantTopics: ['defects', 'portland', 'warranty', 'structural'],
  },
  {
    url: 'https://sfwconstruction.com/chimney-chase-repair/',
    currentAnchor: 'Chimney Chase Repair Services',
    broadMatchAnchor: 'Chimney Chase Repair Contractor',
    naturalOption1: 'repair chimney siding and framing',
    naturalOption2: 'fix chimney chase damage',
    relevantTopics: ['chimney', 'chase', 'framing', 'siding'],
  },
  {
    url: 'https://sfwconstruction.com/exterior-home-repair/',
    currentAnchor: 'Exterior Home Repair Services',
    broadMatchAnchor: 'Exterior Home Repair Contractor',
    naturalOption1: 'repair exterior home damage',
    naturalOption2: 'complete exterior repair solutions',
    relevantTopics: ['exterior', 'general', 'comprehensive'],
  },
  {
    url: 'https://sfwconstruction.com/locations/tualatin-siding-contractor/',
    currentAnchor: 'Tualatin Siding Contractor',
    broadMatchAnchor: 'Siding Contractor in Tualatin OR',
    naturalOption1: 'siding services in Tualatin',
    naturalOption2: 'repair or replace siding in Tualatin',
    relevantTopics: ['tualatin', 'siding', 'location'],
  },
  {
    url: 'https://sfwconstruction.com/how-much-is-it-going-to-cost-to-fix-my-leaking-window/',
    currentAnchor: 'Leaking Window Repair Cost Guide',
    broadMatchAnchor: 'Cost to Repair a Leaking Window',
    naturalOption1: 'how much window repair costs',
    naturalOption2: 'what it costs to fix a leaking window',
    relevantTopics: ['windows', 'leaks', 'cost', 'pricing'],
  },
  {
    url: 'https://sfwconstruction.com/locations/renton/',
    currentAnchor: 'Renton Exterior Contractor',
    broadMatchAnchor: 'Renton Exterior Home Repair Contractor',
    naturalOption1: 'exterior services in Renton',
    naturalOption2: 'home repair services in Renton',
    relevantTopics: ['renton', 'seattle', 'location'],
  },
  {
    url: 'https://sfwconstruction.com/siding-contractor/about/',
    currentAnchor: 'About Our Siding Contractor Team',
    broadMatchAnchor: 'About Our Siding Repair Company',
    naturalOption1: 'learn more about our team',
    naturalOption2: 'meet our siding experts',
    relevantTopics: ['about', 'team', 'company', 'siding'],
  },
];

/**
 * Get relevant SFW links based on content topics
 */
export function getRelevantSFWLinks(topics: string[], maxLinks: number = 2): SFWLink[] {
  const scoredLinks = sfwLinks.map(link => {
    const score = link.relevantTopics.filter(topic =>
      topics.some(t => t.toLowerCase().includes(topic.toLowerCase()) || topic.toLowerCase().includes(t.toLowerCase()))
    ).length;
    return { link, score };
  });

  return scoredLinks
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxLinks)
    .map(item => item.link);
}

/**
 * Get a random natural anchor text for a link
 */
export function getRandomAnchor(link: SFWLink): string {
  const options = [
    link.naturalOption1,
    link.naturalOption2,
  ];
  return options[Math.floor(Math.random() * options.length)];
}
