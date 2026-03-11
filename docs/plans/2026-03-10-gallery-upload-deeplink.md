# Gallery → Upload Deep-Link Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make empty cluster slots in the Gallery tab clickable links that navigate to the Upload tab with microsite, category, and cluster context pre-filled.

**Architecture:** Gallery empty slots become `<a>` tags linking to `/?microsite=X&category=service-page&cluster=Y&clusterTitle=Z`. The Upload page (`app.js`) reads those params after `loadConfig()`, pre-fills dropdowns, and shows a dismissible context banner. No server changes needed — pure frontend.

**Tech Stack:** Vanilla JS, HTML, CSS — existing photo-picker public files only.

**Design doc:** `docs/plans/2026-03-10-gallery-upload-deeplink-design.md`

---

## Context You Need

**Key files (all in `tools/photo-picker/public/`):**
- `gallery.html` — Gallery page. The empty slot is rendered inline via JS at line 136: `grid.innerHTML = '<div class="empty-slot">...'`  The `loadGallery(microsite)` function has `microsite` in scope, and `cluster.clusterSlug` / `cluster.title` are available from the API response.
- `index.html` — Upload page. The options panel (`<aside id="options-panel">`) starts at line 40. A context banner `<div id="upload-context">` needs to be added inside it, before the `<h2>`.
- `app.js` — Upload page JS. `init()` calls `loadConfig()` then `loadPhotos()` then `bindEvents()`. `loadConfig()` populates the dropdowns. URL params should be applied in a new `applyDeepLink()` function called at the end of `init()`, after `loadConfig()`.
- `style.css` — Upload page styles. Add context banner styles here.

**Important about `service-page` category:**
- `app.js` already has `service-page` in `PRESETS` and `PRESET_LABELS`
- When `selectCategory.value = 'service-page'` and a `change` event is dispatched, `showPageAssign()` runs → it shows `#service-page-row` and calls `loadServiceTopics(microsite)` (async, uses cache)
- `selectServiceCluster` is the cluster dropdown inside `#service-page-row`
- To pre-select a cluster: call `await loadServiceTopics(microsite)` (hits cache if already loaded), then set `selectServiceCluster.value = clusterSlug`

**git note:** `tools/` is in `.gitignore` but all public files are already tracked. Use `git add -f` for any new files, or `git add` normally for already-tracked files. Tracked files: `app.js`, `index.html`, `style.css`, `gallery.html`.

---

### Task 1: Update `gallery.html` — empty slot becomes a clickable link

**Files:**
- Modify: `tools/photo-picker/public/gallery.html`

**Step 1: Read the file**

Open `tools/photo-picker/public/gallery.html`. Find the empty slot render at line ~136:
```js
grid.innerHTML = '<div class="empty-slot"><div class="plus">+</div><span>No images</span></div>';
```

**Step 2: Replace the empty slot div with a link**

Replace that line with:
```js
const uploadUrl = `/?microsite=${encodeURIComponent(microsite)}&category=service-page&cluster=${encodeURIComponent(cluster.clusterSlug)}&clusterTitle=${encodeURIComponent(cluster.title)}`;
grid.innerHTML = `<a href="${uploadUrl}" class="empty-slot">
  <div class="plus">+</div>
  <span class="empty-slot-title">${cluster.title}</span>
  <span class="empty-slot-hint">Upload →</span>
</a>`;
```

**Step 3: Update the `.empty-slot` CSS in gallery.html**

Find the existing `.empty-slot` style rule inside the `<style>` block and replace it with:
```css
.empty-slot {
  border: 1px dashed #252525;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 4/3;
  color: #444;
  font-size: 11px;
  flex-direction: column;
  gap: 4px;
  border-radius: 6px;
  text-decoration: none;
  transition: border-color 0.15s, background 0.15s;
  padding: 8px;
  text-align: center;
}
.empty-slot:hover {
  border-color: #4a9eff;
  background: #0d1a2e;
}
.empty-slot .plus { font-size: 22px; color: #2a2a2a; }
.empty-slot:hover .plus { color: #4a9eff; }
.empty-slot-title { color: #555; font-size: 10px; line-height: 1.3; }
.empty-slot-hint { color: #333; font-size: 10px; display: none; }
.empty-slot:hover .empty-slot-hint { display: block; color: #4a9eff; }
```

