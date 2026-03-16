import { parseStringPromise } from 'xml2js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Validate that a URL is HTTP or HTTPS
 * @param {string} url
 * @returns {boolean}
 */
export function validateUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Extract URLs from a sitemap XML string
 * @param {string} xmlString
 * @returns {Promise<string[]>}
 */
export async function normalizeSitemap(xmlString) {
  try {
    const parsed = await parseStringPromise(xmlString);
    const urlset = parsed.urlset?.url || [];
    return urlset.map(item => item.loc?.[0] || '').filter(Boolean);
  } catch (err) {
    throw new Error(`Failed to parse sitemap XML: ${err.message}`);
  }
}

/**
 * Extract URLs from a single URL, array, file, or sitemap
 * @param {string|string[]} target - URL, array of URLs, file path, or sitemap URL
 * @returns {Promise<string[]>} - Deduplicated array of valid URLs
 */
export async function extractUrls(target) {
  let urls = [];

  // Handle array input
  if (Array.isArray(target)) {
    urls = target;
  }
  // Handle single URL or file path
  else if (typeof target === 'string') {
    // Try as URL first
    if (validateUrl(target)) {
      // Check if it's a sitemap URL
      if (target.includes('sitemap')) {
        try {
          const response = await fetch(target, { timeout: 30000 });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const xmlText = await response.text();
          urls = await normalizeSitemap(xmlText);
        } catch (err) {
          throw new Error(`Failed to fetch sitemap from ${target}: ${err.message}`);
        }
      } else {
        // Single URL
        urls = [target];
      }
    }
    // Try as file path
    else {
      try {
        const content = await fs.readFile(target, 'utf-8');
        urls = content
          .split('\n')
          .map(line => line.trim())
          .filter(line => line && validateUrl(line));
      } catch (err) {
        throw new Error(`Failed to read file or parse URL from ${target}: ${err.message}`);
      }
    }
  }

  // Validate and deduplicate
  const validUrls = [...new Set(urls.filter(validateUrl))];
  return validUrls;
}
