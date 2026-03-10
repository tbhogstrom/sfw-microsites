# Photo Picker Coverage & Gallery Views Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Coverage and Gallery tab views to the photo-picker web app so you can see image instrumentation status across all microsites and browse uploaded images by service cluster.

**Architecture:** Three new API endpoints added to the existing `tools/photo-picker/server.js`, plus two new static HTML pages in `public/`. All data comes from existing `images.json` files per microsite and the existing cluster-slug markdown parser already in server.js. No new dependencies needed.

**Tech Stack:** Express (existing), vanilla HTML/CSS/JS (no build step), existing `readImagesJson()` helper and cluster-slug parser in server.js.

**Design doc:** `docs/plans/2026-03-10-photo-picker-coverage-gallery-design.md`

---

## Context You Need

**Key files:**
- `tools/photo-picker/server.js` — Express server. Already has `readImagesJson(microsite)` helper and cluster-slug parsing logic inside the `/api/service-topics` handler. Add all new endpoints here.
- `tools/photo-picker/public/index.html` — existing Upload page. Add the shared tab nav to it.
- `apps/{microsite}/src/data/images.json` — per-site image data. Shape:
  ```json
  {
    "heroImages": { "deck-stairs-railings": "https://...blob.../hero.webp" },
    "backgroundImages": { "deck-stairs-railings": "https://...blob.../bg.webp" },
    "galleryImages": [{ "title": "", "description": "", "image": "", "href": "" }],
    "servicePageImages": [{ "title": "Deck Guardrail Repair", "description": "", "image": "https://...", "href": "/services/portland/deck-stairs-railings" }]
  }
  ```
- `apps/{microsite}/src/data/generated_content/service_page_cluster_*_portland.md` — markdown files that define cluster slugs. Each has a `<!-- CLUSTER_META ... -->` block with `cluster_slug:` and a title in the first `# ` heading.

**How to extract clusterSlug from a servicePageImages href:**
```js
// href = "/services/portland/deck-stairs-railings"
const clusterSlug = href.split('/').pop(); // "deck-stairs-railings"
```

**Cluster slug parsing already exists** inside the `/api/service-topics` handler in server.js. Extract it into a shared helper function `getClusterTopics(microsite)` in Task 1 so all new endpoints can reuse it.

**`blobConfig`** is already loaded at the top of server.js — it has all 11 microsites under `blobConfig.microsites`.

---

### Task 1: Extract `getClusterTopics()` helper in server.js

The `/api/service-topics` handler in server.js contains inline logic to read and parse cluster markdown files. Extract that logic into a standalone async function so the new coverage and gallery endpoints can reuse it without duplication.

**Files:**
- Modify: `tools/photo-picker/server.js`

**Step 1: Read the current `/api/service-topics` handler**

Open `tools/photo-picker/server.js` and find the `app.get('/api/service-topics', ...)` handler. The logic inside reads the `generated_content/` directory, filters for `_portland.md` cluster files, parses the `CLUSTER_META` block, and returns an array of `{ clusterSlug, title, subtopics }`.

**Step 2: Extract into a named helper**

Add this function above the route definitions (before the first `app.get`):

```js
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
    const raw = await readFile(resolve(contentDir, file), 'utf-8');

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
```

**Step 3: Update `/api/service-topics` to use the helper**

Replace the inline logic inside the `/api/service-topics` handler body with:

```js
app.get('/api/service-topics', async (req, res) => {
  try {
    const { microsite } = req.query;
    if (!microsite) return res.status(400).json({ error: 'microsite is required' });
    const topics = await getClusterTopics(microsite);
    res.json({ topics });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

**Step 4: Verify `/api/service-topics` still works**

With the server running:
```bash
curl "http://localhost:3000/api/service-topics?microsite=deck-repair"
```
Expected: JSON with `topics` array containing `clusterSlug`, `title`, `subtopics` for each deck-repair cluster. Same output as before the refactor.

**Step 5: Commit**

```bash
git add tools/photo-picker/server.js
git commit -m "photo-picker: extract getClusterTopics() helper for reuse"
```

---

### Task 2: Add `/api/coverage` endpoint (all-sites summary)

**Files:**
- Modify: `tools/photo-picker/server.js`

**Step 1: Add the endpoint before `app.listen`**

```js
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
        // Build set of covered cluster slugs
        const coveredSlugs = new Set(
          servicePageImages.map(img => img.href.split('/').pop())
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

    // Sort: most coverage first, then alphabetically
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
```

**Step 2: Test the endpoint**

```bash
curl http://localhost:3000/api/coverage
```

Expected: JSON array with one object per microsite. Each has `key`, `name`, `domain`, `totalClusters`, `coveredClusters`. `coveredClusters` should be 0 for sites with no images and >0 for deck-repair (which has servicePageImages in its images.json).

**Step 3: Commit**

```bash
git add tools/photo-picker/server.js
git commit -m "photo-picker: add /api/coverage all-sites summary endpoint"
```

---

### Task 3: Add `/api/coverage/:microsite` endpoint (per-site cluster breakdown)

**Files:**
- Modify: `tools/photo-picker/server.js`

**Step 1: Add the endpoint before `app.listen`**

```js
// GET /api/coverage/:microsite
// Returns per-cluster breakdown: image count, hero set, header texture set.
app.get('/api/coverage/:microsite', async (req, res) => {
  try {
    const { microsite } = req.params;
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
      const slug = img.href.split('/').pop();
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
```

**Step 2: Test the endpoint**

```bash
curl http://localhost:3000/api/coverage/deck-repair
```

Expected: JSON with `microsite: "deck-repair"` and `clusters` array. The `deck-stairs-railings` cluster should show `imageCount: 4` (or however many are in the real images.json). Other clusters should show `imageCount: 0`.

**Step 3: Commit**

```bash
git add tools/photo-picker/server.js
git commit -m "photo-picker: add /api/coverage/:microsite cluster breakdown endpoint"
```

---

### Task 4: Add `/api/gallery/:microsite` endpoint

**Files:**
- Modify: `tools/photo-picker/server.js`

**Step 1: Add the endpoint before `app.listen`**

```js
// GET /api/gallery/:microsite
// Returns servicePageImages grouped by clusterSlug, with hero/texture flags.
app.get('/api/gallery/:microsite', async (req, res) => {
  try {
    const { microsite } = req.params;
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
      const slug = img.href.split('/').pop();
      if (!imagesBySlug[slug]) imagesBySlug[slug] = new Map();
      // Use URL as key to deduplicate (portland + seattle produce same image twice)
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
```

**Step 2: Test the endpoint**

```bash
curl http://localhost:3000/api/gallery/deck-repair
```

Expected: JSON with `clusters` array. The `deck-stairs-railings` cluster should have an `images` array with deduplicated entries (no duplicate URLs from portland/seattle). Each image has `url`, `title`, `isHero`, `isHeaderTexture`.

**Step 3: Commit**

```bash
git add tools/photo-picker/server.js
git commit -m "photo-picker: add /api/gallery/:microsite grouped images endpoint"
```

---

### Task 5: Add shared tab nav to index.html (Upload page)

**Files:**
- Modify: `tools/photo-picker/public/index.html`

**Step 1: Add nav bar to index.html**

Open `tools/photo-picker/public/index.html`. Add this immediately after the opening `<body>` tag:

```html
<nav id="tab-nav">
  <a href="/" class="active">Upload</a>
  <a href="/coverage.html">Coverage</a>
  <a href="/gallery.html">Gallery</a>
</nav>
```

**Step 2: Add nav styles to style.css**

Open `tools/photo-picker/public/style.css` and add at the top (before existing body styles):

```css
#tab-nav {
  display: flex;
  gap: 2px;
  background: #111;
  border-bottom: 1px solid #333;
  padding: 0 16px;
  position: relative;
  z-index: 10;
}

#tab-nav a {
  padding: 10px 18px;
  color: #888;
  text-decoration: none;
  font-size: 13px;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}

#tab-nav a.active { color: #fff; border-bottom-color: #4a9eff; }
#tab-nav a:hover { color: #ccc; }
```

**Step 3: Adjust the #app grid to account for nav height**

In `style.css`, update the `#app` rule:

```css
#app {
  display: grid;
  grid-template-columns: 180px 1fr 220px;
  height: calc(100vh - 41px); /* subtract nav height */
}
```

**Step 4: Verify**

Open `http://localhost:3000`. The Upload page should now show a tab bar at the top. The Upload tab is highlighted. Coverage and Gallery links navigate (pages don't exist yet — that's fine).

**Step 5: Commit**

```bash
git add tools/photo-picker/public/index.html tools/photo-picker/public/style.css
git commit -m "photo-picker: add shared tab nav to upload page"
```

---

### Task 6: Build coverage.html

**Files:**
- Create: `tools/photo-picker/public/coverage.html`

**Step 1: Create coverage.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Photo Picker — Coverage</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; font-size: 14px; background: #1a1a1a; color: #e0e0e0; }

    #tab-nav { display: flex; gap: 2px; background: #111; border-bottom: 1px solid #333; padding: 0 16px; }
    #tab-nav a { padding: 10px 18px; color: #888; text-decoration: none; font-size: 13px; border-bottom: 2px solid transparent; margin-bottom: -1px; }
    #tab-nav a.active { color: #fff; border-bottom-color: #4a9eff; }
    #tab-nav a:hover { color: #ccc; }

    #content { padding: 24px; overflow-y: auto; height: calc(100vh - 41px); }

    h1 { font-size: 18px; font-weight: 600; margin-bottom: 4px; }
    .subtitle { color: #666; font-size: 12px; margin-bottom: 24px; }

    .site-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; margin-bottom: 28px; }

    .site-card { background: #111; border: 1px solid #2a2a2a; border-radius: 8px; padding: 16px; cursor: pointer; transition: border-color 0.15s; }
    .site-card:hover { border-color: #555; }
    .site-card.selected { border-color: #4a9eff; background: #0d1a2e; }

    .site-card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
    .site-name { font-weight: 600; font-size: 14px; }
    .site-domain { font-size: 11px; color: #555; margin-top: 2px; }
    .site-badge { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 99px; white-space: nowrap; }
    .badge-good { background: #14532d; color: #4ade80; }
    .badge-mid  { background: #713f12; color: #fbbf24; }
    .badge-low  { background: #1c1c1c; color: #555; border: 1px solid #2a2a2a; }

    .progress-bar { height: 6px; background: #222; border-radius: 3px; overflow: hidden; margin-bottom: 6px; }
    .progress-fill { height: 100%; border-radius: 3px; transition: width 0.3s; }
    .fill-good { background: #22c55e; }
    .fill-mid  { background: #f59e0b; }
    .fill-low  { background: #333; }

    .site-stats { font-size: 11px; color: #555; }
    .site-stats span { color: #888; }

    /* Detail panel */
    #detail-panel { background: #111; border: 1px solid #2a2a2a; border-radius: 8px; padding: 20px; display: none; }
    #detail-panel.visible { display: block; }

    .detail-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .detail-header h2 { font-size: 15px; font-weight: 600; }
    .detail-header a { font-size: 12px; color: #4a9eff; text-decoration: none; }
    .detail-header a:hover { text-decoration: underline; }

    table { width: 100%; border-collapse: collapse; }
    th { font-size: 11px; color: #555; text-align: left; padding: 6px 10px; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #222; }
    td { padding: 9px 10px; border-bottom: 1px solid #1e1e1e; font-size: 13px; vertical-align: middle; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: #141414; }

    .dot-row { display: flex; gap: 4px; flex-wrap: wrap; min-height: 14px; }
    .dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .dot-img     { background: #22c55e; }
    .dot-hero    { background: #4a9eff; }
    .dot-texture { background: #a78bfa; }
    .dot-empty   { background: #2a2a2a; border: 1px solid #333; }

    .chip { display: inline-block; font-size: 10px; padding: 2px 8px; border-radius: 99px; font-weight: 600; }
    .chip-done    { background: #14532d; color: #4ade80; }
    .chip-partial { background: #713f12; color: #fbbf24; }
    .chip-none    { background: #1c1c1c; color: #555; border: 1px solid #2a2a2a; }

    #loading { color: #555; font-size: 13px; padding: 40px 0; text-align: center; }
  </style>
</head>
<body>

  <nav id="tab-nav">
    <a href="/">Upload</a>
    <a href="/coverage.html" class="active">Coverage</a>
    <a href="/gallery.html">Gallery</a>
  </nav>

  <div id="content">
    <h1>Image Coverage</h1>
    <p class="subtitle">Service page image instrumentation across all microsites</p>

    <div id="loading">Loading...</div>
    <div id="site-grid" class="site-grid" style="display:none"></div>
    <div id="detail-panel"></div>
  </div>

  <script>
    let allSites = [];
    let selectedMicrosite = null;

    async function init() {
      const res = await fetch('/api/coverage');
      allSites = await res.json();
      renderSiteGrid();
    }

    function renderSiteGrid() {
      document.getElementById('loading').style.display = 'none';
      const grid = document.getElementById('site-grid');
      grid.style.display = 'grid';
      grid.innerHTML = '';

      allSites.forEach(site => {
        const pct = site.totalClusters ? site.coveredClusters / site.totalClusters : 0;
        const badgeClass = pct === 1 ? 'badge-good' : pct > 0 ? 'badge-mid' : 'badge-low';
        const fillClass  = pct === 1 ? 'fill-good'  : pct > 0 ? 'fill-mid'  : 'fill-low';

        const card = document.createElement('div');
        card.className = 'site-card' + (selectedMicrosite === site.key ? ' selected' : '');
        card.innerHTML = `
          <div class="site-card-header">
            <div>
              <div class="site-name">${site.key}</div>
              <div class="site-domain">${site.domain}</div>
            </div>
            <span class="site-badge ${badgeClass}">${site.coveredClusters} / ${site.totalClusters}</span>
          </div>
          <div class="progress-bar"><div class="progress-fill ${fillClass}" style="width:${Math.round(pct * 100)}%"></div></div>
          <div class="site-stats"><span>${site.coveredClusters}</span> covered &nbsp;·&nbsp; <span>${site.totalClusters - site.coveredClusters}</span> missing</div>
        `;
        card.addEventListener('click', () => selectSite(site.key));
        grid.appendChild(card);
      });
    }

    async function selectSite(key) {
      selectedMicrosite = key;
      renderSiteGrid(); // re-render to update selected state

      const panel = document.getElementById('detail-panel');
      panel.className = 'visible';
      panel.innerHTML = '<div style="color:#555;padding:16px 0">Loading...</div>';

      const res = await fetch(`/api/coverage/${key}`);
      const data = await res.json();

      const rows = data.clusters.map(c => {
        const dots = c.imageCount > 0
          ? Array(c.imageCount).fill('<div class="dot dot-img"></div>').join('')
          : '<div class="dot dot-empty"></div>';

        const heroDot    = `<div class="dot ${c.hasHero          ? 'dot-hero'    : 'dot-empty'}"></div>`;
        const textureDot = `<div class="dot ${c.hasHeaderTexture ? 'dot-texture' : 'dot-empty'}"></div>`;

        let chipClass, chipLabel;
        if (c.imageCount === 0) {
          chipClass = 'chip-none'; chipLabel = 'Missing';
        } else if (!c.hasHero) {
          chipClass = 'chip-partial'; chipLabel = 'No hero';
        } else if (!c.hasHeaderTexture) {
          chipClass = 'chip-partial'; chipLabel = 'No texture';
        } else {
          chipClass = 'chip-done'; chipLabel = 'Done';
        }

        return `<tr>
          <td>${c.title}</td>
          <td><div class="dot-row">${dots}</div></td>
          <td>${heroDot}</td>
          <td>${textureDot}</td>
          <td><span class="chip ${chipClass}">${chipLabel}</span></td>
        </tr>`;
      }).join('');

      panel.innerHTML = `
        <div class="detail-header">
          <h2>${key} — cluster breakdown</h2>
          <a href="/gallery.html?site=${key}">View gallery →</a>
        </div>
        <table>
          <thead>
            <tr>
              <th>Service cluster</th>
              <th>Images</th>
              <th>Hero</th>
              <th>Header texture</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    }

    init();
  </script>
</body>
</html>
```

**Step 2: Verify in browser**

Open `http://localhost:3000/coverage.html`. Expected:
- Tab nav at top, Coverage tab highlighted
- Grid of site cards loads with progress bars
- Click deck-repair card → cluster breakdown table appears below
- deck-stairs-railings row shows green image dots, status chip
- "View gallery →" link in detail header

**Step 3: Commit**

```bash
git add tools/photo-picker/public/coverage.html
git commit -m "photo-picker: add coverage dashboard page"
```

---

### Task 7: Build gallery.html

**Files:**
- Create: `tools/photo-picker/public/gallery.html`

**Step 1: Create gallery.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Photo Picker — Gallery</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; font-size: 14px; background: #1a1a1a; color: #e0e0e0; }

    #tab-nav { display: flex; gap: 2px; background: #111; border-bottom: 1px solid #333; padding: 0 16px; }
    #tab-nav a { padding: 10px 18px; color: #888; text-decoration: none; font-size: 13px; border-bottom: 2px solid transparent; margin-bottom: -1px; }
    #tab-nav a.active { color: #fff; border-bottom-color: #4a9eff; }
    #tab-nav a:hover { color: #ccc; }

    #content { padding: 24px; overflow-y: auto; height: calc(100vh - 41px); }

    .page-header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
    .page-header h1 { font-size: 18px; font-weight: 600; }

    select#site-picker {
      background: #222; color: #e0e0e0; border: 1px solid #444;
      border-radius: 6px; padding: 6px 12px; font-size: 13px; cursor: pointer;
    }

    #gallery-body { }

    .cluster-section { margin-bottom: 32px; }
    .cluster-header { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #222; }
    .cluster-title { font-size: 15px; font-weight: 600; }
    .cluster-meta { font-size: 11px; color: #555; }

    .img-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 8px; }

    .img-card { background: #111; border: 1px solid #222; border-radius: 6px; overflow: hidden; }
    .img-card.has-hero    { border-color: #1e3a5c; }
    .img-card.has-texture { border-color: #2d1f5c; }

    .img-thumb { width: 100%; aspect-ratio: 4/3; object-fit: cover; display: block; background: #1e1e1e; }

    .img-info { padding: 7px 8px; }
    .img-tags { display: flex; gap: 4px; margin-bottom: 4px; flex-wrap: wrap; }
    .tag { font-size: 9px; font-weight: 700; padding: 1px 5px; border-radius: 3px; }
    .tag-hero    { background: #1a3a5c; color: #4a9eff; }
    .tag-texture { background: #2a1a4a; color: #a78bfa; }
    .img-title { font-size: 11px; color: #ccc; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .img-filename { font-size: 10px; color: #444; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    .empty-slot { border: 1px dashed #252525; background: transparent; display: flex; align-items: center; justify-content: center; aspect-ratio: 4/3; color: #333; font-size: 11px; flex-direction: column; gap: 6px; border-radius: 6px; }
    .empty-slot .plus { font-size: 22px; color: #2a2a2a; }

    #loading { color: #555; font-size: 13px; padding: 40px 0; text-align: center; }
  </style>
</head>
<body>

  <nav id="tab-nav">
    <a href="/">Upload</a>
    <a href="/coverage.html">Coverage</a>
    <a href="/gallery.html" class="active">Gallery</a>
  </nav>

  <div id="content">
    <div class="page-header">
      <h1>Gallery by Service</h1>
      <select id="site-picker"></select>
    </div>
    <div id="loading">Loading...</div>
    <div id="gallery-body"></div>
  </div>

  <script>
    async function init() {
      // Load microsites for picker
      const configRes = await fetch('/api/config');
      const config = await configRes.json();

      const picker = document.getElementById('site-picker');
      config.microsites.forEach(({ key, name }) => {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = key;
        picker.appendChild(opt);
      });

      // Check for ?site= query param (from coverage "View gallery" link)
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

      const res = await fetch(`/api/gallery/${microsite}`);
      const data = await res.json();

      loading.style.display = 'none';

      data.clusters.forEach(cluster => {
        const section = document.createElement('div');
        section.className = 'cluster-section';

        const imageCount = cluster.images.length;
        section.innerHTML = `
          <div class="cluster-header">
            <div class="cluster-title">${cluster.title}</div>
            <div class="cluster-meta">${imageCount > 0 ? `${imageCount} image${imageCount !== 1 ? 's' : ''}` : 'No images yet'}</div>
          </div>
          <div class="img-grid" id="grid-${cluster.clusterSlug}"></div>
        `;
        body.appendChild(section);

        const grid = section.querySelector('.img-grid');

        if (imageCount === 0) {
          grid.innerHTML = '<div class="empty-slot"><div class="plus">+</div><span>No images</span></div>';
          return;
        }

        cluster.images.forEach(img => {
          const filename = img.url.split('/').pop();
          const tags = [
            img.isHero          ? '<span class="tag tag-hero">HERO</span>'    : '',
            img.isHeaderTexture ? '<span class="tag tag-texture">TEXTURE</span>' : ''
          ].join('');

          const card = document.createElement('div');
          card.className = 'img-card' + (img.isHero ? ' has-hero' : '') + (img.isHeaderTexture ? ' has-texture' : '');
          card.innerHTML = `
            <img class="img-thumb" src="${img.url}" alt="${img.title}" loading="lazy" />
            <div class="img-info">
              ${tags ? `<div class="img-tags">${tags}</div>` : ''}
              <div class="img-title">${img.title || '—'}</div>
              <div class="img-filename">${filename}</div>
            </div>
          `;
          grid.appendChild(card);
        });
      });
    }

    init();
  </script>
</body>
</html>
```

**Step 2: Verify in browser**

Open `http://localhost:3000/gallery.html`. Expected:
- Tab nav at top, Gallery tab highlighted
- Site picker dropdown populated with all 11 microsites
- Clusters load for the default (first) site
- deck-repair: deck-stairs-railings shows image thumbnails with title subtitles below filenames
- Empty clusters show dashed placeholder slot
- `http://localhost:3000/gallery.html?site=deck-repair` pre-selects deck-repair

**Step 3: Verify "View gallery →" link from coverage works**

Open `http://localhost:3000/coverage.html`, click deck-repair card, click "View gallery →". Expected: navigates to gallery.html with deck-repair pre-selected.

**Step 4: Commit**

```bash
git add tools/photo-picker/public/gallery.html
git commit -m "photo-picker: add gallery by service page"
```

---

### Task 8: Clean up mock files

**Files:**
- Delete: `tools/photo-picker/public/mock-coverage.html`
- Delete: `tools/photo-picker/public/mock-gallery.html`

**Step 1: Delete the mock files**

```bash
rm tools/photo-picker/public/mock-coverage.html
rm tools/photo-picker/public/mock-gallery.html
```

**Step 2: Commit**

```bash
git add -u tools/photo-picker/public/
git commit -m "photo-picker: remove mock HTML files"
```

---

## Completion Checklist

- [ ] `/api/coverage` returns all-sites summary with `coveredClusters` / `totalClusters`
- [ ] `/api/coverage/:microsite` returns per-cluster breakdown with `imageCount`, `hasHero`, `hasHeaderTexture`
- [ ] `/api/gallery/:microsite` returns images grouped by cluster, deduplicated by URL
- [ ] Upload page (`index.html`) has tab nav
- [ ] Coverage page: site cards with progress bars, click → inline breakdown table
- [ ] Coverage breakdown table has Hero, Header texture, and Status columns
- [ ] Gallery page: site picker, cluster sections, image cards with title subtitle + filename
- [ ] "View gallery →" link in coverage passes `?site=` param to gallery page
- [ ] Mock files deleted
