# Photo Picker Gallery Organizer Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement drag-and-drop photo organization on photo-picker gallery page, enabling fast visual assignment of photos to service cluster subtopics, plus add drag-drop to upload tab.

**Architecture:** Two separate enhancements: (1) Gallery page becomes editable with expandable tree UI + drag-drop zones for each subtopic, reusing existing `/api/update-image` endpoint; (2) Upload page gains drag-drop file intake at the top.

**Tech Stack:** HTML5 Drag-Drop API, vanilla JS, existing Express endpoints

**Design Spec:** `docs/superpowers/specs/2026-03-17-photo-picker-gallery-organizer-design.md`

---

## File Structure

### New Files
- `tools/photo-picker/public/gallery.js` — Gallery page logic with drag-drop handlers

### Modified Files
- `tools/photo-picker/public/gallery.html` — Add expandable tree UI + drag zones
- `tools/photo-picker/public/style.css` — Add styles for tree, drag feedback, empty slots
- `tools/photo-picker/public/index.html` — Add drag-drop zone at top
- `tools/photo-picker/public/app.js` — Add drag-drop handlers for upload tab

---

## Chunk 1: Gallery Page Refactoring & Tree UI

### Task 1: Extract gallery script and add expandable tree

**Files:**
- Modify: `tools/photo-picker/public/gallery.html`
- Create: `tools/photo-picker/public/gallery.js`

- [ ] **Step 1: Create gallery.js with extracted + enhanced code**

Create new file `tools/photo-picker/public/gallery.js`:

```javascript
// public/gallery.js

async function init() {
  let config;
  try {
    const configRes = await fetch('/api/config');
    if (!configRes.ok) throw new Error(`Server error: ${configRes.status}`);
    config = await configRes.json();
  } catch (err) {
    document.getElementById('loading').textContent = `Failed to load: ${err.message}`;
    return;
  }

  const picker = document.getElementById('site-picker');
  config.microsites.forEach(({ key }) => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = key;
    picker.appendChild(opt);
  });

  const params = new URLSearchParams(location.search);
  const siteParam = params.get('site');
  if (siteParam && config.microsites.some(m => m.key === siteParam)) {
    picker.value = siteParam;
  }

  picker.addEventListener('change', () => loadGallery(picker.value));
  loadGallery(picker.value);
}

async function loadGallery(microsite) {
  const body = document.getElementById('gallery-body');
  const loading = document.getElementById('loading');
  loading.style.display = 'block';
  body.innerHTML = '';

  let data;
  try {
    const res = await fetch(`/api/gallery/${microsite}`);
    if (!res.ok) throw new Error(`Server error: ${res.status}`);
    data = await res.json();
  } catch (err) {
    loading.textContent = `Failed to load: ${err.message}`;
    return;
  }

  loading.style.display = 'none';

  // Build expandable tree
  data.clusters.forEach(cluster => {
    const clusterDiv = document.createElement('div');
    clusterDiv.className = 'cluster-section';

    const imageCount = (cluster.images || []).length;
    const clusterHeader = document.createElement('div');
    clusterHeader.className = 'cluster-header';
    clusterHeader.style.cursor = 'pointer';

    const toggle = document.createElement('span');
    toggle.className = 'cluster-toggle';
    toggle.textContent = '▼';
    toggle.style.marginRight = '8px';

    const title = document.createElement('span');
    title.className = 'cluster-title';
    title.textContent = cluster.title;

    const meta = document.createElement('span');
    meta.className = 'cluster-meta';
    meta.textContent = `${imageCount} image${imageCount !== 1 ? 's' : ''}`;

    clusterHeader.appendChild(toggle);
    clusterHeader.appendChild(title);
    clusterHeader.appendChild(meta);

    const clusterContent = document.createElement('div');
    clusterContent.className = 'cluster-content';

    // Group images by subtopic (description field)
    const imagesBySubtopic = {};
    if (cluster.images) {
      cluster.images.forEach(img => {
        const subtopic = img.description || 'Images';
        if (!imagesBySubtopic[subtopic]) imagesBySubtopic[subtopic] = [];
        imagesBySubtopic[subtopic].push(img);
      });
    }

    if (Object.keys(imagesBySubtopic).length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.style.padding = '16px';
      emptyMsg.style.color = '#888';
      emptyMsg.textContent = 'No images. Drag photos here to add them.';
      clusterContent.appendChild(emptyMsg);
    } else {
      Object.entries(imagesBySubtopic).forEach(([subtopic, images]) => {
        const subtopicDiv = document.createElement('div');
        subtopicDiv.className = 'subtopic-section';

        const label = document.createElement('div');
        label.className = 'subtopic-label';
        label.textContent = subtopic;

        const grid = document.createElement('div');
        grid.className = 'image-grid';

        images.forEach(img => {
          const card = document.createElement('div');
          card.className = 'image-card';
          card.innerHTML = `<img src="${img.url}" alt="" class="image-thumb" /><button class="image-remove">×</button>`;
          grid.appendChild(card);
        });

        // Add empty slots for drag-drop
        const slotsNeeded = Math.max(4 - images.length, 0);
        for (let i = 0; i < slotsNeeded; i++) {
          const slot = document.createElement('div');
          slot.className = 'empty-slot';
          slot.dataset.clusterSlug = cluster.clusterSlug;
          slot.dataset.subtopic = subtopic;
          slot.dataset.microsite = microsite;
          slot.innerHTML = '<div class="empty-slot-content"><div class="empty-slot-icon">+</div><div class="empty-slot-text">Drop</div></div>';
          grid.appendChild(slot);
        }

        subtopicDiv.appendChild(label);
        subtopicDiv.appendChild(grid);
        clusterContent.appendChild(subtopicDiv);
      });
    }

    clusterHeader.addEventListener('click', () => {
      const visible = clusterContent.style.display !== 'none';
      clusterContent.style.display = visible ? 'none' : 'block';
      toggle.textContent = visible ? '▶' : '▼';
    });

    clusterDiv.appendChild(clusterHeader);
    clusterDiv.appendChild(clusterContent);
    body.appendChild(clusterDiv);
  });

  setupDragDrop(microsite);
}

function setupDragDrop(microsite) {
  const slots = document.querySelectorAll('.empty-slot');

  slots.forEach(slot => {
    ['dragover', 'dragenter'].forEach(eventName => {
      slot.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        slot.classList.add('drag-over');
      });
    });

    slot.addEventListener('dragleave', (e) => {
      e.preventDefault();
      slot.classList.remove('drag-over');
    });

    slot.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      slot.classList.remove('drag-over');
      handlePhotoDrop(e, slot, microsite);
    });
  });
}

async function handlePhotoDrop(event, slot, microsite) {
  const files = event.dataTransfer.files;
  if (files.length === 0) return;

  const file = files[0];
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
    alert('Please drop an image file');
    return;
  }

  slot.innerHTML = '<div style="padding: 8px; text-align: center; color: #888;">Uploading...</div>';

  try {
    const base64 = await fileToBase64(file);
    const clusterSlug = slot.dataset.clusterSlug;
    const subtopic = slot.dataset.subtopic;

    // Upload
    const uploadRes = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageData: base64,
        mimeType: file.type || 'image/jpeg',
        filename: file.name,
        microsite: microsite,
        category: 'service-page'
      })
    });

    if (!uploadRes.ok) throw new Error('Upload failed');
    const { url } = await uploadRes.json();

    // Assign
    const assignRes = await fetch('/api/update-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        microsite: microsite,
        imageUrl: url,
        clusterSlug: clusterSlug,
        subtopic: subtopic,
        title: titleFromSlug(clusterSlug)
      })
    });

    if (!assignRes.ok) throw new Error('Assignment failed');

    // Show image
    const card = document.createElement('div');
    card.className = 'image-card';
    card.innerHTML = `<img src="${url}" alt="" class="image-thumb" /><button class="image-remove">×</button>`;
    slot.replaceWith(card);

  } catch (err) {
    alert('Error: ' + err.message);
    // Reload to reset
    setTimeout(() => loadGallery(microsite), 1500);
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function titleFromSlug(slug) {
  return slug.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
}

init();
```

