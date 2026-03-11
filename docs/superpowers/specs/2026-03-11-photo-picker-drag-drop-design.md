# Photo Picker: Drag-and-Drop + Subtopic Gallery Grid

**Date:** 2026-03-11
**Status:** Design Complete
**Goal:** Add drag-and-drop file upload and reorganize gallery view to show subtopic hierarchy with interactive upload cards.

---

## Overview

Users will be able to:
1. **Drag JPG/PNG files** from desktop onto gallery cards or upload zones
2. **Auto-resize images** to 800×600px, convert to WebP @75% quality
3. **Upload directly** to specific cluster/subtopic slots in the gallery
4. **View subtopic hierarchy** in gallery (cluster → subtopic → images)
5. **Deep-link from gallery** to upload page with context pre-filled

---

## 1. Data Structure Changes

### Update `servicePageImages` format in images.json

**Before:**
```json
{
  "servicePageImages": [
    { "title": "...", "description": "...", "image": "...", "href": "..." }
  ]
}
```

**After:**
```json
{
  "servicePageImages": [
    {
      "clusterSlug": "roof-to-wall-penetration-flashing",
      "subtopic": "Installation & Setup",
      "title": "Flashing installed",
      "description": "Professional installation",
      "image": "https://blob.url/image.webp",
      "href": "/roof-to-wall-penetration-flashing"
    }
  ]
}
```

**Rationale:** Adding `clusterSlug` and `subtopic` allows the gallery to organize and group images, and lets the upload endpoint know which slot a drag-dropped image belongs to.

---

## 2. Server API Changes

### A. Extend `/api/gallery/:microsite` endpoint

**New response format:**

```json
{
  "microsite": "deck-repair",
  "clusters": [
    {
      "clusterSlug": "roof-to-wall-penetration-flashing",
      "title": "Roof to Wall Penetration Flashing",
      "subtopics": [
        {
          "subtopic": "Installation & Setup",
          "images": [
            {
              "url": "https://blob.url/image.webp",
              "title": "Flashing installed",
              "isHero": false,
              "isHeaderTexture": false
            }
          ],
          "totalSlots": 4
        },
        {
          "subtopic": "Common Issues",
          "images": [],
          "totalSlots": 4
        }
      ]
    }
  ]
}
```

**Changes:**
- Group images by subtopic within each cluster
- Include `totalSlots` (fixed at 4 per subtopic for now)
- Empty subtopics have `images: []`

**Implementation:**
- Parse `clusterSlug` and `subtopic` from servicePageImages
- Organize by (clusterSlug, subtopic) tuple
- Maintain the deduplication logic (portland/seattle same image)

### B. New `/api/upload-gallery-image` endpoint

**Request:**
```json
{
  "microsite": "deck-repair",
  "clusterSlug": "roof-to-wall-penetration-flashing",
  "subtopic": "Installation & Setup",
  "imageData": "<base64>",
  "filename": "flashing_install.jpg"
}
```

**Process:**
1. Decode base64 image
2. Resize to 800×600px (fit inside, no enlargement)
3. Convert to WebP @75% quality
4. Upload via BlobClient with category=`service-page`
5. Append to servicePageImages with clusterSlug/subtopic metadata
6. Return: `{ url, title, description }`

**Response:**
```json
{
  "url": "https://blob.url/flashing_install.webp",
  "title": "",
  "description": ""
}
```

**Error handling:**
- Invalid microsite → 400
- Invalid clusterSlug/subtopic → 400
- File too large → 413
- Processing error → 500

---

## 3. Gallery View Changes (gallery.html)

### Layout Structure

```
Tab navigation
↓
Page header: "Gallery by Service" + site picker
↓
For each cluster:
  Cluster title + image count
  ↓
  For each subtopic:
    Subtopic name (as section header or group label)
    ↓
    4-slot grid:
      - Filled slots: image card with thumbnail + title + subtopic label
      - Empty slots: drag-drop upload card
```

### Card Styling

**Filled image cards:**
- Thumbnail: 160×120px (4:3 aspect)
- Title: 11px, truncated
- Subtitle (subtopic): 10px, gray, italicized
- Border: 1px solid #222 (or highlighted color if hero/texture)
- Hover: slightly brighter background

