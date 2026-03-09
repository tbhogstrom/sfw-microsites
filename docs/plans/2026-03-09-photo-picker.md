# Photo Picker Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a local web app that lets you review a folder of photos, edit them (crop/rotate/flip/brightness via Tui Image Editor), apply Sharp resize presets + WebP/compression, and upload directly to the correct Vercel Blob store for any of the 11 microsites.

**Architecture:** Express server at `tools/photo-picker/server.js` serves a three-panel UI and four API endpoints. The browser handles visual editing via Tui Image Editor (CDN); the server handles image processing via Sharp and uploads via the existing `BlobClient` from `blob-manager`. No build step — pure HTML/CSS/JS served statically.

**Tech Stack:** Node.js, Express, Sharp, Tui Image Editor (CDN), `@vercel/blob` (via blob-manager's BlobClient), dotenv

**Design doc:** `docs/plans/2026-03-09-photo-picker-design.md`

---

## Context You Need

- This tool lives at `tools/photo-picker/` alongside `tools/blob-manager/`
- It imports `BlobClient` from `../blob-manager/src/blob-client.js` and reads `../blob-manager/config.json` — do not duplicate these
- Tokens live in `tools/blob-manager/.env` — copy that path when loading dotenv
- The 11 microsites and 9 image categories are defined in `tools/blob-manager/config.json`
- Run `node tools/photo-picker/server.js /absolute/path/to/photos` to launch
- The server opens `http://localhost:3000` automatically in the browser

---

### Task 1: Project scaffold

**Files:**
- Create: `tools/photo-picker/package.json`
- Create: `tools/photo-picker/public/.gitkeep`

**Step 1: Create the package.json**

```json
{
  "name": "photo-picker",
  "version": "1.0.0",
  "description": "Local web UI for reviewing and uploading photos to microsite blob storage",
  "type": "module",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.19.2",
    "sharp": "^0.33.4",
    "open": "^10.1.0"
  }
}
```

**Step 2: Install dependencies**

```bash
cd tools/photo-picker
npm install
```

Expected: `node_modules/` created with express, sharp, open installed.

**Step 3: Create the public directory**

```bash
mkdir -p tools/photo-picker/public
```

**Step 4: Commit**

```bash
git add tools/photo-picker/package.json tools/photo-picker/package-lock.json
git commit -m "photo-picker: scaffold project with express, sharp, open"
```

---

### Task 2: Resize presets

**Files:**
- Create: `tools/photo-picker/presets.js`

**Step 1: Create presets.js**

```js
// Resize presets keyed by image category (from blob-manager/config.json)
// Sharp uses fit: 'inside' — scales down to fit without cropping or distorting
export const presets = {
  'hero':         { width: 1440, height: 810,  label: 'Hero — 1440×810' },
  'gallery':      { width: 800,  height: 600,  label: 'Gallery — 800×600' },
  'before-after': { width: 1000, height: 667,  label: 'Before/After — 1000×667' },
  'completed':    { width: 1000, height: 667,  label: 'Completed — 1000×667' },
  'damage':       { width: 800,  height: 600,  label: 'Damage — 800×600' },
  'process':      { width: 800,  height: 600,  label: 'Process — 800×600' },
  'repair':       { width: 800,  height: 600,  label: 'Repair — 800×600' },
  'team':         { width: 600,  height: 800,  label: 'Team — 600×800' },
  'equipment':    { width: 800,  height: 600,  label: 'Equipment — 800×600' },
};

export default presets;
```

**Step 2: Verify it loads**

```bash
cd tools/photo-picker
node -e "import('./presets.js').then(m => console.log(Object.keys(m.presets)))"
```

Expected output:
```
['hero', 'gallery', 'before-after', 'completed', 'damage', 'process', 'repair', 'team', 'equipment']
```

**Step 3: Commit**

```bash
git add tools/photo-picker/presets.js
git commit -m "photo-picker: add resize presets per image category"
```

---

### Task 3: Express server + photo-serving API

**Files:**
- Create: `tools/photo-picker/server.js`

This task covers: startup, static file serving, `GET /api/photos`, and `GET /api/photos/:file`.

**Step 1: Create server.js**

```js
#!/usr/bin/env node
import express from 'express';
import { readdir } from 'fs/promises';
import { resolve, extname, join, dirname } from 'path';
import { fileURLToPath } from 'url';
import open from 'open';

const __dirname = dirname(fileURLToPath(import.meta.url));

// The photos folder is the first CLI arg
const photosDir = resolve(process.argv[2] || '.');

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.static(join(__dirname, 'public')));

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

const PORT = 3000;
app.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`Photo Picker running at ${url}`);
  console.log(`Photos folder: ${photosDir}`);
  open(url);
});

export { app };
```

**Step 2: Smoke-test with a real photos folder**

```bash
cd tools/photo-picker
node server.js /path/to/some/photos
```

Expected: Terminal prints URL + folder path. Browser opens to localhost:3000 (shows 404 on index.html for now — that's fine, the public/ files don't exist yet). Verify the API works:

```bash
curl http://localhost:3000/api/photos
```

Expected: `{"photos":["photo1.jpg","photo2.jpg",...],"dir":"/path/to/photos"}`

**Step 3: Commit**

```bash
git add tools/photo-picker/server.js
git commit -m "photo-picker: add express server with photo listing and file serving"
```

---

### Task 4: Process API endpoint (Sharp)

**Files:**
- Modify: `tools/photo-picker/server.js`

Add the `POST /api/process` endpoint. It receives a base64-encoded image + processing options and returns a processed base64-encoded image.

**Step 1: Add the process endpoint to server.js**

Add this import at the top of server.js (after existing imports):

```js
import sharp from 'sharp';
import { presets } from './presets.js';
```

Add this route before `app.listen`:

```js
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
```

**Step 2: Test the process endpoint**

Grab any jpg on your machine and test:

```bash
# Encode a test image as base64 and POST it
node -e "
import { readFile } from 'fs/promises';
const buf = await readFile('/path/to/test.jpg');
const body = JSON.stringify({ imageData: buf.toString('base64'), mimeType: 'image/jpeg', options: { width: 800, height: 600, quality: 80, format: 'webp' } });
const res = await fetch('http://localhost:3000/api/process', { method: 'POST', headers: {'Content-Type':'application/json'}, body });
const data = await res.json();
console.log('output mimeType:', data.mimeType, 'size:', data.imageData.length);
"
```

Expected: prints `output mimeType: image/webp size: <some number>`

**Step 3: Commit**

```bash
git add tools/photo-picker/server.js
git commit -m "photo-picker: add Sharp process endpoint (resize, compress, WebP)"
```

---

### Task 5: Upload API endpoint

**Files:**
- Modify: `tools/photo-picker/server.js`

Add `POST /api/upload`. It receives a processed base64 image + microsite/category/filename and uploads via BlobClient.

**Step 1: Add imports at the top of server.js**

```js
import { readFile } from 'fs/promises';
import { createReadStream } from 'fs';
import { Readable } from 'stream';
import dotenv from 'dotenv';
import { BlobClient } from '../blob-manager/src/blob-client.js';
```

Also load the blob-manager config and .env. Add near the top after imports:

```js
// Load blob-manager config and tokens
dotenv.config({ path: resolve(__dirname, '../blob-manager/.env') });
const blobConfig = JSON.parse(
  await readFile(resolve(__dirname, '../blob-manager/config.json'), 'utf-8')
);
```

**Step 2: Add the upload route before app.listen**

```js
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
    const { writeFile, unlink } = await import('fs/promises');
    const tmpPath = join(tmpdir(), finalFilename);
    await writeFile(tmpPath, Buffer.from(imageData, 'base64'));

    const client = new BlobClient(microsite, blobConfig);
    const result = await client.upload(tmpPath, { category });

    // Clean up temp file
    await unlink(tmpPath);

    res.json({ url: result.url, pathname: result.pathname, size: result.size });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

**Step 3: Verify server still starts**

```bash
cd tools/photo-picker
node server.js /path/to/photos
```

Expected: starts without errors. The upload endpoint won't fully work until `.env` tokens are set, but it should not crash on startup.

**Step 4: Commit**

```bash
git add tools/photo-picker/server.js
git commit -m "photo-picker: add upload endpoint via BlobClient"
```

---

### Task 6: HTML shell + three-panel layout

**Files:**
- Create: `tools/photo-picker/public/index.html`
- Create: `tools/photo-picker/public/style.css`

**Step 1: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Photo Picker</title>
  <link rel="stylesheet" href="https://uicdn.toast.com/editor/latest/toastui-image-editor.min.css" />
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <div id="app">
    <!-- Left: Queue -->
    <aside id="queue-panel">
      <div id="queue-header">
        <span id="queue-count">0 photos</span>
      </div>
      <div id="queue-list"></div>
    </aside>

    <!-- Center: Editor -->
    <main id="editor-panel">
      <div id="tui-editor"></div>
      <div id="editor-nav">
        <button id="btn-prev">← Prev</button>
        <span id="editor-position"></span>
        <button id="btn-next">Next →</button>
      </div>
    </main>

    <!-- Right: Upload Options -->
    <aside id="options-panel">
      <h2>Upload Options</h2>

      <label>Microsite
        <select id="select-microsite"></select>
      </label>

      <label>Category
        <select id="select-category"></select>
      </label>

      <label>Resize Preset
        <select id="select-preset"></select>
      </label>

      <div id="manual-dimensions">
        <label>Width <input type="number" id="input-width" placeholder="px" /></label>
        <label>Height <input type="number" id="input-height" placeholder="px" /></label>
      </div>

      <label>Quality: <span id="quality-value">85</span>%
        <input type="range" id="input-quality" min="60" max="100" value="85" />
      </label>

      <fieldset>
        <legend>Format</legend>
        <label><input type="radio" name="format" value="keep" checked /> Keep original</label>
        <label><input type="radio" name="format" value="webp" /> Convert to WebP</label>
      </fieldset>

      <div id="action-buttons">
        <button id="btn-skip">Skip</button>
        <button id="btn-upload">Upload</button>
      </div>

      <div id="upload-result"></div>
    </aside>
  </div>

  <script src="https://uicdn.toast.com/editor/latest/toastui-image-editor.min.js"></script>
  <script src="app.js" type="module"></script>
</body>
</html>
```

**Step 2: Create style.css**

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: system-ui, sans-serif;
  font-size: 14px;
  background: #1a1a1a;
  color: #e0e0e0;
  height: 100vh;
  overflow: hidden;
}