- [ ] **Step 2: Update gallery.html to load external script**

Replace the inline `<script>` block (lines 76-174) with:

```html
  <script src="gallery.js"></script>
```

- [ ] **Step 3: Test gallery loads**

Start server: `node server.js`
Open: `http://localhost:3000/gallery.html`

Expected: Gallery shows clusters, can expand/collapse, no drag-drop yet

- [ ] **Step 4: Commit**

```bash
git add -f public/gallery.html public/gallery.js
git commit -m "refactor: extract gallery logic to separate file with expandable tree"
```

---

## Chunk 2: CSS Styles & Drag-Drop Styling

### Task 2: Add CSS for tree and drag-drop

**Files:**
- Modify: `tools/photo-picker/public/style.css`

- [ ] **Step 1: Append gallery tree styles**

Add to end of `public/style.css`:

```css
/* Gallery tree structure */
.cluster-section {
  margin-bottom: 24px;
  border: 1px solid #222;
  border-radius: 6px;
  overflow: hidden;
}

.cluster-header {
  background: #0f0f0f;
  padding: 12px 16px;
  border-bottom: 1px solid #222;
  font-size: 14px;
  font-weight: 600;
  color: #ccc;
  user-select: none;
  display: flex;
  gap: 12px;
  align-items: center;
}

.cluster-header:hover {
  background: #1a1a1a;
}

.cluster-title {
  flex: 1;
}

.cluster-meta {
  font-size: 12px;
  color: #666;
}

.cluster-content {
  padding: 16px;
  background: #0a0a0a;
}

.subtopic-section {
  margin-bottom: 20px;
}

.subtopic-label {
  font-size: 12px;
  font-weight: 600;
  color: #999;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #1a1a1a;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.image-card {
  aspect-ratio: 4/3;
  position: relative;
  border: 1px solid #333;
  border-radius: 4px;
  overflow: hidden;
  background: #1a1a1a;
}

.image-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.image-remove {
  position: absolute;
  top: 4px;
  right: 4px;
  background: rgba(0, 0, 0, 0.7);
  border: none;
  color: #f44;
  font-size: 16px;
  padding: 2px 6px;
  border-radius: 3px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s;
}

.image-card:hover .image-remove {
  opacity: 1;
}

.empty-slot {
  aspect-ratio: 4/3;
  border: 2px dashed #333;
  border-radius: 4px;
  background: #0a0a0a;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.empty-slot:hover {
  border-color: #4a9eff;
  background: #0d1a2e;
}

.empty-slot-icon {
  font-size: 24px;
  color: #444;
}

.empty-slot-text {
  font-size: 11px;
  color: #666;
  margin-top: 4px;
}

.empty-slot:hover .empty-slot-icon {
  color: #4a9eff;
}

.empty-slot:hover .empty-slot-text {
  color: #4a9eff;
}

.empty-slot.drag-over {
  border-color: #4a9eff;
  background: #1a2a4a;
  box-shadow: 0 0 0 2px #4a9eff;
}

.empty-slot-content {
  text-align: center;
  pointer-events: none;
}
```

- [ ] **Step 2: Test styles**

Refresh gallery page. Expected: Tree shows with proper colors and layout

- [ ] **Step 3: Commit**

```bash
git add -f public/style.css
git commit -m "style: add gallery tree and drag-drop zone styling"
```

---

## Chunk 3: Upload Tab Drag-Drop

### Task 3: Add drag-drop zone to upload page

**Files:**
- Modify: `tools/photo-picker/public/index.html`
- Modify: `tools/photo-picker/public/app.js`

- [ ] **Step 1: Add drop zone HTML to index.html**

