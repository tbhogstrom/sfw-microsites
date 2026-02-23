#!/usr/bin/env node

/**
 * DBA Cross-Linking Tool
 * Adds links between microsite homepages for related services
 */

const fs = require('fs');
const path = require('path');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const chalk = require('chalk');
const inquirer = require('inquirer');
const ora = require('ora');
const boxen = require('boxen');
const Table = require('cli-table3');

// Load data files
const dbaLinks = require('./dba-links.json');
const config = require('./config.json');

// Links tracking file
const LINKS_TRACKING_FILE = path.join(__dirname, 'dba-links-added.json');

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .option('file', {
    alias: 'f',
    type: 'string',
    description: 'Path to specific content file',
  })
  .option('microsite', {
    alias: 'm',
    type: 'string',
    description: 'Microsite slug for batch processing',
  })
  .option('batch', {
    alias: 'b',
    type: 'boolean',
    description: 'Process multiple files automatically',
  })
  .help()
  .argv;

/**
 * Load or initialize link tracking data
 */
function loadLinkTracking() {
  if (fs.existsSync(LINKS_TRACKING_FILE)) {
    return JSON.parse(fs.readFileSync(LINKS_TRACKING_FILE, 'utf-8'));
  }
  return { links: [], totalLinks: 0 };
}

/**
 * Save link tracking data
 */
function saveLinkTracking(data) {
  fs.writeFileSync(LINKS_TRACKING_FILE, JSON.stringify(data, null, 2));
}

/**
 * Calculate link usage percentage
 */
function getLinkUsagePercentage(url, trackingData) {
  if (trackingData.totalLinks === 0) return 0;
  const usageCount = trackingData.links.filter(link => link.url === url).length;
  return (usageCount / trackingData.totalLinks) * 100;
}

/**
 * Extract keywords from content
 */
function extractKeywords(content) {
  const keywords = new Set();
  const lowerContent = content.toLowerCase();

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
 * Score and filter DBA links based on usage
 */
function scoreDBALinks(keywords, currentMicrosite, trackingData) {
  return dbaLinks
    .filter(link => link.slug !== currentMicrosite) // Don't link to yourself
    .map(link => {
      let score = 0;
      keywords.forEach(keyword => {
        if (link.topics.some(topic =>
          keyword.includes(topic) || topic.includes(keyword)
        )) {
          score++;
        }
      });

      const usagePercentage = getLinkUsagePercentage(link.url, trackingData);

      return { link, score, usagePercentage };
    })
    .filter(item => item.score > 0 && item.usagePercentage < 25) // Filter overused links (25% threshold for DBA cross-links)
    .sort((a, b) => {
      // Sort by score first, then by usage (prefer less used)
      if (b.score !== a.score) return b.score - a.score;
      return a.usagePercentage - b.usagePercentage;
    });
}

/**
 * Find best location to insert link
 */
function findInsertionPoint(content, keywords) {
  const lines = content.split('\n');

  // Look for paragraphs that contain relevant keywords
  const scoredParagraphs = [];
  let currentParagraph = '';
  let lineIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line === '') {
      if (currentParagraph) {
        const score = keywords.filter(kw =>
          currentParagraph.toLowerCase().includes(kw.replace(/-/g, ' '))
        ).length;

        if (score > 0 && currentParagraph.length > 100) {
          scoredParagraphs.push({
            text: currentParagraph,
            lineIndex,
            score
          });
        }
        currentParagraph = '';
      }
    } else if (!line.startsWith('#') && !line.startsWith('-') && !line.startsWith('*')) {
      if (!currentParagraph) lineIndex = i;
      currentParagraph += (currentParagraph ? ' ' : '') + line;
    }
  }

  if (scoredParagraphs.length === 0) return null;

  // Return paragraph with highest keyword score
  scoredParagraphs.sort((a, b) => b.score - a.score);
  return scoredParagraphs[0];
}

/**
 * Insert link into content
 */
function insertLink(content, paragraph, anchorText, url) {
  // Find a good sentence in the paragraph to add the link
  const sentences = paragraph.text.split(/[.!?]+/);
  const relevantSentence = sentences.find(s => s.length > 50 && s.length < 200) || sentences[0];

  // Create the markdown link
  const linkMarkdown = `[${anchorText}](${url})`;

  // Find where to insert in the sentence (try to insert naturally)
  const words = relevantSentence.trim().split(' ');
  const insertPosition = Math.min(Math.floor(words.length * 0.6), words.length - 3);

  // Create new sentence with link
  const linkedSentence = [
    ...words.slice(0, insertPosition),
    'For related services,',
    linkMarkdown,
    'can help.',
    ...words.slice(insertPosition)
  ].join(' ');

  // Replace in content
  return content.replace(relevantSentence, linkedSentence);
}

/**
 * Display link suggestion with context
 */