#app {
  display: grid;
  grid-template-columns: 180px 1fr 220px;
  height: 100vh;
}

/* Queue panel */
#queue-panel {
  background: #111;
  border-right: 1px solid #333;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

#queue-header {
  padding: 10px 12px;
  font-size: 12px;
  color: #888;
  border-bottom: 1px solid #333;
}

#queue-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.queue-item {
  position: relative;
  cursor: pointer;
  border-radius: 4px;
  overflow: hidden;
  border: 2px solid transparent;
  aspect-ratio: 4/3;
  background: #222;
}

.queue-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.queue-item.active { border-color: #4a9eff; }
.queue-item.uploaded::after { content: '✓'; position: absolute; top: 4px; right: 4px; background: #22c55e; color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 12px; }
.queue-item.skipped::after { content: '✕'; position: absolute; top: 4px; right: 4px; background: #555; color: #aaa; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 12px; }

/* Editor panel */
#editor-panel {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

#tui-editor {
  flex: 1;
  min-height: 0;
}

#editor-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: #111;
  border-top: 1px solid #333;
}

#editor-nav button {
  background: #333;
  color: #e0e0e0;
  border: none;
  padding: 6px 14px;
  border-radius: 4px;
  cursor: pointer;
}

#editor-nav button:hover { background: #444; }
#editor-position { color: #888; font-size: 12px; }

