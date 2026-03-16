/**
 * Cluster service page loader.
 * Reads service_page_cluster_* markdown files and returns stub ServicePageData objects.
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import type { ServicePageData } from './services';

const SITE_KEY = 'flashing-repair'; // Set per app

function parseClusterMeta(content: string): Record<string, string> | null {
  const match = content.match(/<!--\s*CLUSTER_META\s*([\s\S]*?)-->/);
  if (!match) return null;
  const meta: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const val = line.slice(colonIdx + 1).trim();
    if (key && val && !key.startsWith('-')) meta[key] = val;
  }
  return meta;
}

function parseSubtopics(content: string): string[] {
  const match = content.match(/<!--\s*CLUSTER_META[\s\S]*?subtopics:\s*([\s\S]*?)-->/);
  if (!match) return [];
  return match[1]
    .split('\n')
    .filter(l => l.trim().startsWith('- '))
    .map(l => l.replace(/^\s*-\s*/, '').trim());
}

function loadClusterPages(): ServicePageData[] {
  const contentDir = join(process.cwd(), 'src', 'data', 'generated_content');
  let files: string[];
  try {
    files = readdirSync(contentDir).filter(
      f => f.startsWith('service_page_cluster_') && f.endsWith('.md')
    );
  } catch {
    return [];
  }

  const pages: ServicePageData[] = [];

  for (const file of files) {
    const content = readFileSync(join(contentDir, file), 'utf-8');
    const meta = parseClusterMeta(content);
    if (!meta) continue;

    const location = meta['location'] as 'portland' | 'seattle';
    if (location !== 'portland' && location !== 'seattle') continue;
    const locationFull = location === 'portland' ? 'Portland, Oregon' : 'Seattle, Washington';
    const slug = meta['cluster_slug'];
    if (!slug) continue;
    const subtopics = parseSubtopics(content);

    // Extract name from first H1
    const nameMatch = content.match(/^#\s+(.+?)\s+-\s+/m);
    const name = nameMatch ? nameMatch[1].trim() : slug;

    pages.push({
      name,
      slug,
      location,
      locationFull,
      heroHeadline: `[STUB] ${name} in ${locationFull}`,
      heroSubheadline: `Professional ${name.toLowerCase()} services in ${locationFull}. Content coming soon.`,
      keyBenefits: subtopics.slice(0, 4),
      sections: {},
      faqs: [],
      metaTitle: `${name} in ${locationFull} | Flashing Repair Experts`,
      metaDescription: `Professional ${name.toLowerCase()} services in ${locationFull}. Expert craftsmanship and quality materials.`,
      keywords: [slug, location, SITE_KEY],
      rawMarkdown: content,
      htmlContent: `<h1>${name}</h1><p>Content coming soon.</p>`,
    });
  }

  return pages;
}

export const allClusterServices = loadClusterPages();

export function getClusterService(location: string, slug: string): ServicePageData | undefined {
  return allClusterServices.find(s => s.location === location && s.slug === slug);
}

export function getClusterPaths() {
  return allClusterServices.map(s => ({
    params: { location: s.location, service: s.slug },
  }));
}