Find the `<main id="editor-panel">` line. Insert before it:

```html
    <!-- Drag-drop upload zone -->
    <div id="upload-drop-zone" class="upload-drop-zone">
      <div class="drop-zone-icon">⬇</div>
      <div class="drop-zone-text">Drag images here</div>
    </div>

```

- [ ] **Step 2: Add drop zone styles to style.css**

Append:

```css
/* Upload tab drop zone */
.upload-drop-zone {
  padding: 32px 20px;
  margin-bottom: 16px;
  border: 2px dashed #333;
  border-radius: 6px;
  background: #0a0a0a;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
}

.upload-drop-zone:hover {
  border-color: #4a9eff;
  background: #0d1a2e;
}

.upload-drop-zone.drag-over {
  border-color: #4a9eff;
  background: #1a2a4a;
  box-shadow: 0 0 0 2px #4a9eff;
}

.drop-zone-icon {
  font-size: 28px;
  color: #444;
  margin-bottom: 8px;
}

.drop-zone-text {
  font-size: 13px;
  color: #888;
}

.upload-drop-zone:hover .drop-zone-icon {
  color: #4a9eff;
}

.upload-drop-zone:hover .drop-zone-text {
  color: #4a9eff;
}
```

- [ ] **Step 3: Add drag-drop handler to app.js**

Find the `function bindEvents()` section. At the very end (before final `}`), add:

```javascript
  // Upload drop zone
  const dropZone = document.getElementById('upload-drop-zone');

  ['dragover', 'dragenter'].forEach(evt => {
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('drag-over');
    });
  });

  dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('drag-over');

    const files = e.dataTransfer.files;
    Array.from(files).forEach(file => {
      if (['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
        // Add file to queue — store both name and file object
        photos.push(file.name);
      }
    });

    if (photos.length > 0) {
      updateQueueDisplay();
      if (currentIndex < 0) {
        currentIndex = 0;
        updatePhotoDisplay();
      }
    }
  });
```

- [ ] **Step 4: Test upload zone**

Refresh upload page. Drag image on drop zone. Expected: Visual feedback on hover + drop

- [ ] **Step 5: Commit**

```bash
git add -f public/index.html public/app.js public/style.css
git commit -m "feat: add drag-drop zone to upload tab"
```

---

## Chunk 4: End-to-End Testing

### Task 4: Test full drag-drop workflow

- [ ] **Step 1: Start server**

```bash
cd tools/photo-picker
node server.js /path/to/test/photos
```

- [ ] **Step 2: Test gallery drag-drop**

1. Open `http://localhost:3000/gallery.html?site=deck-repair`
2. Expand a cluster
3. Drag an image file from file system
4. Drop on an empty slot
5. Expected: Spinner → image appears
6. Check `apps/deck-repair/src/data/images.json` updated with correct subtopic in description field

- [ ] **Step 3: Test upload tab**

1. Open `http://localhost:3000/`
2. Drag image onto drop zone at top
3. Expected: Visual feedback, file added to queue

- [ ] **Step 4: Verify no regressions**

1. Existing gallery read-only view still works
2. Upload workflow still works with dropdowns
3. `/coverage.html` still loads

- [ ] **Step 5: Commit test results**

```bash
git add -A
git commit -m "test: verify drag-drop functionality end-to-end"
```

---

## Completion Checklist

- ✅ Gallery page shows expandable cluster tree
- ✅ Can drag image file → drop on empty slot → auto-uploads + assigns
- ✅ Image appears in grid immediately after drop
- ✅ `images.json` updated with subtopic in description field
- ✅ Upload tab has drag-drop zone for general file intake
- ✅ No breaking changes to existing pages/endpoints
- ✅ All changes committed

---

## Next Steps (Phase 2)

- [ ] Create cleanup task to backfill empty descriptions in existing images.json files
- [ ] Run against all 11 microsites
- [ ] Enhance: add ability to remove images by clicking × button
- [ ] Enhance: support drag-drop multiple files at once