/* Options panel */
#options-panel {
  background: #111;
  border-left: 1px solid #333;
  padding: 16px 12px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

#options-panel h2 {
  font-size: 13px;
  font-weight: 600;
  color: #aaa;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

#options-panel label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: #aaa;
}

#options-panel select,
#options-panel input[type="number"] {
  background: #222;
  color: #e0e0e0;
  border: 1px solid #444;
  border-radius: 4px;
  padding: 5px 8px;
  font-size: 13px;
  width: 100%;
}

#manual-dimensions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

#options-panel input[type="range"] {
  width: 100%;
  margin-top: 4px;
}

fieldset {
  border: 1px solid #333;
  border-radius: 4px;
  padding: 8px 10px;
}

fieldset legend {
  font-size: 12px;
  color: #aaa;
  padding: 0 4px;
}

fieldset label {
  flex-direction: row;
  align-items: center;
  gap: 6px;
  color: #ccc;
  padding: 2px 0;
}

#action-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 4px;
}

#btn-skip {
  background: #333;
  color: #aaa;
  border: none;
  padding: 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

#btn-upload {
  background: #4a9eff;
  color: white;
  border: none;
  padding: 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
}

#btn-skip:hover { background: #444; }
#btn-upload:hover { background: #3a8eef; }
#btn-upload:disabled { background: #2a4a6e; color: #789; cursor: not-allowed; }

