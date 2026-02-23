#!/usr/bin/env node

/**
 * Interlinking Suggestion Tool
 * Analyzes content and suggests contextual internal links
 */

const fs = require('fs');
const path = require('path');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

// Load data files
const sfwLinks = require('./sfw-links.json');
const micrositeRelationships = require('./microsite-relationships.json');
const config = require('./config.json');

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .option('microsite', {
    alias: 'm',
    type: 'string',
    description: 'Microsite slug (e.g., deck-repair)',
  })
  .option('file', {
    alias: 'f',
    type: 'string',
    description: 'Path to specific content file',
  })
  .option('all', {
    alias: 'a',
    type: 'boolean',
    description: 'Analyze all microsites',
  })
  .option('output', {
    alias: 'o',
    type: 'string',
    description: 'Output file for suggestions',
    default: 'link-suggestions.json',
  })
  .help()
  .argv;

/**
 * Extract keywords from content
 */
function extractKeywords(content) {
  const keywords = new Set();

  // Convert to lowercase for matching
  const lowerContent = content.toLowerCase();

  // Extract common topic keywords
  const topicPatterns = [
    /\b(deck|decking|decks)\b/g,
    /\b(siding|hardie|vinyl|fiber cement)\b/g,
    /\b(rot|rotted|rotting|decay|fungus)\b/g,
    /\b(crawl\s?space|crawlspace|foundation)\b/g,
    /\b(chimney|chase|flue)\b/g,
    /\b(window|windows|leak|leaking)\b/g,
    /\b(flashing|waterproof|moisture)\b/g,
    /\b(trim|fascia|soffit|frieze)\b/g,
    /\b(beam|joist|framing|structural)\b/g,
    /\b(lead\s?paint|historic|restoration)\b/g,
    /\b(portland|seattle|oregon|washington)\b/g,
    /\b(cost|pricing|estimate|budget)\b/g,
    /\b(repair|fix|replace|restore)\b/g,
  ];

  topicPatterns.forEach(pattern => {
    const matches = lowerContent.match(pattern);
    if (matches) {
      matches.forEach(match => keywords.add(match.trim().replace(/\s+/g, '-')));
    }
  });

  return Array.from(keywords);
}

/**
 * Score SFW links based on content relevance
 */
function scoreSFWLinks(keywords) {
  return sfwLinks.map(link => {
    let score = 0;

    // Check how many keywords match this link's topics
    keywords.forEach(keyword => {
      if (link.topics.some(topic =>
        keyword.includes(topic) || topic.includes(keyword)
      )) {
        score++;
      }
    });

    return { link, score };
  })
  .filter(item => item.score > 0)
  .sort((a, b) => b.score - a.score);
}

/**
 * Get related microsite suggestions
 */
function getMicrositeSuggestions(micrositeSlug, keywords) {
  const microsite = micrositeRelationships[micrositeSlug];
  if (!microsite || !microsite.relatedServices) return [];

  return microsite.relatedServices.map(related => {
    let score = 0;

    // Score based on keyword relevance
    keywords.forEach(keyword => {
      if (related.reason.includes(keyword) || keyword.includes(related.reason)) {
        score++;
      }
    });

    return { ...related, score };
  })
  .filter(item => item.score > 0 || micrositeRelationships[micrositeSlug].relatedServices.length <= 3)
  .sort((a, b) => b.score - a.score);
}

/**
 * Analyze content and generate suggestions
 */
function analyzContent(content, micrositeSlug) {
  const keywords = extractKeywords(content);

  // Get SFW link suggestions
  const sfwSuggestions = scoreSFWLinks(keywords)
    .slice(0, config.linkTypes.sfw);

  // Get microsite cross-link suggestions
  const micrositeSuggestions = getMicrositeSuggestions(micrositeSlug, keywords)
    .slice(0, config.linkTypes.microsite);

  return {
    keywords,
    sfwLinks: sfwSuggestions.map(item => ({
      url: item.link.url,
      anchorOptions: [
        item.link.naturalOption1,
        item.link.naturalOption2,
        item.link.currentAnchor,
      ],
      relevanceScore: item.score,
      topics: item.link.topics,
    })),
    micrositeLinks: micrositeSuggestions.map(item => {
      const relatedMicrosite = micrositeRelationships[item.slug];
      return {
        name: relatedMicrosite?.name || item.slug,
        domain: relatedMicrosite?.domain || `https://${item.slug}.com`,
        anchorOptions: item.anchorOptions,
        reason: item.reason,
        relevanceScore: item.score,
      };
    }),
  };
}

/**
 * Main execution
 */
function main() {
  console.log('🔗 SFW Interlinking Tool\n');

  if (argv.file) {
    // Analyze specific file
    console.log(`Analyzing file: ${argv.file}`);
    const content = fs.readFileSync(argv.file, 'utf-8');
    const micrositeSlug = path.dirname(argv.file).match(/apps\/([^\/]+)/)?.[1] || 'unknown';

    const suggestions = analyzeContent(content, micrositeSlug);
    console.log('\n📊 Suggestions:\n');
    console.log(JSON.stringify(suggestions, null, 2));

  } else if (argv.microsite) {
    // Analyze all content for a microsite
    console.log(`Analyzing microsite: ${argv.microsite}`);
    console.log('(Feature coming soon - analyze all blog posts)');

  } else if (argv.all) {
    // Analyze all microsites
    console.log('Analyzing all microsites...');
    console.log('(Feature coming soon - generate full report)');

  } else {
    console.log('Please specify --file, --microsite, or --all');
    console.log('Run with --help for usage information');
  }
}

// Run the tool
if (require.main === module) {
  main();
}

module.exports = { analyzeContent, extractKeywords, scoreSFWLinks };