**Empty upload cards:**
- Dashed border (1px #252525)
- "+" icon (22px, gray)
- Text: "Drop JPG/PNG here" or "Upload"
- Hover: blue border, blue highlight background
- Drag-over state: stronger blue highlight, "Release to upload" hint

### Interaction Handlers

**Click any filled card:**
- Extract: `microsite`, `clusterSlug`, `subtopic`, `imageUrl`
- Navigate to: `/?microsite=X&clusterSlug=Y&subtopic=Z`
- Upload page opens with context banner and dropdowns pre-filled

**Drag over any card (filled or empty):**
- Show visual feedback: border highlight, "drop zone active" state
- Accept: image files (JPG, PNG)

**Drop on card:**
- Start upload: show spinner overlay on card
- Auto-resize to 800×600px, convert to WebP @75%
- POST to `/api/upload-gallery-image` with cluster/subtopic metadata
- On success: update card with new image, remove spinner
- On error: show error toast, keep old image (or empty state)

---

## 4. Upload View Changes (index.html)

### Generic Gallery Zone

**New section at top of upload page** (before existing upload options):

```html
<div id="generic-gallery-section">
  <h2>Generic Gallery</h2>
  <p>Drag JPG/PNG images here for non-service-page galleries</p>
  <div id="generic-gallery-drop-zone" class="drop-zone">
    (empty grid showing 4 slots, drag-drop enabled)
  </div>
</div>
```

**Behavior:**
- Auto-resize to 800×600px, convert to WebP @75%
- Save to `galleryImages` array (not servicePageImages)
- No cluster/subtopic association

### Deep-Link Support

**Query parameters:**
```
/?microsite=deck-repair&clusterSlug=roof-to-wall&subtopic=Installation%20%26%20Setup
```

**On page load:**
1. Parse URL params
2. If all three present: set category to "service-page"
3. Pre-populate selectMicrosite, selectServiceCluster, selectServiceSubtopic
4. Show context banner: "Editing [Cluster] › [Subtopic]"
5. Disable category/cluster/subtopic change until dismissed
6. Any upload goes directly to that slot

**Context banner:**
```html
<div id="upload-context">
  <span>Uploading to: Roof to Wall › Installation & Setup</span>
  <button id="context-dismiss">Change</button>
</div>
```

### Drag-and-Drop on Upload Page

**Main upload area (existing):**
- Accept files dragged onto the page
- Same behavior as button click: file added to queue

**Queue area:**
- Already supports file selection; enhance to accept drops

---

## 5. Drag-and-Drop Implementation

### Common Processing Logic

```javascript
// Handle file drop (gallery and upload page)
async function processDroppedImage(file, target) {
  // Validation
  if (!['image/jpeg', 'image/png'].includes(file.type)) {
    showError('Only JPG and PNG files supported');
    return;
  }

  if (file.size > 50 * 1024 * 1024) {
    showError('File too large (max 50MB)');
    return;
  }

  // Read file as base64
  const reader = new FileReader();
  reader.onload = async (e) => {
    const imageData = e.target.result.split(',')[1];

    // Determine target
    if (target.type === 'gallery-card') {
      // Gallery upload: auto-resize 800×600, convert to WebP @75%
      const processed = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageData,
          mimeType: file.type,
          options: { width: 800, height: 600, quality: 75, format: 'webp' }
        })
      }).then(r => r.json());

      // Upload to gallery
      const result = await fetch('/api/upload-gallery-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          microsite: target.microsite,
          clusterSlug: target.clusterSlug,
          subtopic: target.subtopic,
          imageData: processed.imageData,
          filename: file.name
        })
      }).then(r => r.json());

      // Update UI
      updateCard(target, result.url);
    } else if (target.type === 'generic-gallery') {
      // Generic gallery: same process, save to galleryImages
      // ...
    } else if (target.type === 'queue') {
      // Queue: add to file list for existing upload flow
      // ...
    }
  };
  reader.readAsDataURL(file);
}
```

### Event Binding

**Gallery page:**
```javascript
// Each card (filled or empty)
card.addEventListener('dragover', (e) => {
  e.preventDefault();
  card.classList.add('drag-over');
});

card.addEventListener('dragleave', () => {
  card.classList.remove('drag-over');
});

card.addEventListener('drop', (e) => {
  e.preventDefault();
  card.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  processDroppedImage(file, {
    type: 'gallery-card',
    microsite: card.dataset.microsite,
    clusterSlug: card.dataset.clusterSlug,
    subtopic: card.dataset.subtopic
  });
});
```

**Upload page:**
```javascript
// Generic gallery drop zone
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  processDroppedImage(file, { type: 'generic-gallery', microsite: selectMicrosite.value });
});

// Whole window fallback (accept drops on page body)
document.addEventListener('dragover', (e) => {
  if (e.target !== dropZone) e.preventDefault();
});

document.addEventListener('drop', (e) => {
  e.preventDefault();
  // Route to appropriate handler based on page
});
```

---

## 6. Implementation Tasks

1. **Server: Update gallery API endpoint** — reorganize response with subtopic structure
2. **Server: Add upload-gallery-image endpoint** — process and save with metadata
3. **Server: Update write-images logic** — preserve clusterSlug/subtopic when saving
4. **Gallery view: Refactor layout** — subtopic-based grouping + styling
5. **Gallery view: Wire drag-and-drop handlers** — process, auto-resize, upload
6. **Upload page: Add generic gallery section** — grid + drop zone
7. **Upload page: Add deep-link support** — parse params, pre-fill, context banner
8. **Upload page: Wire drag-and-drop handlers** — queue integration + generic gallery
9. **Testing:** End-to-end drag-drop in both views, verify metadata saves correctly

---

## 7. Success Criteria

- [ ] Can drag JPG/PNG from desktop onto gallery cards
- [ ] Image auto-resizes to 800×600px, converts to WebP @75%
- [ ] Gallery updates immediately after drop
- [ ] Subtopic labels visible under images
- [ ] Empty slots visible for all subtopics in cluster
- [ ] Click card opens upload view with context pre-filled
- [ ] Generic gallery section on upload page accepts drops
- [ ] Images saved to images.json with clusterSlug/subtopic metadata
- [ ] No regression to existing upload flow (hero, background, service-page with presets)

---

## 8. Files to Modify

- `tools/photo-picker/server.js` — new endpoints, update gallery logic
- `tools/photo-picker/public/gallery.html` — refactor layout, add drag handlers
- `tools/photo-picker/public/app.js` — generic gallery, deep-link support, drag handlers
- `tools/photo-picker/public/style.css` — new styles for subtopic sections, drop zones, drag-over states