#upload-result {
  font-size: 11px;
  word-break: break-all;
  color: #888;
  min-height: 20px;
}

#upload-result.success { color: #22c55e; }
#upload-result.error { color: #ef4444; }
```

**Step 3: Open browser and verify layout renders**

Start server, open browser. You should see the three-panel dark layout. Queue will be empty, editor blank. No JS errors in console (app.js doesn't exist yet — that's fine, browser will 404 it).

**Step 4: Commit**

```bash
git add tools/photo-picker/public/index.html tools/photo-picker/public/style.css
git commit -m "photo-picker: add three-panel HTML layout and styles"
```

---

### Task 7: Browser JavaScript (app.js)

**Files:**
- Create: `tools/photo-picker/public/app.js`

This is the main browser logic: load photos into the queue, initialize Tui Image Editor, wire up all controls.

**Step 1: Create app.js**

```js
// Photo Picker — browser app
// Tui Image Editor is loaded globally as `tui.ImageEditor` via CDN script tag

const PRESETS = {
  'hero':         { width: 1440, height: 810 },
  'gallery':      { width: 800,  height: 600 },
  'before-after': { width: 1000, height: 667 },
  'completed':    { width: 1000, height: 667 },
  'damage':       { width: 800,  height: 600 },
  'process':      { width: 800,  height: 600 },
  'repair':       { width: 800,  height: 600 },
  'team':         { width: 600,  height: 800 },
  'equipment':    { width: 800,  height: 600 },
};

const PRESET_LABELS = {
  'hero':         'Hero — 1440×810',
  'gallery':      'Gallery — 800×600',
  'before-after': 'Before/After — 1000×667',
  'completed':    'Completed — 1000×667',
  'damage':       'Damage — 800×600',
  'process':      'Process — 800×600',
  'repair':       'Repair — 800×600',
  'team':         'Team — 600×800',
  'equipment':    'Equipment — 800×600',
};

// --- State ---
let photos = [];
let currentIndex = 0;
let photoStatus = {}; // filename -> 'uploaded' | 'skipped' | null
let editor = null;

// --- DOM refs ---
const queueList = document.getElementById('queue-list');
const queueCount = document.getElementById('queue-count');
const editorPosition = document.getElementById('editor-position');
const selectMicrosite = document.getElementById('select-microsite');
const selectCategory = document.getElementById('select-category');
const selectPreset = document.getElementById('select-preset');
const inputWidth = document.getElementById('input-width');
const inputHeight = document.getElementById('input-height');
const inputQuality = document.getElementById('input-quality');
const qualityValue = document.getElementById('quality-value');
const uploadResult = document.getElementById('upload-result');
const btnUpload = document.getElementById('btn-upload');
const btnSkip = document.getElementById('btn-skip');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');

// --- Init ---
async function init() {
  await loadConfig();
  await loadPhotos();
  initEditor();
  bindEvents();
}

async function loadConfig() {
  // Microsites and categories come from the server via a config endpoint
  const res = await fetch('/api/config');
  const config = await res.json();

  // Populate microsite dropdown
  config.microsites.forEach(({ key, name }) => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = `${key} — ${name}`;
    selectMicrosite.appendChild(opt);
  });

  // Populate category dropdown
  config.imageCategories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    selectCategory.appendChild(opt);
  });

  // Populate preset dropdown (one per category + manual option)
  const noneOpt = document.createElement('option');
  noneOpt.value = '';
  noneOpt.textContent = 'No resize';
  selectPreset.appendChild(noneOpt);

  config.imageCategories.forEach(cat => {
    if (PRESETS[cat]) {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = PRESET_LABELS[cat];
      selectPreset.appendChild(opt);
    }
  });
}

async function loadPhotos() {
  const res = await fetch('/api/photos');
  const data = await res.json();
  photos = data.photos;

  queueCount.textContent = `${photos.length} photo${photos.length !== 1 ? 's' : ''}`;

  // Build queue thumbnails
  queueList.innerHTML = '';
  photos.forEach((filename, i) => {
    const item = document.createElement('div');
    item.className = 'queue-item';
    item.dataset.index = i;
    const img = document.createElement('img');
    img.src = `/api/photos/${encodeURIComponent(filename)}`;
    img.alt = filename;
    item.appendChild(img);
    item.addEventListener('click', () => goToPhoto(i));
    queueList.appendChild(item);
  });

  if (photos.length > 0) goToPhoto(0);
}

