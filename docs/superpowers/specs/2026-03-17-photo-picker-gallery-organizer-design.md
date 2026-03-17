# Photo Picker Gallery Organizer Design Spec

**Date:** 2026-03-17
**Status:** Design Approved
**Goal:** Add drag-and-drop photo organization to photo-picker gallery page, enabling fast visual assignment of photos to service cluster subtopics.

---

## Overview

Currently, photo-picker has two separate workflows:
- **Upload tab** — generic upload with manual category/cluster/subtopic assignment via dropdowns
- **Gallery tab** — read-only view of assigned images grouped by cluster

This spec unifies the workflow by making the gallery page **interactive and drag-enabled**, allowing users to:
1. See the full service cluster/subtopic structure as an expandable tree
2. Drag photos directly onto subtopic slots
3. Auto-assign with immediate visual feedback

Additionally, the upload tab gains drag-drop as a general file input zone.

---

## Requirements

### Functional

1. **Gallery Page Enhancements (Modify `/gallery.html`)**
   - Microsite selector at top (existing)
   - Expandable tree showing all clusters for that microsite
   - Click cluster header to expand/collapse its subtopics
   - Each subtopic displays:
     - Subtopic name
     - 2-column image grid (expandable beyond 2)
     - Currently assigned images with remove button (×)
     - Empty slot drag-drop zones for adding photos
   - Drag files from file system → drop on empty slots → auto-upload and assign

2. **Upload Page Drag-Drop (Modify `/index.html`)**
   - Add drag-drop zone at top of upload tab for general file intake
   - User drags files → added to queue for manual category/cluster assignment
   - Existing dropdown-based workflow unchanged

3. **Data Standardization**
   - All new assignments populate `description` field with subtopic name
   - Structure: `{ title: "Cluster Name", description: "Subtopic Name", image: "URL", href: "..." }`
   - No changes to existing schema — leverages existing flexible structure

4. **Server Endpoint**
   - Reuse existing `/api/update-image` endpoint for assignment
   - No new endpoints needed (endpoint already handles subtopic in description)

5. **Cleanup Task (Future Phase 2)**
   - Backfill all existing `images.json` entries with empty `description` fields
   - Match to cluster slug, infer or manually assign subtopic names
   - Standardize all historical data

---

## Architecture

### Files Modified

**Client-side:**
- `tools/photo-picker/public/gallery.html` — add tree UI + drag zones
- `tools/photo-picker/public/app.js` (gallery version) — handle drag events, call upload + update-image APIs
- `tools/photo-picker/public/style.css` — styles for tree, drag feedback, drop zones

**Server-side:**
- `tools/photo-picker/server.js` — no changes (existing endpoints sufficient)

### Data Flow: Drag-Drop on Gallery

```
User drags image file
        ↓
Drop on subtopic slot
        ↓
Browser reads file → base64 encode
        ↓
POST /api/process (resize/format if needed)
        ↓
POST /api/upload (write to blob storage)
        ↓
Returns: { url, pathname, size }
        ↓
POST /api/update-image {
  microsite, imageUrl, clusterSlug, subtopic, title
}
        ↓
Endpoint updates/creates images.json entries:
{
  title: "Cluster Name",
  description: "Subtopic Name",  ← standardized
  image: url,
  href: "/services/{location}/{clusterSlug}"
}
        ↓
Client: Show image in slot (optimistic update)
```

### Drag-Drop Implementation Details

**Drop zones:**
- Each empty slot in subtopic is a drag-drop target
- Visual feedback on hover: highlight + "Drop here" text
- Accept any image file type (.jpg, .png, .webp, .gif)

**Upload + Assignment:**
- Drag-drop is NOT a two-step process
- Single action: drop → upload + assign in one flow
- Show spinner during upload, image appears when done

**Interaction:**
- Can drag multiple files in sequence across different subtopics
- Each drop triggers independent upload/assignment
- Click × on any image to remove from subtopic (calls delete endpoint — separate task)
- No "save all" button — all changes auto-save

---

## UI/UX Layout

```
┌─────────────────────────────────────────┐
│ Microsite: [dropdown ▼]                 │
├─────────────────────────────────────────┤
│                                         │
│ ▼ Cluster 1: Roofing (4 images)        │
│   • Leak Detection                      │
│     [img1] [img2]                      │
│     [ +  ] [ +  ]  ← drag zones        │
│                                         │
│   • Shingle Replacement                 │
│     [img3] [ +  ]                      │
│     [ +  ] [ +  ]                      │
│                                         │
│ ▶ Cluster 2: Gutter Work (0 images)    │
│   (collapsed)                           │
│                                         │
│ ▼ Cluster 3: Fascia Repair (2 images)  │
│   • Board Rot                           │
│     [img4] [ +  ]                      │
│     [ +  ] [ +  ]                      │
│                                         │
└─────────────────────────────────────────┘
```

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Invalid file type | Show error toast, file rejected |
| Network error on upload | Show error toast, allow retry |
| Drop outside valid zone | File rejected (browser default) |
| Drag while upload in progress | Disable drop zones until upload completes |
| Server error updating images.json | Show error toast, retry available |

---

## Data Structure (No Changes Required)

Existing `images.json` structure is fully compatible:

```json
{
  "heroImages": { "index": "url" },
  "backgroundImages": {},
  "galleryImages": [],
  "servicePageImages": [
    {
      "title": "Cluster Name",
      "description": "Subtopic Name",  ← we standardize this
      "image": "blob URL",
      "href": "/services/portland/cluster-slug"
    }
  ]
}
```

**Components consuming this data:** No changes needed. `description` field already exists and is optional in all current uses. New organizer populates it consistently.

---

## Implementation Phases

### Phase 1 (This Session)
- [ ] Modify gallery.html — expandable tree + drag-drop UI
- [ ] Update gallery app.js — drag event handlers + upload flow
- [ ] Add drag-drop to upload tab (index.html + app.js)
- [ ] Test end-to-end: drag file → appears in gallery with subtopic assigned
- [ ] Commit all changes

### Phase 2 (Follow-up)
- [ ] Create cleanup task/script to backfill empty descriptions
- [ ] Run against all 11 microsites
- [ ] Standardize historical data

---

## Success Criteria

- ✅ User can drag image file from file system onto gallery page subtopic slot
- ✅ Image auto-uploads and appears in slot with spinner feedback
- ✅ Entry in `images.json` created with subtopic in `description` field
- ✅ Expand/collapse cluster navigation works smoothly
- ✅ Upload tab also has drag-drop for general file intake
- ✅ No breaking changes to existing components or API contracts
- ✅ All changes backward compatible with existing gallery.html read-only use

---

## Testing Strategy

### Manual Testing
1. Open gallery page for deck-repair
2. Expand one cluster, see subtopics with 0-2 images each
3. Drag image file from file system → drop on empty slot
4. Verify: image appears, spinner shows, then resolves
5. Verify: images.json updated with correct subtopic in description
6. Expand/collapse other clusters — ensure state persists
7. Test upload tab: drag file → added to queue

### Automated Testing (if needed later)
- Drag-drop event simulation
- Upload endpoint mocking
- API response validation

---

## Notes for Implementation

- Reuse existing `/api/update-image` endpoint — no new server code needed
- Existing `/api/service-topics` provides cluster/subtopic structure
- Use native HTML5 drag-drop API (not a library)
- Keep styles minimal — extend existing photo-picker CSS
- Service topic structure is already loaded on page init (from gallery view)

