# Photo Picker: Drag-and-Drop + Subtopic Gallery Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add drag-and-drop file upload and reorganize the gallery to show service page subtopic hierarchy with interactive cards that auto-resize/convert images on drop.

**Architecture:** Three-layer approach — server endpoints handle image processing and storage, gallery.html refactors UI to show subtopic hierarchy with drag handlers, app.js adds deep-linking and generic gallery support to the upload page. All auto-processing uses the existing `/api/process` endpoint with 800×600 @ 75% WebP settings.

**Tech Stack:** Node.js/Express (server), vanilla JS + HTML5 drag-and-drop (browser), Sharp (image processing), existing BlobClient for storage.

---

## File Structure

**Modified files:**
- `tools/photo-picker/server.js` — add endpoints, update gallery logic
- `tools/photo-picker/public/gallery.html` — refactor for subtopic layout
- `tools/photo-picker/public/app.js` — deep-linking, generic gallery, drag handlers
- `tools/photo-picker/public/style.css` — subtopic sections, drop zones, drag-over states

---

## Chunk 1: Server API Updates

### Task 1: Update `/api/gallery/:microsite` to return subtopic structure

**Files:**
- Modify: `tools/photo-picker/server.js:386-431`

The endpoint currently returns clusters with a flat image list. Update it to group images by (clusterSlug, subtopic) and include subtopic structure in the response.

- [ ] **Step 1: Review current gallery endpoint (lines 386-431)**

Read the endpoint to understand the current data flow and deduplication logic.

- [ ] **Step 2: Add helper function to organize images by subtopic**

Add this function before the gallery endpoint (around line 385):

```javascript
// Organize servicePageImages by (clusterSlug, subtopic) with deduplication
function groupImagesBySubtopic(servicePageImages) {
  const grouped = {}; // { clusterSlug: { subtopic: [images] } }

  for (const img of servicePageImages) {
    const slug = img.href.replace(/\/+$/, '').split('/').pop();
    if (!grouped[slug]) grouped[slug] = {};
    if (!grouped[slug][img.subtopic]) grouped[slug][img.subtopic] = new Map();

    // Deduplicate by URL (portland/seattle produce same image)
    if (!grouped[slug][img.subtopic].has(img.image)) {
      grouped[slug][img.subtopic].set(img.image, {
        url: img.image,
        title: img.title,
        isHero: false, // Will be set below if needed
        isHeaderTexture: false
      });
    }
  }

  return grouped;
}
```

- [ ] **Step 3: Update gallery endpoint response building**

Replace lines 403-425 with:

```javascript
const imagesBySubtopic = groupImagesBySubtopic(servicePageImages);

const clusters = topics.map(({ clusterSlug, title, subtopics }) => {
  const subtopicsList = subtopics.map(subtopic => {
    const images = imagesBySubtopic[clusterSlug]?.[subtopic]
      ? Array.from(imagesBySubtopic[clusterSlug][subtopic].values())
      : [];

    // Mark hero/texture images
    images.forEach(img => {
      if (heroImages[clusterSlug] === img.url) img.isHero = true;
      if (backgroundImages[clusterSlug] === img.url) img.isHeaderTexture = true;
    });

    return {
      subtopic,
      images,
      totalSlots: 4
    };
  });

  return {
    clusterSlug,
    title,
    subtopics: subtopicsList
  };
});
```

- [ ] **Step 4: Verify endpoint response structure**

Check that response matches:
```json
{
  "microsite": "deck-repair",
  "clusters": [
    {
      "clusterSlug": "...",
      "title": "...",
      "subtopics": [
        {
          "subtopic": "...",
          "images": [...],
          "totalSlots": 4
        }
      ]
    }
  ]
}
```

- [ ] **Step 5: Test the endpoint**

Start server and test:
```bash
curl -s http://localhost:3000/api/gallery/deck-repair | jq '.clusters[0].subtopics[0]'
```

Expected: subtopic structure with `subtopic`, `images`, `totalSlots` fields.

- [ ] **Step 6: Commit**

```bash
git add tools/photo-picker/server.js
git commit -m "photo-picker: update gallery endpoint to return subtopic hierarchy"
```

---

### Task 2: Add `/api/upload-gallery-image` endpoint

**Files:**
- Modify: `tools/photo-picker/server.js`

New endpoint that accepts a dragged image, processes it (resize 800×600, WebP @75%), uploads via BlobClient, and saves to servicePageImages with clusterSlug/subtopic metadata.

- [ ] **Step 1: Add POST endpoint before `app.listen` (around line 432)**