function initEditor() {
  editor = new tui.ImageEditor(document.getElementById('tui-editor'), {
    includeUI: {
      menu: ['crop', 'rotate', 'flip', 'filter'],
      initMenu: 'filter',
      uiSize: { width: '100%', height: '100%' },
      theme: {},
    },
    cssMaxWidth: document.getElementById('editor-panel').clientWidth,
    cssMaxHeight: document.getElementById('editor-panel').clientHeight - 50,
    usageStatistics: false,
  });
}

async function goToPhoto(index) {
  currentIndex = index;
  const filename = photos[index];

  // Load photo into Tui editor
  const imageUrl = `/api/photos/${encodeURIComponent(filename)}`;
  await editor.loadImageFromURL(imageUrl, filename);
  editor.clearUndoStack();

  updateQueueUI();
  editorPosition.textContent = `${index + 1} / ${photos.length}`;
  uploadResult.textContent = '';
  uploadResult.className = '';
}

function updateQueueUI() {
  document.querySelectorAll('.queue-item').forEach((item, i) => {
    const filename = photos[i];
    item.className = 'queue-item';
    if (i === currentIndex) item.classList.add('active');
    if (photoStatus[filename] === 'uploaded') item.classList.add('uploaded');
    if (photoStatus[filename] === 'skipped') item.classList.add('skipped');

    // Scroll active item into view
    if (i === currentIndex) item.scrollIntoView({ block: 'nearest' });
  });
}

function bindEvents() {
  btnPrev.addEventListener('click', () => {
    if (currentIndex > 0) goToPhoto(currentIndex - 1);
  });

  btnNext.addEventListener('click', () => {
    if (currentIndex < photos.length - 1) goToPhoto(currentIndex + 1);
  });

  btnSkip.addEventListener('click', () => {
    photoStatus[photos[currentIndex]] = 'skipped';
    updateQueueUI();
    if (currentIndex < photos.length - 1) goToPhoto(currentIndex + 1);
  });

  btnUpload.addEventListener('click', handleUpload);

  // Quality slider label
  inputQuality.addEventListener('input', () => {
    qualityValue.textContent = inputQuality.value;
  });

  // Category change -> auto-fill preset and dimensions
  selectCategory.addEventListener('change', () => {
    const cat = selectCategory.value;
    if (PRESETS[cat]) {
      selectPreset.value = cat;
      inputWidth.value = PRESETS[cat].width;
      inputHeight.value = PRESETS[cat].height;
    } else {
      selectPreset.value = '';
      inputWidth.value = '';
      inputHeight.value = '';
    }
  });

  // Preset change -> fill dimensions
  selectPreset.addEventListener('change', () => {
    const cat = selectPreset.value;
    if (cat && PRESETS[cat]) {
      inputWidth.value = PRESETS[cat].width;
      inputHeight.value = PRESETS[cat].height;
    } else {
      inputWidth.value = '';
      inputHeight.value = '';
    }
  });
}

async function handleUpload() {
  const microsite = selectMicrosite.value;
  const category = selectCategory.value;
  const filename = photos[currentIndex];
  const quality = parseInt(inputQuality.value, 10);
  const format = document.querySelector('input[name="format"]:checked').value;
  const width = inputWidth.value ? parseInt(inputWidth.value, 10) : null;
  const height = inputHeight.value ? parseInt(inputHeight.value, 10) : null;

  if (!microsite) {
    uploadResult.textContent = 'Please select a microsite.';
    uploadResult.className = 'error';
    return;
  }

  btnUpload.disabled = true;
  uploadResult.textContent = 'Processing...';
  uploadResult.className = '';

  try {
    // 1. Get current editor canvas as base64
    const dataURL = editor.toDataURL();
    const [header, base64] = dataURL.split(',');
    const mimeType = header.match(/:(.*?);/)[1];

    // 2. Process with Sharp on the server
    const processRes = await fetch('/api/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageData: base64, mimeType, options: { width, height, quality, format } })
    });
    const processed = await processRes.json();
    if (!processRes.ok) throw new Error(processed.error);

    // 3. Upload to blob storage
    uploadResult.textContent = 'Uploading...';
    const uploadRes = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageData: processed.imageData,
        mimeType: processed.mimeType,
        filename,
        microsite,
        category
      })
    });
    const result = await uploadRes.json();
    if (!uploadRes.ok) throw new Error(result.error);

    // 4. Success
    photoStatus[filename] = 'uploaded';
    updateQueueUI();
    uploadResult.textContent = `✓ ${result.url}`;
    uploadResult.className = 'success';

    // Auto-advance
    setTimeout(() => {
      if (currentIndex < photos.length - 1) goToPhoto(currentIndex + 1);
    }, 800);

  } catch (err) {
    uploadResult.textContent = `✗ ${err.message}`;
    uploadResult.className = 'error';
  } finally {
    btnUpload.disabled = false;
  }
}

