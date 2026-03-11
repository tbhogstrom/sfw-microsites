# Gallery → Upload Deep-Link Design Doc

**Date:** 2026-03-10
**Status:** Approved

## Overview

Empty cluster slots in the Gallery tab become clickable links that navigate to the Upload tab with microsite, category, and cluster context pre-filled. This removes friction when you spot a missing cluster in the gallery and want to immediately upload for it.

## Approach

URL query params. No state management, no sessionStorage. Gallery links to:

```
/?microsite=deck-repair&category=gallery&cluster=deck-stairs-railings&clusterTitle=Deck+Stairs+%26+Railings
```

Upload page reads params on init and applies them.

## Changes

### `gallery.html` — empty slot becomes a link

Replace the static dashed `<div class="empty-slot">` with an `<a class="empty-slot">` linking to the Upload page with all four params. Keep the existing dashed styling. Add a subtle "Upload →" hint that appears on hover.

### `app.js` (Upload page) — read params on init

At the end of `init()`, after dropdowns are populated:

1. Read `URLSearchParams` for `microsite`, `category`, `cluster`, `clusterTitle`
2. If present, set `selectMicrosite.value`, `selectCategory.value`
3. Trigger the category `change` event so the preset and dimensions auto-fill
4. Show a dismissible context banner at the top of `#options-panel`:

```
Uploading for:
Deck Stairs & Railings  [×]
```

5. Clicking `×` hides the banner and uses `history.replaceState` to strip params from the URL

## Context Banner

Inserted as the first child of `#options-panel` in `index.html`. Hidden by default (`display: none`). Shown by JS when params are present.

```html
<div id="upload-context" style="display:none">
  <div id="upload-context-label"></div>
  <button id="upload-context-dismiss">×</button>
</div>
```

Style: dark amber/neutral tone to distinguish it from the rest of the panel. Small, unobtrusive.

## Files Changed

- `tools/photo-picker/public/gallery.html` — empty slot → `<a>` with params
- `tools/photo-picker/public/index.html` — add context banner markup to options panel
- `tools/photo-picker/public/app.js` — read params on init, show/dismiss banner
- `tools/photo-picker/public/style.css` — styles for context banner + empty-slot hover state