```javascript
// POST /api/upload-gallery-image
// Body: { microsite, clusterSlug, subtopic, imageData, filename }
// Auto-resizes to 800×600, converts to WebP @75%
app.post('/api/upload-gallery-image', async (req, res) => {
  try {
    const { microsite, clusterSlug, subtopic, imageData, filename } = req.body;

    // Validate inputs
    if (!microsite || !clusterSlug || !subtopic || !imageData || !filename) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const validMicrosites = Object.keys(blobConfig.microsites);
    if (!validMicrosites.includes(microsite)) {
      return res.status(400).json({ error: 'Invalid microsite' });
    }

    // Verify cluster/subtopic exist
    const topics = await getClusterTopics(microsite);
    const cluster = topics.find(t => t.clusterSlug === clusterSlug);
    if (!cluster) {
      return res.status(400).json({ error: 'Invalid clusterSlug' });
    }
    if (!cluster.subtopics.includes(subtopic)) {
      return res.status(400).json({ error: 'Invalid subtopic' });
    }

    // Process image (resize, convert)
    const inputBuffer = Buffer.from(imageData, 'base64');
    let processed = sharp(inputBuffer);
    processed = processed.resize(800, 600, { fit: 'inside', withoutEnlargement: true });
    processed = processed.webp({ quality: 75 });
    const processedData = await processed.toBuffer();
    const processedBase64 = processedData.toString('base64');

    // Upload via BlobClient
    const { tmpdir } = await import('os');
    const tmpPath = join(tmpdir(), filename.replace(/\.[^.]+$/, '.webp'));
    await writeFile(tmpPath, processedData);

    const client = new BlobClient(microsite, blobConfig);
    const result = await client.upload(tmpPath, { category: 'service-page' });

    // Clean up temp file
    await unlink(tmpPath);

    // Read current images.json
    const data = await readImagesJson(microsite);

    // Add to servicePageImages with metadata
    if (!data.servicePageImages) data.servicePageImages = [];

    // Find the cluster's href to reuse (use first image's href if exists, or construct one)
    let clusterHref = `/${clusterSlug}`;
    const existingClusterImg = data.servicePageImages.find(img => img.clusterSlug === clusterSlug);
    if (existingClusterImg) {
      clusterHref = existingClusterImg.href;
    }

    data.servicePageImages.push({
      clusterSlug,
      subtopic,
      title: '', // Empty initially, can be edited later
      description: '',
      image: result.url,
      href: clusterHref
    });

    // Save updated images.json
    await writeImagesJson(microsite, data);

    res.json({
      url: result.url,
      title: '',
      description: '',
      clusterSlug,
      subtopic
    });
  } catch (err) {
    console.error('upload-gallery-image error:', err);
    res.status(500).json({ error: err.message });
  }
});
```

- [ ] **Step 2: Test the endpoint with curl**

```bash
# First, get a sample image from the photos folder and base64-encode it
# Then call the endpoint:
curl -s -X POST http://localhost:3000/api/upload-gallery-image \
  -H "Content-Type: application/json" \
  -d '{
    "microsite": "deck-repair",
    "clusterSlug": "roof-to-wall-penetration-flashing",
    "subtopic": "Installation & Setup",
    "imageData": "<base64-of-jpg-file>",
    "filename": "test.jpg"
  }' | jq .
```

Expected: `{ "url": "...", "title": "", "description": "", "clusterSlug": "...", "subtopic": "..." }`

- [ ] **Step 3: Verify images.json was updated**

```bash
cat apps/deck-repair/src/data/images.json | jq '.servicePageImages[-1]'
```

Expected: Last entry has `clusterSlug`, `subtopic`, `image`, `href` fields.

- [ ] **Step 4: Commit**

```bash
git add tools/photo-picker/server.js
git commit -m "photo-picker: add upload-gallery-image endpoint with auto-resize/convert"
```

---

### Task 3: Update `write-images` endpoint to preserve clusterSlug/subtopic

**Files:**
- Modify: `tools/photo-picker/server.js:206-245`

The existing `/api/write-images` endpoint saves images to images.json. Update it to accept and preserve clusterSlug/subtopic when category is 'service-page'.

- [ ] **Step 1: Review current write-images endpoint (lines 206-245)**

Understand the current flow and where to add clusterSlug/subtopic support.

- [ ] **Step 2: Update endpoint to handle service-page category with cluster/subtopic**

Replace the category handling logic (around line 220-240) to include:

```javascript
if (category === 'service-page' && clusterSlug && subtopic) {
  // Add to servicePageImages with metadata
  if (!data.servicePageImages) data.servicePageImages = [];

  const exists = data.servicePageImages.some(img =>
    img.image === url && img.clusterSlug === clusterSlug && img.subtopic === subtopic
  );

  if (!exists) {
    data.servicePageImages.push({
      clusterSlug,
      subtopic,
      title: '',
      description: '',
      image: url,
      href: `/${clusterSlug}`
    });
  }
}
```

- [ ] **Step 3: Accept clusterSlug/subtopic in request body**

Update the endpoint signature to extract these from req.body (they already come from the client).

- [ ] **Step 4: Test with curl**

```bash
curl -s -X POST http://localhost:3000/api/write-images \
  -H "Content-Type: application/json" \
  -d '{
    "microsite": "deck-repair",
    "category": "service-page",
    "clusterSlug": "roof-to-wall-penetration-flashing",
    "subtopic": "Installation & Setup",
    "url": "https://example.com/image.webp",
    "filename": "test.webp"
  }' | jq .
```

Expected: `{ "ok": true, "path": "..." }`

- [ ] **Step 5: Commit**

```bash
git add tools/photo-picker/server.js
git commit -m "photo-picker: update write-images to preserve clusterSlug/subtopic"
```

---

## Chunk 2: Gallery View Refactor

### Task 4: Refactor gallery.html for subtopic layout

**Files:**
- Modify: `tools/photo-picker/public/gallery.html:75-170` (JavaScript section)

The gallery currently renders clusters with a flat image grid. Refactor to render subtopic sections with 4-slot grids.

- [ ] **Step 1: Update loadGallery function to handle subtopic structure**

Replace the cluster rendering loop (lines 124-169) with:

```javascript
data.clusters.forEach(cluster => {
  const section = document.createElement('div');
  section.className = 'cluster-section';

  section.innerHTML = `
    <div class="cluster-header">
      <div class="cluster-title">${cluster.title}</div>
      <div class="cluster-meta">${cluster.subtopics.length} subtopic${cluster.subtopics.length !== 1 ? 's' : ''}</div>
    </div>
  `;
  body.appendChild(section);

  cluster.subtopics.forEach(subtopic => {
    const subtopicDiv = document.createElement('div');
    subtopicDiv.className = 'subtopic-section';
    subtopicDiv.innerHTML = `
      <div class="subtopic-header">${subtopic.subtopic}</div>
      <div class="img-grid" id="grid-${cluster.clusterSlug}-${subtopic.subtopic.replace(/\s+/g, '-')}"></div>
    `;
    section.appendChild(subtopicDiv);

    const grid = subtopicDiv.querySelector('.img-grid');

    // Add filled image cards
    subtopic.images.forEach(img => {
      const filename = img.url.split('/').pop();
      const tags = [
        img.isHero ? '<span class="tag tag-hero">HERO</span>' : '',
        img.isHeaderTexture ? '<span class="tag tag-texture">TEXTURE</span>' : ''
      ].filter(Boolean).join('');

      const card = document.createElement('div');
      card.className = 'img-card' + (img.isHero ? ' has-hero' : '') + (img.isHeaderTexture ? ' has-texture' : '');
      card.dataset.microsite = microsite;
      card.dataset.clusterSlug = cluster.clusterSlug;
      card.dataset.subtopic = subtopic.subtopic;
      card.innerHTML = `
        <img class="img-thumb" src="${img.url}" alt="${img.title || '—'}" loading="lazy" />
        <div class="img-info">
          ${tags ? `<div class="img-tags">${tags}</div>` : ''}
          <div class="img-title">${img.title || '—'}</div>
          <div class="img-subtitle">${subtopic.subtopic}</div>
          <div class="img-filename">${filename}</div>
        </div>
      `;

      // Click to open in upload view
      card.addEventListener('click', () => {
        const params = new URLSearchParams({
          microsite,
          clusterSlug: cluster.clusterSlug,
          subtopic: subtopic.subtopic
        });
        window.location.href = `/?${params.toString()}`;
      });

      grid.appendChild(card);
    });

    // Add empty upload slots (fill to totalSlots)
    for (let i = subtopic.images.length; i < subtopic.totalSlots; i++) {
      const emptyCard = document.createElement('div');
      emptyCard.className = 'img-card empty-slot';
      emptyCard.dataset.microsite = microsite;
      emptyCard.dataset.clusterSlug = cluster.clusterSlug;
      emptyCard.dataset.subtopic = subtopic.subtopic;
      emptyCard.innerHTML = `
        <div class="empty-slot-content">
          <div class="plus">+</div>
          <div class="empty-slot-text">Drop JPG/PNG</div>
        </div>
      `;

      grid.appendChild(emptyCard);
    }
  });
});
```