init();
```

**Step 2: Add the `/api/config` endpoint to server.js**

Add this route to `server.js` before `app.listen`:

```js
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
```

**Step 3: End-to-end smoke test**

```bash
cd tools/photo-picker
node server.js /path/to/photos
```

- Browser opens. Queue panel shows thumbnails.
- Click a photo — it loads in the Tui editor.
- Change category to `hero` — preset fills to 1440×810, dimension fields populate.
- Change quality slider — label updates.
- Click Skip — photo gets ✕ badge, advances to next.
- Upload button present. (Full upload test requires `.env` tokens — verify in Task 8.)

**Step 4: Commit**

```bash
git add tools/photo-picker/public/app.js tools/photo-picker/server.js
git commit -m "photo-picker: add browser app.js with queue, editor, upload flow"
```

---

### Task 8: End-to-end upload test + dotenv note in README

**Files:**
- Create: `tools/photo-picker/README.md`

**Step 1: Verify .env is picked up**

The server loads `../blob-manager/.env`. Check it has at least one token set:

```bash
grep "BLOB_TOKEN" tools/blob-manager/.env | head -3
```

If no tokens exist yet, add one for any microsite you want to test with. See `tools/blob-manager/README.md` for how to get tokens from Vercel.

**Step 2: Full upload test**

1. Start the server: `node tools/photo-picker/server.js /path/to/photos`
2. Select a microsite that has a token configured
3. Select category `gallery`
4. Verify preset fills to 800×600
5. Set format to WebP
6. Click Upload
7. Expected: photo advances, green URL appears in result area
8. Verify the URL is accessible in a browser

**Step 3: Create README.md**

```markdown
# Photo Picker

Local web app for reviewing, editing, and uploading photos to microsite blob storage.

## Setup

Install dependencies:

```bash
cd tools/photo-picker
npm install
```

Tokens are read from `tools/blob-manager/.env`. Make sure the tokens for the microsites you want to upload to are configured there.

## Usage

```bash
node tools/photo-picker/server.js /path/to/photos
```

Opens http://localhost:3000 automatically.

## Workflow

1. Photos in the target folder appear as thumbnails in the left queue
2. Click a thumbnail (or use Prev/Next) to load it in the editor
3. Edit as needed: crop, rotate, flip, brightness/contrast
4. Choose microsite, category, resize preset, quality, and format
5. Click **Upload** to process and send to Vercel Blob
6. Click **Skip** to mark as skipped and move on
7. Uploaded photos show a ✓ badge; skipped show ✕

## Resize Presets

Selecting a category auto-fills the resize preset. Override width/height manually if needed. Sharp uses `fit: inside` — scales down without cropping or distorting.

| Category | Preset |
|---|---|
| hero | 1440×810 |
| gallery | 800×600 |
| before-after | 1000×667 |
| team | 600×800 |
| (others) | 800×600 |
```

**Step 4: Final commit**

```bash
git add tools/photo-picker/README.md
git commit -m "photo-picker: add README with setup and usage instructions"
```

---

## Completion Checklist

- [ ] `npm install` runs without errors
- [ ] Server starts with a folder path and opens browser
- [ ] `/api/photos` returns the folder's image files
- [ ] `/api/config` returns microsites and categories
- [ ] Photos appear as thumbnails in queue panel
- [ ] Clicking a thumbnail loads it in Tui Image Editor
- [ ] Category change auto-populates preset and dimensions
- [ ] Manual W/H override works independently of preset
- [ ] Quality slider updates the label
- [ ] Skip marks photo ✕ and advances
- [ ] Upload processes image through Sharp and sends to Vercel Blob
- [ ] Uploaded photo shows ✓ badge and green URL
- [ ] App auto-advances after upload
