#!/usr/bin/env node
/**
 * Generates stub markdown files for each cluster x location.
 * Usage: node tools/content-generator/generate-stubs.js [--force]
 *
 * Creates: apps/<site>/src/data/generated_content/service_page_cluster_<slug>_<location>.md
 * Skips existing files unless --force is passed.
 */

const fs = require('fs');
const path = require('path');

const FORCE = process.argv.includes('--force');
const LOCATIONS = ['portland', 'seattle'];
const LOCATION_FULL = { portland: 'Portland, Oregon', seattle: 'Seattle, Washington' };
const ROOT = path.resolve(__dirname, '../..');
const clusters = require('./config/clusters.json');

let created = 0;
let skipped = 0;

for (const [site, siteClust] of Object.entries(clusters)) {
  const contentDir = path.join(ROOT, 'apps', site, 'src', 'data', 'generated_content');

  if (!fs.existsSync(contentDir)) {
    console.warn(`WARN: content dir missing for ${site}, skipping`);
    continue;
  }

  for (const cluster of siteClust) {
    for (const location of LOCATIONS) {
      const fileName = `service_page_cluster_${cluster.slug}_${location}.md`;
      const filePath = path.join(contentDir, fileName);

      if (fs.existsSync(filePath) && !FORCE) {
        skipped++;
        continue;
      }

      const content = generateStub(cluster, location, site);
      fs.writeFileSync(filePath, content, 'utf-8');
      created++;
      console.log(`  created: apps/${site}/src/data/generated_content/${fileName}`);
    }
  }
}

console.log(`\nDone. Created: ${created}, Skipped: ${skipped}`);

function generateStub(cluster, location, site) {
  const locationFull = LOCATION_FULL[location];
  const subtopicSections = cluster.subtopics
    .map(t => `## ${t}\n*Content to be generated.*\n`)
    .join('\n');

  return `# ${cluster.name} - ${locationFull}

<!-- CLUSTER_META
service: ${site}
cluster_id: ${cluster.id}
cluster_slug: ${cluster.slug}
location: ${location}
status: stub
subtopics:
${cluster.subtopics.map(t => `  - ${t}`).join('\n')}
-->

## Hero Section

### [STUB] ${cluster.name} in ${locationFull}
*Content to be generated.*

${subtopicSections}
## FAQ Section
*Content to be generated.*

## Page Metadata

**Service:** ${cluster.name}
**Location:** ${locationFull}
**Status:** STUB
**Cluster ID:** ${cluster.id}
**Target Keywords:** [to be filled]
`;
}