- [ ] **Step 2: Update styles for subtopic sections**

Add to CSS (Task 5) before testing. For now, just verify structure renders.

- [ ] **Step 3: Test in browser**

Load gallery.html and select a site. Should see:
- Cluster titles
- Subtopic headers under each cluster
- 4-slot grids for each subtopic
- Empty slots visible for unfilled subtopics

- [ ] **Step 4: Commit**

```bash
git add tools/photo-picker/public/gallery.html
git commit -m "photo-picker: refactor gallery to show subtopic hierarchy with 4-slot grids"
```

---

### Task 5: Add CSS for subtopic layout and drag-over states

**Files:**
- Modify: `tools/photo-picker/public/style.css`

Add styles for subtopic sections, improved card styling, and drag-over feedback.

- [ ] **Step 1: Add subtopic section styles**

Append to style.css:

```css
/* Subtopic section */
.subtopic-section {
  margin-bottom: 20px;
}

.subtopic-header {
  font-size: 12px;
  font-weight: 600;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 8px;
  padding-left: 4px;
}

/* Image card enhancements */
.img-card {
  position: relative;
  cursor: pointer;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid #222;
  aspect-ratio: 4/3;
  background: #111;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.img-card:hover {
  border-color: #333;
  box-shadow: 0 0 8px rgba(74, 158, 255, 0.1);
}

.img-card.has-hero { border-color: #1e3a5c; }
.img-card.has-texture { border-color: #2d1f5c; }

/* Image subtitle (subtopic label) */
.img-subtitle {
  font-size: 9px;
  color: #555;
  font-style: italic;
  margin-top: 1px;
}

/* Empty upload slot */
.img-card.empty-slot {
  border: 2px dashed #252525;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  transition: border-color 0.2s, background 0.2s;
}

.img-card.empty-slot:hover {
  border-color: #4a9eff;
  background: rgba(74, 158, 255, 0.05);
}

.empty-slot-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  pointer-events: none;
}

.empty-slot .plus {
  font-size: 24px;
  color: #2a2a2a;
  font-weight: 300;
}

.img-card.empty-slot:hover .plus {
  color: #4a9eff;
}

.empty-slot-text {
  font-size: 10px;
  color: #444;
}

.img-card.empty-slot:hover .empty-slot-text {
  color: #4a9eff;
}

/* Drag-over state */
.img-card.drag-over {
  border-color: #4a9eff;
  border-style: solid;
  background: rgba(74, 158, 255, 0.1);
  box-shadow: inset 0 0 8px rgba(74, 158, 255, 0.2);
}

.img-card.drag-over .empty-slot-text::after {
  content: ' — Release to upload';
}

/* Upload spinner overlay */
.img-card.uploading {
  position: relative;
  opacity: 0.6;
}

.img-card.uploading::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

- [ ] **Step 2: Update img-info for subtopic display**

The subtitle should already show from the HTML update in Task 4. Verify the CSS matches.

- [ ] **Step 3: Test styling in browser**

- Hover over filled cards → should highlight slightly
- Hover over empty slots → blue border, blue text
- Drag over card → stronger highlight, "Release to upload" hint visible

- [ ] **Step 4: Commit**

```bash
git add tools/photo-picker/public/style.css
git commit -m "photo-picker: add CSS for subtopic sections and drag-over states"
```

---

### Task 6: Wire drag-and-drop handlers in gallery

**Files:**
- Modify: `tools/photo-picker/public/gallery.html:75-170` (in the script section)

Add drag-and-drop handlers to all gallery cards (filled and empty).

- [ ] **Step 1: Add drag event handlers after loadGallery function**

Add this helper and event binding at the end of the script (before `init()`):

```javascript
// Handle drag over any card
document.addEventListener('dragover', (e) => {
  const card = e.target.closest('.img-card');
  if (card) {
    e.preventDefault();
    card.classList.add('drag-over');
  }
});

document.addEventListener('dragleave', (e) => {
  const card = e.target.closest('.img-card');
  if (card) {
    card.classList.remove('drag-over');
  }
});

