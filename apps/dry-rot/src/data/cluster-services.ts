/**
 * Cluster service page loader.
 * Reads service_page_cluster_* markdown files and returns parsed ServicePageData objects.
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import type { ServicePageData } from './services';

const SITE_KEY = 'dry-rot';

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
    .filter((line) => line.trim().startsWith('- '))
    .map((line) => line.replace(/^\s*-\s*/, '').trim());
}

function extractFirstSentence(text: string): string {
  const clean = text.replace(/<sup>\d+<\/sup>/g, '').replace(/\*\*/g, '');
  const match = clean.match(/^.+?[.!?](?:\s|$)/);
  return match ? match[0].trim() : clean.slice(0, 120).trim();
}

function isPlaceholderContent(text: string): boolean {
  const normalized = text.replace(/\*\*/g, '').trim().toLowerCase();
  return normalized === '*content to be generated.*' || normalized === 'content to be generated.';
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function parseClusterSections(
  content: string,
  subtopics: string[]
): Array<{ heading: string; anchor: string; content: string }> {
  const sections: Array<{ heading: string; anchor: string; content: string }> = [];

  for (const topic of subtopics) {
    const escaped = topic.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = content.match(new RegExp(`## ${escaped}\n([\\s\\S]*?)(?=\n## |$)`));
    if (!match) continue;
    const body = match[1].trim();
    if (!body || isPlaceholderContent(body)) continue;
    sections.push({ heading: topic, anchor: slugify(topic), content: body });
  }

  return sections;
}

function parseReferences(content: string): string {
  const match = content.match(/## References\n\n([\s\S]*?)(?=\n## |$)/);
  return match ? match[1].trim() : '';
}

function parseSubtopicDescriptors(
  content: string,
  subtopics: string[]
): Array<{ heading: string; anchor: string; descriptor: string }> {
  return subtopics.map((topic) => {
    const escaped = topic.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = content.match(new RegExp(`## ${escaped}\n([\\s\\S]*?)(?=\n## |$)`));
    const body = match ? match[1].trim() : '';
    const descriptor = body && !isPlaceholderContent(body)
      ? extractFirstSentence(body)
      : '';
    return { heading: topic, anchor: slugify(topic), descriptor };
  });
}

function extractBodyContent(content: string): string {
  return content
    .replace(/^#\s+.+\n/m, '')
    .replace(/<!--\s*CLUSTER_META[\s\S]*?-->\n?/, '')
    .replace(/## Hero Section[\s\S]*?(?=\n## |\n$)/, '')
    .replace(/## Page Metadata[\s\S]*$/, '')
    .trim();
}

function extractHeroSubheadline(content: string, name: string): string {
  // Extract only the Hero Section block (up to the next ## heading)
  const heroBlock = content.match(/## Hero Section\n([\s\S]*?)(?=\n## )/);
  if (heroBlock) {
    const lines = heroBlock[1].split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('#'));
    for (const line of lines) {
      if (!isPlaceholderContent(line)) return line;
    }
  }
  return `Expert ${name.toLowerCase()} services for Portland and Seattle homeowners backed by local knowledge and quality craftsmanship.`;
}

function loadClusterPages(): ServicePageData[] {
  const contentDir = join(process.cwd(), 'src', 'data', 'generated_content');
  let files: string[];
  try {
    files = readdirSync(contentDir).filter(
      (file) => file.startsWith('service_page_cluster_') && file.endsWith('.md')
    );
  } catch {
    return [];
  }

  const pages: ServicePageData[] = [];

  for (const file of files) {
    const content = readFileSync(join(contentDir, file), 'utf-8').replace(/\r\n/g, '\n');
    const meta = parseClusterMeta(content);
    if (!meta) continue;

    const location = meta['location'] as 'portland' | 'seattle';
    if (location !== 'portland' && location !== 'seattle') continue;
    const locationFull = location === 'portland' ? 'Portland, Oregon' : 'Seattle, Washington';
    const slug = meta['cluster_slug'];
    if (!slug) continue;
    const subtopics = parseSubtopics(content);

    const nameMatch = content.match(/^#\s+(.+?)\s+-\s+/m);
    const name = nameMatch ? nameMatch[1].trim() : slug;

    const isStub = meta['status']?.toLowerCase() === 'stub';
    const bodyContent = extractBodyContent(content);
    const clusterSections = parseClusterSections(content, subtopics);
    const clusterReferences = parseReferences(content);

    pages.push({
      name,
      slug,
      location,
      locationFull,
      heroHeadline: `${name} in ${locationFull}`,
      heroSubheadline: isStub
        ? `Professional ${name.toLowerCase()} services in ${locationFull}. Content coming soon.`
        : extractHeroSubheadline(content, name),
      keyBenefits: subtopics.slice(0, 4),
      sections: bodyContent ? { overview: { title: name, content: bodyContent } } : {},
      faqs: [],
      metaTitle: `${name} in ${locationFull} | Rot Repair Experts`,
      metaDescription: `Professional ${name.toLowerCase()} services in ${locationFull}. Expert craftsmanship and quality materials.`,
      keywords: [slug, location, SITE_KEY],
      rawMarkdown: content,
      htmlContent: bodyContent,
      clusterSections: clusterSections.length ? clusterSections : undefined,
      clusterReferences: clusterReferences || undefined,
      subtopicDescriptors: parseSubtopicDescriptors(content, subtopics),
    });
  }

  return pages;
}

export const allClusterServices = loadClusterPages();

export function getClusterService(location: string, slug: string): ServicePageData | undefined {
  return allClusterServices.find((service) => service.location === location && service.slug === slug);
}

export function getClusterPaths() {
  return allClusterServices.map((service) => ({
    params: { location: service.location, service: service.slug },
  }));
}
