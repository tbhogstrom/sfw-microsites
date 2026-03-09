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