// Handle drop on card
document.addEventListener('drop', (e) => {
  const card = e.target.closest('.img-card');
  if (!card) return;

  e.preventDefault();
  card.classList.remove('drag-over');

  const file = e.dataTransfer.files[0];
  if (!file || !['image/jpeg', 'image/png'].includes(file.type)) {
    alert('Only JPG and PNG files supported');
    return;
  }

  uploadImageToGallery(file, card);
});

async function uploadImageToGallery(file, card) {
  const microsite = card.dataset.microsite;
  const clusterSlug = card.dataset.clusterSlug;
  const subtopic = card.dataset.subtopic;

  // Show uploading state
  card.classList.add('uploading');

  try {
    // Read file as base64
    const reader = new FileReader();
    reader.onload = async (e) => {
      const imageData = e.target.result.split(',')[1];

      // Process image: resize 800×600, convert to WebP @75%
      const processRes = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageData,
          mimeType: file.type,
          options: { width: 800, height: 600, quality: 75, format: 'webp' }
        })
      });

      if (!processRes.ok) {
        throw new Error(`Processing failed: ${processRes.status}`);
      }

      const processed = await processRes.json();

      // Upload to gallery
      const uploadRes = await fetch('/api/upload-gallery-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          microsite,
          clusterSlug,
          subtopic,
          imageData: processed.imageData,
          filename: file.name
        })
      });

      if (!uploadRes.ok) {
        const error = await uploadRes.json();
        throw new Error(error.error || `Upload failed: ${uploadRes.status}`);
      }

      const result = await uploadRes.json();

      // Update card
      card.classList.remove('uploading');
      card.classList.remove('empty-slot');

      const filename = result.url.split('/').pop();
      card.innerHTML = `
        <img class="img-thumb" src="${result.url}" alt="" loading="lazy" />
        <div class="img-info">
          <div class="img-title">${result.title || '—'}</div>
          <div class="img-subtitle">${subtopic}</div>
          <div class="img-filename">${filename}</div>
        </div>
      `;

      // Re-attach click handler
      card.addEventListener('click', () => {
        const params = new URLSearchParams({
          microsite,
          clusterSlug,
          subtopic
        });
        window.location.href = `/?${params.toString()}`;
      });

      // Show success feedback
      const originalBg = card.style.background;
      card.style.background = 'rgba(34, 197, 94, 0.1)';
      setTimeout(() => { card.style.background = originalBg; }, 1500);
    };
    reader.readAsDataURL(file);
  } catch (err) {
    card.classList.remove('uploading');
    alert(`Upload failed: ${err.message}`);
  }
}
```

- [ ] **Step 2: Test drag-and-drop in gallery**

- Open gallery.html
- Select a microsite
- Drag a JPG/PNG from desktop onto an empty slot
- Expected: Upload spinner shows, image processes, card updates with new image, brief success flash

- [ ] **Step 3: Verify images.json was updated**

```bash
cat apps/deck-repair/src/data/images.json | jq '.servicePageImages | map(select(.clusterSlug == "roof-to-wall-penetration-flashing")) | .[0]'
```

Expected: Image with clusterSlug and subtopic fields.

- [ ] **Step 4: Test click-to-edit**

- Click the newly uploaded card
- Should navigate to upload page with context pre-filled (Task 7 will handle this)

- [ ] **Step 5: Commit**

```bash
git add tools/photo-picker/public/gallery.html
git commit -m "photo-picker: add drag-drop handlers to gallery cards with auto-process/upload"
```

---

## Chunk 3: Upload Page Enhancements

### Task 7: Add generic gallery section to index.html

**Files:**
- Modify: `tools/photo-picker/public/index.html:25-36`

Add a "Generic Gallery" section at the top of the upload options panel for non-service-page images.

- [ ] **Step 1: Add HTML section to index.html**

Insert after the nav and before the existing `#app` div (around line 24):

```html
<div id="generic-gallery-section" style="display:none">
  <div id="generic-gallery-header">
    <span>Generic Gallery Upload</span>
    <button id="generic-dismiss" title="Hide">✕</button>
  </div>
  <div id="generic-gallery-drop-zone" class="drop-zone">
    <div class="drop-zone-content">
      <div class="drop-icon">↓</div>
      <div class="drop-text">Drop JPG/PNG here</div>
      <div class="drop-hint">or click to select</div>
    </div>
    <input id="generic-file-input" type="file" accept="image/jpeg,image/png" style="display:none" multiple />
  </div>
  <div id="generic-gallery-grid" class="generic-gallery-grid"></div>
</div>
```

- [ ] **Step 2: Add CSS for generic gallery section**

Append to style.css:

```css
/* Generic gallery section */
#generic-gallery-section {
  background: #0a1a0a;
  border: 1px solid #1a3a1a;
  border-radius: 6px;
  margin-bottom: 16px;
  overflow: hidden;
}

#generic-gallery-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  background: #111;
  border-bottom: 1px solid #1a3a1a;
  font-size: 12px;
  font-weight: 600;
  color: #888;
}

#generic-dismiss {
  background: none;
  border: none;
  color: #555;
  cursor: pointer;
  font-size: 16px;
}

#generic-dismiss:hover { color: #aaa; }

/* Drop zone */
.drop-zone {
  border: 2px dashed #2a5a2a;
  border-radius: 6px;
  padding: 20px;
  text-align: center;
  background: transparent;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
  margin: 12px;
}

.drop-zone:hover {
  border-color: #6f6;
  background: rgba(102, 255, 102, 0.05);
}

.drop-zone.drag-over {
  border-color: #6f6;
  background: rgba(102, 255, 102, 0.1);
  border-style: solid;
}

.drop-zone-content {
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.drop-icon {
  font-size: 28px;
  color: #4a6a4a;
}

.drop-text {
  font-size: 13px;
  font-weight: 600;
  color: #6ab06a;
}

.drop-hint {
  font-size: 11px;
  color: #4a6a4a;
}

/* Generic gallery grid */
.generic-gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 8px;
  padding: 12px;
  border-top: 1px solid #1a3a1a;
}

.generic-gallery-grid .img-card {
  cursor: pointer;
}
```

- [ ] **Step 3: Show generic gallery section when at top-level**

In app.js, after DOM refs are set, add:

```javascript
const genericGallerySection = document.getElementById('generic-gallery-section');
const genericDismiss = document.getElementById('generic-dismiss');
const genericDropZone = document.getElementById('generic-gallery-drop-zone');
const genericFileInput = document.getElementById('generic-file-input');
const genericGalleryGrid = document.getElementById('generic-gallery-grid');

// Show generic gallery if not in deep-link mode
function showGenericGallery() {
  const params = new URLSearchParams(location.search);
  const hasContext = params.has('clusterSlug') && params.has('subtopic');
  genericGallerySection.style.display = hasContext ? 'none' : '';
}

genericDismiss.addEventListener('click', () => {
  genericGallerySection.style.display = 'none';
});

genericFileInput.addEventListener('change', (e) => {
  for (const file of e.target.files) {
    uploadToGenericGallery(file);
  }
});

genericDropZone.addEventListener('click', () => {
  genericFileInput.click();
});
```

- [ ] **Step 4: Test visibility**

- Load index.html without query params → generic gallery section visible
- Load with `?clusterSlug=X&subtopic=Y` → section hidden

- [ ] **Step 5: Commit**

```bash
git add tools/photo-picker/public/index.html tools/photo-picker/public/style.css
git commit -m "photo-picker: add generic gallery section to upload page"
```

---

### Task 8: Add deep-link support to upload page

**Files:**
- Modify: `tools/photo-picker/public/app.js:1-100` (initialization and query param handling)

Parse URL query params to pre-fill category/cluster/subtopic and show context banner when deep-linking from gallery.

- [ ] **Step 1: Add deep-link detection and context handling at start of app.js**

After DOM refs, add:

```javascript
// Deep-link support from gallery
let deepLinkContext = null;

function parseDeepLink() {
  const params = new URLSearchParams(location.search);
  const microsite = params.get('microsite');
  const clusterSlug = params.get('clusterSlug');
  const subtopic = params.get('subtopic');

  if (microsite && clusterSlug && subtopic) {
    deepLinkContext = { microsite, clusterSlug, subtopic };
    return true;
  }
  return false;
}

function applyDeepLinkContext() {
  if (!deepLinkContext) return;

  const { microsite, clusterSlug, subtopic } = deepLinkContext;

  // Set microsite
  selectMicrosite.value = microsite;
  selectMicrosite.dispatchEvent(new Event('change'));

  // Set category to service-page
  selectCategory.value = 'service-page';
  selectCategory.dispatchEvent(new Event('change'));

  // Wait for service topics to load, then set cluster/subtopic
  setTimeout(async () => {
    // Find and set the cluster
    const clusterOption = Array.from(selectServiceCluster.options).find(
      opt => opt.value === clusterSlug
    );
    if (clusterOption) {
      selectServiceCluster.value = clusterSlug;
      selectServiceCluster.dispatchEvent(new Event('change'));

      // Set subtopic
      setTimeout(() => {
        const subtopicOption = Array.from(selectServiceSubtopic.options).find(
          opt => opt.value === subtopic
        );
        if (subtopicOption) {
          selectServiceSubtopic.value = subtopic;
        }
      }, 100);
    }
  }, 100);

  // Show context banner
  showDeepLinkContext();
  hideGenericGallery();
}

function showDeepLinkContext() {
  if (!deepLinkContext) return;
  const { clusterSlug, subtopic } = deepLinkContext;

  uploadContext.style.display = '';
  uploadContextLabel.textContent = `Uploading to: ${clusterSlug.replace(/-/g, ' ')} › ${subtopic}`;

  uploadContextDismiss.addEventListener('click', () => {
    deepLinkContext = null;
    uploadContext.style.display = 'none';
    window.history.replaceState({}, '', '/');
    location.reload(); // Simple way to reset — can be refined
  });
}

function hideGenericGallery() {
  genericGallerySection.style.display = 'none';
}
```

