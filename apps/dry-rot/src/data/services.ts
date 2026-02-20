/**
 * Service pages data for dry-rot site
 * Automatically generated from markdown files in generated_content/
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { marked } from 'marked';

export interface ServicePageSection {
  title: string;
  content: string;
}

export interface ServicePageData {
  name: string;
  slug: string;
  location: 'portland' | 'seattle';
  locationFull: string;
  heroHeadline: string;
  heroSubheadline: string;
  keyBenefits: string[];
  sections: {
    overview?: ServicePageSection;
    process?: ServicePageSection;
    whyChooseUs?: ServicePageSection;
    serviceAreas?: ServicePageSection;
    pricing?: ServicePageSection;
    faq?: ServicePageSection;
    localConsiderations?: ServicePageSection;
    technicalDetails?: ServicePageSection;
  };
  faqs: Array<{
    question: string;
    answer: string;
  }>;
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  rawMarkdown: string;
  htmlContent: string;
}

/**
 * Parse markdown file and extract structured data
 */
function parseServiceMarkdown(filePath: string, fileName: string): ServicePageData | null {
  try {
    const content = readFileSync(filePath, 'utf-8');

    // Extract location from filename
    const locationMatch = fileName.match(/_(portland|seattle)\.md$/);
    if (!locationMatch) return null;

    const location = locationMatch[1] as 'portland' | 'seattle';
    const locationFull = location === 'portland' ? 'Portland, Oregon' : 'Seattle, Washington';

    // Extract service name from filename
    const serviceNameRaw = fileName
      .replace('service_page_', '')
      .replace(`_${location}.md`, '')
      .replace(/_/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/ and /g, ' & ');

    // Title case the service name
    const serviceName = serviceNameRaw
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    // Create URL-friendly slug
    const slug = serviceNameRaw
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9-]/g, '');

    // Parse sections
    const sections = content.split(/^##\s+/m).slice(1);
    const parsedSections: ServicePageData['sections'] = {};
    const faqs: Array<{ question: string; answer: string }> = [];

    let heroHeadline = serviceName;
    let heroSubheadline = '';
    let keyBenefits: string[] = [];

    sections.forEach((section) => {
      const lines = section.split('\n');
      const sectionTitle = lines[0].trim();
      const sectionContent = lines.slice(1).join('\n').trim();

      // Extract hero section data
      if (sectionTitle.toLowerCase().includes('hero')) {
        const headlineMatch = sectionContent.match(/###\s+(.+)/);
        if (headlineMatch) {
          heroHeadline = headlineMatch[1].replace(/\*\*/g, '');
        }

        // Extract first paragraph as subheadline
        const paragraphs = sectionContent.split('\n\n');
        for (const para of paragraphs) {
          if (!para.startsWith('#') && !para.startsWith('**Key Benefits:**') && para.trim()) {
            heroSubheadline = para.replace(/\*\*/g, '').trim();
            break;
          }
        }

        // Extract key benefits
        const benefitsMatch = sectionContent.match(/\*\*Key Benefits:\*\*([\s\S]*?)(?=\n\n\*\*|$)/);
        if (benefitsMatch) {
          keyBenefits = benefitsMatch[1]
            .split('\n')
            .filter(line => line.trim().startsWith('-'))
            .map(line => line.replace(/^-\s+\*\*([^:]+):\*\*\s*/, '').trim());
        }
      }

      // Extract FAQ section
      if (sectionTitle.toLowerCase().includes('faq')) {
        const faqMatches = sectionContent.matchAll(/###?\s+\d*\.?\s*(.+?)\n(.+?)(?=\n###?\s+\d*\.?\s+|$)/gs);
        for (const match of faqMatches) {
          faqs.push({
            question: match[1].trim(),
            answer: match[2].trim(),
          });
        }

        parsedSections.faq = {
          title: sectionTitle,
          content: sectionContent,
        };
      }

      // Map other sections
      if (sectionTitle.toLowerCase().includes('service overview')) {
        parsedSections.overview = { title: sectionTitle, content: sectionContent };
      } else if (sectionTitle.toLowerCase().includes('our process')) {
        parsedSections.process = { title: sectionTitle, content: sectionContent };
      } else if (sectionTitle.toLowerCase().includes('why choose us')) {
        parsedSections.whyChooseUs = { title: sectionTitle, content: sectionContent };
      } else if (sectionTitle.toLowerCase().includes('service areas')) {
        parsedSections.serviceAreas = { title: sectionTitle, content: sectionContent };
      } else if (sectionTitle.toLowerCase().includes('pricing')) {
        parsedSections.pricing = { title: sectionTitle, content: sectionContent };
      } else if (sectionTitle.toLowerCase().includes('local considerations')) {
        parsedSections.localConsiderations = { title: sectionTitle, content: sectionContent };
      } else if (sectionTitle.toLowerCase().includes('technical details')) {
        parsedSections.technicalDetails = { title: sectionTitle, content: sectionContent };
      }
    });

    // Convert markdown to HTML
    const htmlContent = marked.parse(content) as string;

    // Create meta title and description
    const metaTitle = `${serviceName} in ${locationFull} | Expert Services`;
    const metaDescription = heroSubheadline.substring(0, 155) ||
      `Professional ${serviceName.toLowerCase()} in ${locationFull}. Expert craftsmanship, quality materials, and exceptional customer service.`;

    // Extract keywords from metadata at bottom of file
    const keywordsMatch = content.match(/\*\*Target Keywords:\*\*\s+(.+)/);
    const keywords = keywordsMatch
      ? keywordsMatch[1].split(',').map(k => k.trim())
      : [serviceName.toLowerCase(), location];

    return {
      name: serviceName,
      slug,
      location,
      locationFull,
      heroHeadline,
      heroSubheadline,
      keyBenefits,
      sections: parsedSections,
      faqs,
      metaTitle,
      metaDescription,
      keywords,
      rawMarkdown: content,
      htmlContent,
    };
  } catch (error) {
    console.error(`Error parsing ${fileName}:`, error);
    return null;
  }
}

/**
 * Load all service pages from markdown files
 */
function loadServicePages(): ServicePageData[] {
  const contentDir = join(process.cwd(), 'src', 'data', 'generated_content');
  const files = readdirSync(contentDir);

  const services: ServicePageData[] = [];

  for (const file of files) {
    // Skip non-service-page files and checkpoint files
    if (!file.startsWith('service_page_') || !file.endsWith('.md') || file.includes('.ipynb_checkpoints')) {
      continue;
    }

    const filePath = join(contentDir, file);
    const serviceData = parseServiceMarkdown(filePath, file);

    if (serviceData) {
      services.push(serviceData);
    }
  }

  // Sort by location then name
  services.sort((a, b) => {
    if (a.location !== b.location) {
      return a.location.localeCompare(b.location);
    }
    return a.name.localeCompare(b.name);
  });

  return services;
}

// Export all services
export const allServices = loadServicePages();

// Export services by location
export const servicesByLocation = {
  portland: allServices.filter(s => s.location === 'portland'),
  seattle: allServices.filter(s => s.location === 'seattle'),
};

// Helper function to get service by slug and location
export function getService(location: string, slug: string): ServicePageData | undefined {
  return allServices.find(s => s.location === location && s.slug === slug);
}

// Helper function to get all service paths for static generation
export function getServicePaths() {
  return allServices.map(service => ({
    params: {
      location: service.location,
      service: service.slug,
    },
  }));
}