**Step 4: Verify**

With the server running, open `http://localhost:3000/gallery.html` and pick a microsite that has empty clusters (e.g. chimney-repair). Hover over an empty slot — it should show a blue border and "Upload →" hint. Click it — it should navigate to `http://localhost:3000/?microsite=chimney-repair&category=service-page&cluster=...&clusterTitle=...`. The Upload page loads (pre-fill logic doesn't exist yet — that's Task 3).

**Step 5: Commit**

From `C:\Users\tfalcon\microsites`:
```bash
git add tools/photo-picker/public/gallery.html
git commit -m "photo-picker: make empty gallery slots link to upload with prefill params"
```

Do NOT include Co-Authored-By in the commit message.

---

### Task 2: Add context banner markup to `index.html`

**Files:**
- Modify: `tools/photo-picker/public/index.html`

**Step 1: Read the file**

Open `tools/photo-picker/public/index.html`. Find `<aside id="options-panel">` (around line 40).

**Step 2: Insert the context banner**

Add the context banner as the FIRST child inside `<aside id="options-panel">`, before the `<h2>Upload Options</h2>`:

```html
<!-- Context banner: shown when arriving from gallery deep-link -->
<div id="upload-context" style="display:none">
  <div id="upload-context-label"></div>
  <button id="upload-context-dismiss" title="Clear context">×</button>
</div>
```

So the options panel opening becomes:
```html
<aside id="options-panel">
  <div id="upload-context" style="display:none">
    <div id="upload-context-label"></div>
    <button id="upload-context-dismiss" title="Clear context">×</button>
  </div>
  <h2>Upload Options</h2>
  ...
```

**Step 3: Verify markup**

Open `http://localhost:3000` and check DevTools — the `#upload-context` div should exist in the DOM but be hidden. No visual change yet.

**Step 4: Commit**

From `C:\Users\tfalcon\microsites`:
```bash
git add tools/photo-picker/public/index.html
git commit -m "photo-picker: add upload context banner markup to options panel"
```

Do NOT include Co-Authored-By in the commit message.

---

### Task 3: Style the context banner in `style.css`

**Files:**
- Modify: `tools/photo-picker/public/style.css`

**Step 1: Read the file**

Open `tools/photo-picker/public/style.css`. Add the following at the end of the file:

**Step 2: Add styles**

```css
/* Deep-link context banner */
#upload-context {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  background: #1a1400;
  border: 1px solid #3a2e00;
  border-radius: 5px;
  padding: 8px 10px;
  margin-bottom: 4px;
}

#upload-context-label {
  font-size: 11px;
  color: #c8a020;
  line-height: 1.4;
}

#upload-context-dismiss {
  background: none;
  border: none;
  color: #666;
  cursor: pointer;
  font-size: 14px;
  padding: 0;
  line-height: 1;
  flex-shrink: 0;
}

#upload-context-dismiss:hover {
  color: #aaa;
}
```

**Step 3: Commit**

From `C:\Users\tfalcon\microsites`:
```bash
git add tools/photo-picker/public/style.css
git commit -m "photo-picker: add upload context banner styles"
```

Do NOT include Co-Authored-By in the commit message.

---

### Task 4: Read URL params and apply deep-link in `app.js`

**Files:**
- Modify: `tools/photo-picker/public/app.js`

**Step 1: Read the file**

Open `tools/photo-picker/public/app.js`. You need to:
1. Add DOM refs for the new banner elements
2. Add an `applyDeepLink()` async function
3. Call `applyDeepLink()` at the end of `init()`

**Step 2: Add DOM refs**

Find the existing DOM refs section (around line 40–78). Add these two lines after the existing refs:

```js
const uploadContext = document.getElementById('upload-context');
const uploadContextLabel = document.getElementById('upload-context-label');
const uploadContextDismiss = document.getElementById('upload-context-dismiss');
```

**Step 3: Add `applyDeepLink()` function**

Add this function after the `renderPreview()` function and before the `// --- Init ---` comment:

```js
// --- Deep-link from gallery ---
async function applyDeepLink() {
  const params = new URLSearchParams(location.search);
  const microsite = params.get('microsite');
  const category  = params.get('category');
  const cluster   = params.get('cluster');
  const clusterTitle = params.get('clusterTitle');

  if (!microsite && !category) return;

  // Pre-select microsite
  if (microsite) selectMicrosite.value = microsite;

  // Pre-select category and trigger the change handler
  if (category) {
    selectCategory.value = category;
    selectCategory.dispatchEvent(new Event('change'));
  }

  // If service-page + cluster, wait for topics to load then pre-select
  if (category === 'service-page' && cluster && microsite) {
    await loadServiceTopics(microsite); // uses cache if already loaded
    selectServiceCluster.value = cluster;
    selectServiceCluster.dispatchEvent(new Event('change'));
  }

  // Apply resize preset for the category
  if (category && PRESETS[category]) {
    selectPreset.value = category;
    inputWidth.value = PRESETS[category].width;
    inputHeight.value = PRESETS[category].height;
  }

  // Show context banner
  if (clusterTitle || cluster) {
    uploadContextLabel.textContent = `Uploading for: ${clusterTitle || cluster}`;
    uploadContext.style.display = '';
  }
}
```

**Step 4: Wire up the dismiss button and call `applyDeepLink` from `init()`**

Find the `bindEvents()` function. Add this near the top of it:

```js
uploadContextDismiss.addEventListener('click', () => {
  uploadContext.style.display = 'none';
  history.replaceState({}, '', '/');
});
```

Find the `init()` function:
```js
async function init() {
  await loadConfig();
  await loadPhotos();
  bindEvents();
}
```

Add `await applyDeepLink();` at the end:
```js
async function init() {
  await loadConfig();
  await loadPhotos();
  bindEvents();
  await applyDeepLink();
}
```

**Step 5: Verify end-to-end**

1. Open `http://localhost:3000/gallery.html`, pick a site with empty clusters (e.g. `chimney-repair`)
2. Hover an empty slot — blue border + cluster title + "Upload →" appears
3. Click the slot — navigates to `/?microsite=chimney-repair&category=service-page&cluster=chimney-chase-flashing-leak-repair&clusterTitle=Chimney+Chase+%26+Flashing+Leak+Repair`
4. On the Upload page:
   - Microsite dropdown shows `chimney-repair`
   - Category shows `service-page`
   - `#service-page-row` is visible with clusters loaded
   - The correct cluster is selected in `#select-service-cluster`
   - Resize preset shows `Service page — 800×600` and dimensions are filled
   - Amber banner at top of options panel shows: `Uploading for: Chimney Chase & Flashing Leak Repair`
5. Click `×` on the banner — banner disappears, URL becomes plain `http://localhost:3000/`

**Step 6: Commit**

From `C:\Users\tfalcon\microsites`:
```bash
git add tools/photo-picker/public/app.js
git commit -m "photo-picker: apply gallery deep-link params on upload page init"
```

Do NOT include Co-Authored-By in the commit message.

---

## Completion Checklist

- [ ] Empty gallery cluster slots are `<a>` links (not `<div>`) with correct URL params
- [ ] Hover state: blue border, cluster title visible, "Upload →" hint appears
- [ ] Clicking navigates to Upload tab with all 4 params in URL
- [ ] Upload page pre-selects microsite dropdown
- [ ] Upload page pre-selects category (`service-page`)
- [ ] `#service-page-row` is shown with clusters loaded
- [ ] Correct cluster is pre-selected in cluster dropdown
- [ ] Resize preset fills to `Service page — 800×600`
- [ ] Amber context banner shows cluster title
- [ ] Dismissing banner hides it and strips URL params
