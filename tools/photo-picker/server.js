#!/usr/bin/env node
import express from 'express';
import { readdir, readFile, writeFile, mkdir, unlink } from 'fs/promises';
import { createReadStream } from 'fs';
import { Readable } from 'stream';
import dotenv from 'dotenv';
import { BlobClient } from '../blob-manager/src/blob-client.js';
import { resolve, extname, join, dirname } from 'path';
import { fileURLToPath } from 'url';
import open from 'open';
import sharp from 'sharp';
import { presets } from './presets.js';
import { log, getLogs, getLogStats } from './logger.js';
import { createBackup, listBackups, restoreBackup } from './backup.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../');

// Load blob-manager config and tokens
dotenv.config({ path: resolve(__dirname, '../blob-manager/.env') });
const blobConfig = JSON.parse(
  await readFile(resolve(__dirname, '../blob-manager/config.json'), 'utf-8')
);

// The photos folder is the first CLI arg
const photosDir = resolve(process.argv[2] || '.');

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.static(join(__dirname, 'public')));
app.use('/vendor', express.static(join(__dirname, 'node_modules')));

// Returns [{ clusterSlug, title, subtopics }] for a microsite.
// Reads from apps/{microsite}/src/data/generated_content/service_page_cluster_*_portland.md
async function getClusterTopics(microsite) {
  const contentDir = resolve(REPO_ROOT, 'apps', microsite, 'src', 'data', 'generated_content');
  let files;
  try {
    files = await readdir(contentDir);
  } catch {
    return [];
  }

  const clusterFiles = files.filter(f => /^service_page_cluster_.+_portland\.md$/.test(f));
  const topics = [];

  for (const file of clusterFiles) {
    let raw;
    try {
      raw = await readFile(resolve(contentDir, file), 'utf-8');
    } catch {
      continue;
    }

    const titleMatch = raw.match(/^#\s+(.+)/m);
    const title = titleMatch
      ? titleMatch[1].replace(/\s*[-–]\s*(Portland|Seattle).*/i, '').trim()
      : '';

    const metaMatch = raw.match(/<!--\s*CLUSTER_META([\s\S]+?)-->/);
    if (!metaMatch) continue;
    const meta = metaMatch[1];

    const slugMatch = meta.match(/cluster_slug:\s*(.+)/);
    const clusterSlug = slugMatch ? slugMatch[1].trim() : '';
    if (!clusterSlug) continue;

    const subtopicsMatch = meta.match(/subtopics:([\s\S]+?)(?=\n[a-z_]+:|$)/);
    const subtopics = subtopicsMatch
      ? (subtopicsMatch[1].match(/^\s*-\s*(.+)$/gm) || []).map(s => s.replace(/^\s*-\s*/, '').trim())
      : [];

    topics.push({ clusterSlug, title: title || clusterSlug, subtopics });
  }

  topics.sort((a, b) => a.title.localeCompare(b.title));
  return topics;
}

// GET /api/photos — list all image files in the target folder
app.get('/api/photos', async (req, res) => {
  try {
    const files = await readdir(photosDir);
    const images = files.filter(f => ALLOWED_EXTENSIONS.includes(extname(f).toLowerCase()));
    res.json({ photos: images, dir: photosDir });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/photos/:file — serve a raw photo file
app.get('/api/photos/:file', (req, res) => {
  const filePath = join(photosDir, req.params.file);
  res.sendFile(filePath);
});

// POST /api/upload
// Body: { imageData: <base64>, mimeType: string, filename: string, microsite: string, category: string }
// Returns: { url: string, pathname: string, size: number }
app.post('/api/upload', async (req, res) => {
  try {
    const { imageData, mimeType, filename, microsite, category } = req.body;

    if (!microsite || !filename) {
      return res.status(400).json({ error: 'microsite and filename are required' });
    }

    // Determine file extension from mimeType
    const ext = mimeType === 'image/webp' ? '.webp'
      : mimeType === 'image/png' ? '.png'
      : '.jpg';

    // Strip original extension and apply correct one
    const baseName = filename.replace(/\.[^.]+$/, '');
    const finalFilename = `${baseName}${ext}`;

    // Write buffer to a temp file so BlobClient can read it
    const { tmpdir } = await import('os');
    const tmpPath = join(tmpdir(), finalFilename);
    await writeFile(tmpPath, Buffer.from(imageData, 'base64'));

    const client = new BlobClient(microsite, blobConfig);
    const result = await client.upload(tmpPath, { category });

    // Clean up temp file
    await unlink(tmpPath);

    // Log the upload
    await log('upload', microsite, {
      filename: finalFilename,
      category,
      url: result.url,
      size: result.size,
      status: 'success'
    });

    res.json({ url: result.url, pathname: result.pathname, size: result.size });
  } catch (err) {
    await log('upload', req.body.microsite || 'unknown', {
      filename: req.body.filename,
      status: 'error',
      error: err.message
    });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/process
// Body: { imageData: <base64 string>, mimeType: string, options: { width, height, quality, format } }
// Returns: { imageData: <base64 string>, mimeType: string }
app.post('/api/process', async (req, res) => {
  try {
    const { imageData, mimeType, options = {} } = req.body;
    const { width, height, quality = 85, format = 'keep' } = options;

    // Decode base64 to buffer
    const inputBuffer = Buffer.from(imageData, 'base64');

    let pipeline = sharp(inputBuffer);

    // Resize if dimensions provided
    if (width || height) {
      pipeline = pipeline.resize(width || null, height || null, { fit: 'inside', withoutEnlargement: true });
    }

    // Output format
    if (format === 'webp') {
      pipeline = pipeline.webp({ quality });
    } else {
      // Keep original format but apply quality if jpeg/png
      if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
        pipeline = pipeline.jpeg({ quality });
      } else if (mimeType === 'image/png') {
        pipeline = pipeline.png({ quality: Math.round(quality / 10) });
      }
    }

    const outputBuffer = await pipeline.toBuffer();
    const outputMime = format === 'webp' ? 'image/webp' : mimeType;

    res.json({
      imageData: outputBuffer.toString('base64'),
      mimeType: outputMime
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Image data file helpers ---

async function readImagesJson(microsite) {
  const jsonPath = resolve(REPO_ROOT, 'apps', microsite, 'src', 'data', 'images.json');
  try {
    const raw = await readFile(jsonPath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { heroImages: {}, backgroundImages: {}, galleryImages: [], servicePageImages: [] };
  }
}

async function writeImagesJson(microsite, data) {
  const dataDir = resolve(REPO_ROOT, 'apps', microsite, 'src', 'data');
  const jsonPath = resolve(dataDir, 'images.json');
  const tsPath = resolve(dataDir, 'images.ts');

  await mkdir(dataDir, { recursive: true });

  // Create backup before writing
  try {
    const oldData = JSON.parse(await readFile(jsonPath, 'utf-8'));
    await createBackup(microsite, oldData);
  } catch {
    // First time creating this file, no backup needed
  }

  await writeFile(jsonPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');

  // Create the TypeScript wrapper once — never overwrite if it exists
  try {
    await readFile(tsPath, 'utf-8');
    // File exists — do nothing
  } catch {
    const tsContent = `// Auto-generated by photo-picker. Do not edit — update images.json instead.\nimport data from './images.json';\n\nexport const heroImages: Record<string, string> = data.heroImages as Record<string, string>;\nexport const backgroundImages: Record<string, string> = (data.backgroundImages ?? {}) as Record<string, string>;\nexport const galleryImages: { title: string; description: string; image: string; href: string }[] = data.galleryImages;\nexport const servicePageImages: { title: string; description: string; image: string; href: string }[] = data.servicePageImages ?? [];\n`;
    await writeFile(tsPath, tsContent, 'utf-8');
  }
}

// POST /api/write-images
// Body: { microsite, category, page, url, filename }
// Writes/updates apps/{microsite}/src/data/images.json
app.post('/api/write-images', async (req, res) => {
  try {
    const { microsite, category, page, url, filename } = req.body;
    if (!microsite || !category || !url) {
      return res.status(400).json({ error: 'microsite, category, and url are required' });
    }

    const data = await readImagesJson(microsite);

    if (category === 'hero' && page) {
      data.heroImages[page] = url;
    } else if (category === 'background' && page) {
      if (!data.backgroundImages) data.backgroundImages = {};
      data.backgroundImages[page] = url;
    } else if (category === 'service-page') {
      if (!data.servicePageImages) data.servicePageImages = [];
      const clusterSlug = req.body.clusterSlug || '';
      const serviceTitle = req.body.serviceTitle || '';
      // Write one entry per location — same image, portland + seattle hrefs
      for (const location of ['portland', 'seattle']) {
        const href = `/services/${location}/${clusterSlug}`;
        const exists = data.servicePageImages.some(img => img.image === url && img.href === href);
        if (!exists) {
          data.servicePageImages.push({ title: serviceTitle, description: '', image: url, href });
        }
      }
    } else if (category === 'gallery') {
      const exists = data.galleryImages.some(img => img.image === url);
      if (!exists) {
        data.galleryImages.push({ title: '', description: '', image: url, href: '' });
      }
    }

    await writeImagesJson(microsite, data);
    res.json({ ok: true, path: `apps/${microsite}/src/data/images.json` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/service-topics?microsite=deck-repair
// Returns cluster pages with subtopics, parsed from generated_content markdown files
app.get('/api/service-topics', async (req, res) => {
  try {
    const { microsite } = req.query;
    if (!microsite) return res.status(400).json({ error: 'microsite is required' });
    const validMicrosites = Object.keys(blobConfig.microsites);
    if (!validMicrosites.includes(microsite)) {
      return res.status(400).json({ error: 'unknown microsite' });
    }
    const topics = await getClusterTopics(microsite);
    res.json({ topics });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/gallery-snippet?microsite=deck-repair
app.get('/api/gallery-snippet', async (req, res) => {
  try {
    const { microsite } = req.query;
    if (!microsite) return res.status(400).json({ error: 'microsite is required' });

    const data = await readImagesJson(microsite);
    const services = data.galleryImages;

    if (services.length === 0) {
      return res.status(400).json({ error: 'No gallery images found for this microsite' });
    }

    const servicesStr = services.map(s =>
      `  { title: ${JSON.stringify(s.title)}, description: ${JSON.stringify(s.description)}, image: ${JSON.stringify(s.image)}, href: ${JSON.stringify(s.href)} }`
    ).join(',\n');

    const snippet = `<ServicesGallery\n  heading="Our Services"\n  services={[\n${servicesStr}\n  ]}\n/>`;

    res.json({ snippet, count: services.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/config — return microsites and categories for the UI dropdowns
app.get('/api/config', (req, res) => {
  const microsites = Object.entries(blobConfig.microsites).map(([key, val]) => ({
    key,
    name: val.name
  }));
  res.json({
    microsites,
    imageCategories: blobConfig.imageCategories
  });
});

// GET /api/coverage
// Returns coverage summary for all microsites.
// A cluster is "covered" if it has ≥1 entry in servicePageImages.
app.get('/api/coverage', async (req, res) => {
  try {
    const results = await Promise.all(
      Object.entries(blobConfig.microsites).map(async ([key, site]) => {
        const [topics, imagesData] = await Promise.all([
          getClusterTopics(key),
          readImagesJson(key)
        ]);

        const servicePageImages = imagesData.servicePageImages || [];
        const coveredSlugs = new Set(
          servicePageImages.map(img => img.href.replace(/\/+$/, '').split('/').pop())
        );

        return {
          key,
          name: site.name,
          domain: site.domain,
          totalClusters: topics.length,
          coveredClusters: topics.filter(t => coveredSlugs.has(t.clusterSlug)).length
        };
      })
    );

    // Sort: most coverage % first, then alphabetically
    results.sort((a, b) => {
      const aPct = a.totalClusters ? a.coveredClusters / a.totalClusters : 0;
      const bPct = b.totalClusters ? b.coveredClusters / b.totalClusters : 0;
      return bPct - aPct || a.key.localeCompare(b.key);
    });

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reconcile/:microsite
// Queries blob storage for service-page images and syncs missing ones to images.json
app.post('/api/reconcile/:microsite', async (req, res) => {
  try {
    const { microsite } = req.params;
    const validMicrosites = Object.keys(blobConfig.microsites);
    if (!validMicrosites.includes(microsite)) {
      return res.status(400).json({ error: 'unknown microsite' });
    }

    const client = new BlobClient(microsite, blobConfig);
    const data = await readImagesJson(microsite);
    const servicePageImages = data.servicePageImages || [];

    // List all service-page images in blob storage
    const blobs = await client.list({ prefix: 'service-page/' });
    const blobUrls = new Set(blobs.map(b => b.url));
    const existingUrls = new Set(servicePageImages.map(img => img.image));

    // Find missing images
    const missing = [];
    for (const blob of blobs) {
      if (!existingUrls.has(blob.url)) {
        // Extract filename to guess the service
        const filename = blob.pathname.split('/').pop();
        missing.push({
          url: blob.url,
          filename,
          uploadedAt: blob.uploadedAt
        });
      }
    }

    // Auto-add missing images with placeholder data
    let added = 0;
    if (missing.length > 0) {
      for (const img of missing) {
        // Try to parse cluster slug from filename or just use 'uncategorized'
        const entry = {
          title: img.filename.replace(/\.[^.]+$/, '').replace(/_/g, ' '),
          description: '',
          image: img.url,
          href: '/services/portland/uncategorized' // placeholder href
        };
        data.servicePageImages.push(entry);
        added++;
      }
      await writeImagesJson(microsite, data);
    }

    res.json({
      ok: true,
      microsite,
      totalInStorage: blobs.length,
      currentInJson: servicePageImages.length,
      missing: missing.length,
      added,
      details: missing
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/coverage/:microsite
// Returns per-cluster breakdown: image count, hero set, header texture set.
app.get('/api/coverage/:microsite', async (req, res) => {
  try {
    const { microsite } = req.params;
    const validMicrosites = Object.keys(blobConfig.microsites);
    if (!validMicrosites.includes(microsite)) {
      return res.status(400).json({ error: 'unknown microsite' });
    }

    const [topics, imagesData] = await Promise.all([
      getClusterTopics(microsite),
      readImagesJson(microsite)
    ]);

    const servicePageImages = imagesData.servicePageImages || [];
    const heroImages = imagesData.heroImages || {};
    const backgroundImages = imagesData.backgroundImages || {};

    // Group servicePageImages by clusterSlug (deduplicated by URL)
    const imagesBySlug = {};
    for (const img of servicePageImages) {
      const slug = img.href.replace(/\/+$/, '').split('/').pop();
      if (!imagesBySlug[slug]) imagesBySlug[slug] = new Set();
      imagesBySlug[slug].add(img.image);
    }

    const clusters = topics.map(({ clusterSlug, title }) => ({
      clusterSlug,
      title,
      imageCount: imagesBySlug[clusterSlug] ? imagesBySlug[clusterSlug].size : 0,
      hasHero: !!heroImages[clusterSlug],
      hasHeaderTexture: !!backgroundImages[clusterSlug]
    }));

    res.json({ microsite, clusters });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/gallery/:microsite
// Returns servicePageImages grouped by clusterSlug, deduplicated by URL, with hero/texture flags.
app.get('/api/gallery/:microsite', async (req, res) => {
  try {
    const { microsite } = req.params;
    const validMicrosites = Object.keys(blobConfig.microsites);
    if (!validMicrosites.includes(microsite)) {
      return res.status(400).json({ error: 'unknown microsite' });
    }

    const [topics, imagesData] = await Promise.all([
      getClusterTopics(microsite),
      readImagesJson(microsite)
    ]);

    const servicePageImages = imagesData.servicePageImages || [];
    const heroImages = imagesData.heroImages || {};
    const backgroundImages = imagesData.backgroundImages || {};

    // Group images by clusterSlug, deduplicating by URL
    const imagesBySlug = {};
    for (const img of servicePageImages) {
      const slug = img.href.replace(/\/+$/, '').split('/').pop();
      if (!imagesBySlug[slug]) imagesBySlug[slug] = new Map();
      // Use URL as key to deduplicate (portland + seattle produce the same image twice)
      if (!imagesBySlug[slug].has(img.image)) {
        imagesBySlug[slug].set(img.image, {
          url: img.image,
          title: img.title,
          isHero: heroImages[slug] === img.image,
          isHeaderTexture: backgroundImages[slug] === img.image
        });
      }
    }

    const clusters = topics.map(({ clusterSlug, title }) => ({
      clusterSlug,
      title,
      images: imagesBySlug[clusterSlug]
        ? Array.from(imagesBySlug[clusterSlug].values())
        : []
    }));

    res.json({ microsite, clusters });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/uncategorized/:microsite
// Returns service-page images that are uncategorized (href contains 'uncategorized')
app.get('/api/uncategorized/:microsite', async (req, res) => {
  try {
    const { microsite } = req.params;
    const validMicrosites = Object.keys(blobConfig.microsites);
    if (!validMicrosites.includes(microsite)) {
      return res.status(400).json({ error: 'unknown microsite' });
    }

    const imagesData = await readImagesJson(microsite);
    const servicePageImages = imagesData.servicePageImages || [];

    // Filter images with 'uncategorized' in their href
    const uncategorized = servicePageImages
      .filter(img => img.href.includes('uncategorized'))
      .map(img => ({
        url: img.image,
        title: img.title || '',
        clusterSlug: 'uncategorized'
      }));

    // Deduplicate by URL
    const seen = new Set();
    const unique = uncategorized.filter(img => {
      if (seen.has(img.url)) return false;
      seen.add(img.url);
      return true;
    });

    res.json(unique);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/update-image
// Body: { microsite, imageUrl, clusterSlug, subtopic, title }
// Updates an image's href to point to the correct cluster
app.post('/api/update-image', async (req, res) => {
  try {
    const { microsite, imageUrl, clusterSlug, subtopic, title } = req.body;

    if (!microsite || !imageUrl || !clusterSlug) {
      return res.status(400).json({ error: 'microsite, imageUrl, and clusterSlug are required' });
    }

    const validMicrosites = Object.keys(blobConfig.microsites);
    if (!validMicrosites.includes(microsite)) {
      return res.status(400).json({ error: 'unknown microsite' });
    }

    const data = await readImagesJson(microsite);
    const servicePageImages = data.servicePageImages || [];

    // Use cluster title as title, subtopic as description
    const finalTitle = title || clusterSlug;
    const finalDescription = subtopic || '';

    // Find all entries for this image URL and update them
    let updated = false;
    for (const img of servicePageImages) {
      if (img.image === imageUrl) {
        img.title = finalTitle;
        img.description = finalDescription;
        // Update href for both locations (portland + seattle)
        for (const location of ['portland', 'seattle']) {
          img.href = `/services/${location}/${clusterSlug}`;
        }
        updated = true;
      }
    }

    if (!updated) {
      // If image not found, add it
      for (const location of ['portland', 'seattle']) {
        servicePageImages.push({
          title: finalTitle,
          description: finalDescription,
          image: imageUrl,
          href: `/services/${location}/${clusterSlug}`
        });
      }
    }

    await writeImagesJson(microsite, data);

    // Log the update
    await log('update', microsite, {
      imageUrl: imageUrl.slice(0, 80),
      clusterSlug,
      subtopic: subtopic || null,
      status: 'success'
    });

    res.json({ ok: true, microsite, clusterSlug, subtopic });
  } catch (err) {
    await log('update', microsite, {
      imageUrl: imageUrl ? imageUrl.slice(0, 80) : 'unknown',
      status: 'error',
      error: err.message
    });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/logs?microsite=deck-repair&limit=50
app.get('/api/logs', async (req, res) => {
  try {
    const { microsite, limit = 100 } = req.query;
    const logs = await getLogs(microsite, parseInt(limit));
    res.json({ logs, count: logs.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/log-stats
app.get('/api/log-stats', async (req, res) => {
  try {
    const stats = await getLogStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/backups/:microsite
app.get('/api/backups/:microsite', async (req, res) => {
  try {
    const { microsite } = req.params;
    const backups = await listBackups(microsite);
    res.json({ microsite, backups });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/restore/:microsite/:filename
app.post('/api/restore/:microsite/:filename', async (req, res) => {
  try {
    const { microsite, filename } = req.params;
    const validMicrosites = Object.keys(blobConfig.microsites);
    if (!validMicrosites.includes(microsite)) {
      return res.status(400).json({ error: 'unknown microsite' });
    }

    const data = await restoreBackup(microsite, filename);
    await writeImagesJson(microsite, data);

    await log('restore', microsite, {
      filename,
      status: 'success'
    });

    res.json({ ok: true, microsite, filename });
  } catch (err) {
    await log('restore', req.params.microsite, {
      filename: req.params.filename,
      status: 'error',
      error: err.message
    });
    res.status(500).json({ error: err.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`Photo Picker running at ${url}`);
  console.log(`Photos folder: ${photosDir}`);
  open(url);
});

export { app };