function displaySuggestion(paragraph, anchorText, url, linkData) {
  console.log('\\n' + boxen(
    chalk.bold.cyan('🔗 DBA Link Suggestion'),
    { padding: 1, margin: 1, borderStyle: 'round', borderColor: 'cyan' }
  ));

  console.log(chalk.bold('📄 Context:'));
  console.log(chalk.gray('─'.repeat(80)));

  // Show paragraph with highlighted anchor
  const highlightedText = paragraph.text.substring(0, 200) + '...';
  console.log(highlightedText);
  console.log(chalk.gray('─'.repeat(80)));

  console.log('\\n' + chalk.bold('🔗 Proposed Link:'));
  console.log(chalk.yellow(`   Anchor: ${anchorText}`));
  console.log(chalk.blue(`   URL: ${url}`));
  console.log(chalk.gray(`   Relevance Score: ${linkData.score}/10`));
  console.log(chalk.gray(`   Current Usage: ${linkData.usagePercentage.toFixed(1)}%`));
}

/**
 * Record link addition
 */
function recordLink(filePath, url, anchorText, trackingData) {
  trackingData.links.push({
    file: filePath,
    url: url,
    urlDestination: url,
    anchorText: anchorText,
    timestamp: new Date().toISOString(),
  });
  trackingData.totalLinks++;
  saveLinkTracking(trackingData);
}

/**
 * Display summary table
 */
function displaySummary(trackingData) {
  console.log('\\n' + boxen(
    chalk.bold.green('✅ Link Addition Summary'),
    { padding: 1, margin: 1, borderStyle: 'round', borderColor: 'green' }
  ));

  const table = new Table({
    head: [
      chalk.cyan('File'),
      chalk.cyan('Anchor Text'),
      chalk.cyan('Destination URL')
    ],
    colWidths: [30, 30, 50],
    wordWrap: true
  });

  trackingData.links.slice(-5).forEach(link => {
    table.push([
      path.basename(link.file),
      chalk.yellow(link.anchorText),
      chalk.blue(link.url)
    ]);
  });

  console.log(table.toString());
  console.log(chalk.gray(`\\nTotal DBA links added: ${trackingData.totalLinks}`));
}

/**
 * Process single file interactively
 */
async function processSingleFile(filePath, micrositeSlug) {
  const spinner = ora('Analyzing content...').start();

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const trackingData = loadLinkTracking();
    const keywords = extractKeywords(content);

    spinner.text = 'Finding relevant DBA links...';
    const scoredLinks = scoreDBALinks(keywords, micrositeSlug, trackingData);

    if (scoredLinks.length === 0) {
      spinner.fail(chalk.red('No suitable DBA links found (all relevant links are overused or self-referential)'));
      return;
    }

    const topLink = scoredLinks[0];
    const anchorText = topLink.link.naturalOption1;

    spinner.text = 'Finding best insertion point...';
    const paragraph = findInsertionPoint(content, keywords);

    if (!paragraph) {
      spinner.fail(chalk.red('Could not find suitable location for link'));
      return;
    }

    spinner.succeed(chalk.green('Analysis complete!'));

    // Display suggestion
    displaySuggestion(paragraph, anchorText, topLink.link.url, topLink);

    // Ask for confirmation
    const { shouldAdd } = await inquirer.prompt([{
      type: 'confirm',
      name: 'shouldAdd',
      message: 'Add this link to the file?',
      default: true,
    }]);

    if (shouldAdd) {
      const addSpinner = ora('Adding link to file...').start();

      const updatedContent = insertLink(content, paragraph, anchorText, topLink.link.url);
      fs.writeFileSync(filePath, updatedContent, 'utf-8');

      recordLink(filePath, topLink.link.url, anchorText, trackingData);

      addSpinner.succeed(chalk.green(`✅ Link added successfully to ${path.basename(filePath)}`));

      displaySummary(trackingData);
    } else {
      console.log(chalk.yellow('⏭️  Link skipped'));
    }

  } catch (error) {
    spinner.fail(chalk.red(`Error: ${error.message}`));
  }
}

/**
 * Find all content files for a microsite
 */
function findContentFiles(micrositeSlug) {
  const glob = require('glob');
  const basePath = path.join(__dirname, '../../apps', micrositeSlug);

  // Find blog posts
  const blogPosts = glob.sync(`${basePath}/src/data/generated_content/*.md`);

  // Find service pages (markdown files in service directories)
  const servicePages = glob.sync(`${basePath}/src/pages/**/*.md`);

  return [...blogPosts, ...servicePages];
}

/**
 * Process single file in batch mode (no confirmation)
 */