- [ ] **Step 2: Call parseDeepLink and applyDeepLinkContext in bindEvents()**

At the end of `bindEvents()`, before the closing brace, add:

```javascript
  // Handle deep-links from gallery
  if (parseDeepLink()) {
    applyDeepLinkContext();
  } else {
    showGenericGallery();
  }
}
```

- [ ] **Step 3: Test deep-linking**

- In gallery, click a card → navigates to `/?microsite=X&clusterSlug=Y&subtopic=Z`
- Context banner appears: "Uploading to: Y › Z"
- Dropdowns pre-filled with correct values
- Generic gallery section hidden

- [ ] **Step 4: Test context dismiss**

- Click "Change" button → banner hidden, generic gallery reappears, URL cleaned

- [ ] **Step 5: Commit**

```bash
git add tools/photo-picker/public/app.js
git commit -m "photo-picker: add deep-link support with context pre-fill and banner"
```

---

### Task 9: Wire drag-and-drop handlers for generic gallery and queue

**Files:**
- Modify: `tools/photo-picker/public/app.js`

Add drag-and-drop handlers to the generic gallery drop zone and queue area.

- [ ] **Step 1: Add generic gallery upload function**

Add before `bindEvents()`:

```javascript
async function uploadToGenericGallery(file) {
  if (!['image/jpeg', 'image/png'].includes(file.type)) {
    alert('Only JPG and PNG files supported');
    return;
  }

  if (file.size > 50 * 1024 * 1024) {
    alert('File too large (max 50MB)');
    return;
  }

  // Read file as base64
  const reader = new FileReader();
  reader.onload = async (e) => {
    const imageData = e.target.result.split(',')[1];
    const microsite = selectMicrosite.value;

    try {
      // Process image: resize 800×600, convert to WebP @75%
      const processRes = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageData,
          mimeType: file.type,
          options: { width: 800, height: 600, quality: 75, format: 'webp' }
        })
      });

      if (!processRes.ok) throw new Error('Processing failed');
      const processed = await processRes.json();

      // Upload via existing blob-manager (use gallery category)
      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageData: processed.imageData,
          mimeType: 'image/webp',
          filename: file.name.replace(/\.[^.]+$/, '.webp'),
          microsite,
          category: 'gallery' // Generic gallery category
        })
      });

      if (!uploadRes.ok) throw new Error('Upload failed');
      const result = await uploadRes.json();

      // Add to galleryImages in images.json
      await fetch('/api/write-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          microsite,
          category: 'gallery',
          url: result.url,
          filename: file.name
        })
      });

      // Add to UI grid
      const card = document.createElement('div');
      card.className = 'img-card';
      const filename = result.url.split('/').pop();
      card.innerHTML = `
        <img class="img-thumb" src="${result.url}" alt="" loading="lazy" />
        <div class="img-info">
          <div class="img-title">${file.name.replace(/\.[^.]+$/, '')}</div>
          <div class="img-filename">${filename}</div>
        </div>
      `;
      genericGalleryGrid.appendChild(card);

      // Show success
      genericDropZone.style.background = 'rgba(102, 255, 102, 0.1)';
      setTimeout(() => { genericDropZone.style.background = ''; }, 1000);
    } catch (err) {
      alert(`Upload failed: ${err.message}`);
    }
  };
  reader.readAsDataURL(file);
}
```

- [ ] **Step 2: Wire generic gallery drop zone**

In `bindEvents()`, add after showGenericGallery() call:

```javascript
  // Generic gallery drag-drop
  genericDropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    genericDropZone.classList.add('drag-over');
  });

  genericDropZone.addEventListener('dragleave', () => {
    genericDropZone.classList.remove('drag-over');
  });

  genericDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    genericDropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) uploadToGenericGallery(file);
  });
```

- [ ] **Step 3: Add queue area drag-drop (existing plus enhancement)**

The queue already accepts files. Add drag feedback:

```javascript
  // Queue area drag-drop enhancement (visual feedback only)
  queueList.addEventListener('dragover', (e) => {
    e.preventDefault();
    queueList.classList.add('drag-over');
  });

  queueList.addEventListener('dragleave', () => {
    queueList.classList.remove('drag-over');
  });

  queueList.addEventListener('drop', (e) => {
    // Delegate to existing file handling
    queueList.classList.remove('drag-over');
  });
```

- [ ] **Step 4: Test generic gallery drag-drop**

- Load index.html without query params
- Drag JPG/PNG onto drop zone
- Expected: Upload spinner, image processes, appears in grid

- [ ] **Step 5: Test queue drag-drop**

- Drag JPG/PNG onto queue list
- Expected: File added to queue (existing behavior)

- [ ] **Step 6: Commit**

```bash
git add tools/photo-picker/public/app.js
git commit -m "photo-picker: add drag-drop handlers for generic gallery and queue"
```

---

## Chunk 4: Testing & Integration

### Task 10: End-to-end testing and verification

**Files:**
- Test: Manual testing of all features across both pages

- [ ] **Step 1: Start the server**

```bash
cd tools/photo-picker
node server.js /path/to/photos
```

Should open http://localhost:3000 in browser.

- [ ] **Step 2: Test gallery page drag-drop**

Navigate to http://localhost:3000/gallery.html
- Select a microsite
- Verify subtopic sections appear under each cluster
- Drag a JPG/PNG onto an empty slot
- Expected:
  - Upload spinner appears
  - Image processes (resize, convert)
  - Card updates with new image
  - Subtopic label visible
  - images.json updated with clusterSlug/subtopic

Verify:
```bash
cat apps/deck-repair/src/data/images.json | jq '.servicePageImages[-1]' | grep -E 'clusterSlug|subtopic'
```

- [ ] **Step 3: Test gallery card click-to-edit**

- Click the newly uploaded image card in gallery
- Expected: Redirects to upload page with context banner
- Verify dropdowns are pre-filled:
  - Microsite = deck-repair
  - Category = service-page
  - Cluster = the clusterSlug
  - Subtopic = the subtopic

- [ ] **Step 4: Test generic gallery upload**

- On upload page, dismiss context banner (click "Change")
- Generic gallery section reappears
- Drag JPG/PNG onto drop zone
- Expected:
  - Image processes (resize, convert)
  - Appears in generic gallery grid
  - Saved to galleryImages (not servicePageImages)

Verify:
```bash
cat apps/deck-repair/src/data/images.json | jq '.galleryImages[-1]'
```

Should NOT have clusterSlug/subtopic.

- [ ] **Step 5: Test existing upload flow (no regression)**

- Upload page, set category to "hero"
- Select preset
- Choose a photo from queue
- Upload
- Expected: Existing flow works unchanged, saves to heroImages

- [ ] **Step 6: Test with different microsites**

- Repeat tests with crawlspace-rot, siding-repair, etc.
- Verify each has own images.json with correct cluster/subtopic grouping

- [ ] **Step 7: Test error cases**

- Drag a PDF file → should show error "Only JPG and PNG"
- Drag a file on wrong page context → should fail gracefully
- Test with large file → should show size error if > 50MB

- [ ] **Step 8: Commit test results**

No code changes needed. Verify all checkboxes above pass, then:

```bash
git status
# Should show clean working tree
```

---

## Completion Checklist

- [ ] Server gallery endpoint returns subtopic structure
- [ ] POST /api/upload-gallery-image endpoint works with auto-resize
- [ ] Gallery page shows subtopic hierarchy with 4-slot grids
- [ ] Drag-drop on gallery cards: upload, process, update UI
- [ ] Click gallery card: deep-link to upload page with context pre-filled
- [ ] Upload page shows generic gallery section when no context
- [ ] Upload page hides generic gallery when deep-linked
- [ ] Drag-drop on generic gallery: upload to galleryImages
- [ ] Drag-drop on queue: still works (no regression)
- [ ] Existing upload flows (hero, background, service-page with preset) unchanged
- [ ] images.json correctly stores clusterSlug/subtopic for service page uploads
- [ ] All files committed with clear messages