async function processBatchFile(filePath, micrositeSlug) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const trackingData = loadLinkTracking();
    const keywords = extractKeywords(content);

    const scoredLinks = scoreDBALinks(keywords, micrositeSlug, trackingData);

    if (scoredLinks.length === 0) {
      return {
        success: false,
        reason: 'No suitable DBA links (all overused or self-referential)',
        file: path.basename(filePath)
      };
    }

    const topLink = scoredLinks[0];
    const anchorText = topLink.link.naturalOption1;
    const paragraph = findInsertionPoint(content, keywords);

    if (!paragraph) {
      return {
        success: false,
        reason: 'No suitable insertion point',
        file: path.basename(filePath)
      };
    }

    // Automatically add the link
    const updatedContent = insertLink(content, paragraph, anchorText, topLink.link.url);
    fs.writeFileSync(filePath, updatedContent, 'utf-8');

    recordLink(filePath, topLink.link.url, anchorText, trackingData);

    return {
      success: true,
      file: path.basename(filePath),
      url: topLink.link.url,
      anchor: anchorText,
      score: topLink.score
    };

  } catch (error) {
    return {
      success: false,
      reason: error.message,
      file: path.basename(filePath)
    };
  }
}

/**
 * Process multiple files in batch mode
 */
async function processBatchFiles(micrositeSlug) {
  console.log(boxen(
    chalk.bold.cyan(`🔗 DBA Batch Processing: ${micrositeSlug}`),
    { padding: 1, margin: 1, borderStyle: 'double', borderColor: 'cyan' }
  ));

  const spinner = ora('Finding content files...').start();

  const files = findContentFiles(micrositeSlug);

  if (files.length === 0) {
    spinner.fail(chalk.red('No content files found'));
    return;
  }

  spinner.succeed(chalk.green(`Found ${files.length} files to process`));

  const results = {
    successful: [],
    failed: []
  };

  // Process each file
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fileName = path.basename(file);

    const processSpinner = ora(`[${i + 1}/${files.length}] ${fileName}`).start();

    const result = await processBatchFile(file, micrositeSlug);

    if (result.success) {
      processSpinner.succeed(chalk.green(`✓ ${fileName}`));
      results.successful.push(result);
    } else {
      processSpinner.warn(chalk.yellow(`⊘ ${fileName} - ${result.reason}`));
      results.failed.push(result);
    }
  }

  // Display summary
  console.log('\\n' + boxen(
    chalk.bold.green('📊 Batch Processing Complete'),
    { padding: 1, margin: 1, borderStyle: 'round', borderColor: 'green' }
  ));

  const table = new Table({
    head: [
      chalk.cyan('Status'),
      chalk.cyan('Count')
    ]
  });

  table.push(
    [chalk.green('✓ Successful'), chalk.bold(results.successful.length)],
    [chalk.yellow('⊘ Skipped'), chalk.bold(results.failed.length)],
    [chalk.blue('Total Files'), chalk.bold(files.length)]
  );

  console.log(table.toString());

  if (results.successful.length > 0) {
    console.log('\\n' + chalk.bold('Recent Links Added:'));

    const linksTable = new Table({
      head: [
        chalk.cyan('File'),
        chalk.cyan('Anchor Text'),
        chalk.cyan('Score')
      ],
      colWidths: [40, 35, 10]
    });

    results.successful.slice(-10).forEach(result => {
      linksTable.push([
        result.file,
        chalk.yellow(result.anchor),
        chalk.gray(`${result.score}/10`)
      ]);
    });

    console.log(linksTable.toString());
  }

  const trackingData = loadLinkTracking();
  console.log(chalk.gray(`\\nTotal DBA links in database: ${trackingData.totalLinks}`));
}

/**
 * Main execution
 */
async function main() {
  console.log(boxen(
    chalk.bold.magenta('🔗 DBA Cross-Linking Tool'),
    { padding: 1, margin: 1, borderStyle: 'double', borderColor: 'magenta' }
  ));

  if (argv.file && argv.microsite) {
    if (!fs.existsSync(argv.file)) {
      console.log(chalk.red(`❌ File not found: ${argv.file}`));
      process.exit(1);
    }
    await processSingleFile(argv.file, argv.microsite);
  } else if (argv.microsite && argv.batch) {
    await processBatchFiles(argv.microsite);
  } else {
    console.log(chalk.yellow('\\nUsage:'));
    console.log('  ' + chalk.bold('Single file (interactive):'));
    console.log('    ' + chalk.cyan('node suggest-dba-links.js --file path/to/file.md --microsite deck-repair'));
    console.log('\\n  ' + chalk.bold('Batch mode (automatic):'));
    console.log('    ' + chalk.cyan('node suggest-dba-links.js --microsite deck-repair --batch'));
    console.log('\\n  ' + chalk.gray('Example microsites: deck-repair, chimney-repair, siding-repair, etc.'));
  }
}

// Run the tool
if (require.main === module) {
  main().catch(error => {
    console.error(chalk.red('Error:'), error.message);
    process.exit(1);
  });
}

module.exports = { extractKeywords, scoreDBALinks };
