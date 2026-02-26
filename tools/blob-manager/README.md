# Blob Manager

Command-line tool for managing and uploading images to microsite blob storage on Vercel.

## Features

✅ **Upload single images** with categorization
✅ **Batch upload** entire directories
✅ **List and browse** uploaded images
✅ **Delete images** from blob storage
✅ **Multi-microsite support** - separate blob stores for each site
✅ **Category organization** - organize images by purpose (before-after, hero, gallery, etc.)
✅ **File validation** - size limits and extension checking
✅ **Progress indicators** - visual feedback for uploads

## Installation

### 1. Install Dependencies

```bash
cd tools/blob-manager
npm install
```

### 2. Configure Blob Storage Tokens

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Navigate to **Storage** → **Create Blob Store** (create one for each microsite)
3. Get the read/write token for each blob store
4. Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

5. Add your tokens to `.env`:

```env
DRY_ROT_BLOB_TOKEN=vercel_blob_rw_your_token_here
DECK_REPAIR_BLOB_TOKEN=vercel_blob_rw_your_token_here
# ... etc for each microsite
```

## Usage

### List Available Microsites

```bash
npm run list sites
# or
node src/cli.js sites
```

### Upload a Single Image

```bash
node src/cli.js upload dry-rot path/to/image.jpg

# With category
node src/cli.js upload dry-rot hero-image.jpg --category hero

# With custom path
node src/cli.js upload deck-repair repair.jpg --path "projects/2024/repair.jpg"
```

### Batch Upload Directory

Upload all images from a directory:

```bash
node src/cli.js batch-upload dry-rot ./photos

# With category for all images
node src/cli.js batch-upload chimney-repair ./before-after --category before-after
```

### List Uploaded Images

```bash
# List all images
node src/cli.js list dry-rot

# Filter by prefix
node src/cli.js list dry-rot --prefix "hero/"

# Limit results
node src/cli.js list deck-repair --limit 50
```

### Delete an Image

```bash
node src/cli.js delete dry-rot https://xxxxx.public.blob.vercel-storage.com/image.jpg
```

### Get Microsite Info

```bash
node src/cli.js info dry-rot
```

## Image Categories

Organize your images using these predefined categories:

- `before-after` - Before and after comparison photos
- `process` - Work in progress photos
- `damage` - Damage documentation
- `repair` - Completed repair photos
- `team` - Team member photos
- `equipment` - Tools and equipment
- `completed` - Finished project photos
- `hero` - Hero/banner images
- `gallery` - General gallery images

Categories are optional but help organize your blob storage.

## Configuration

### `config.json`

Define microsites and their settings:

```json
{
  "microsites": {
    "dry-rot": {
      "name": "Rot Repair Experts",
      "domain": "rotrepairportland.com",
      "tokenEnvVar": "DRY_ROT_BLOB_TOKEN"
    }
  },
  "imageCategories": ["before-after", "hero", "gallery"],
  "allowedExtensions": [".jpg", ".jpeg", ".png", ".webp", ".gif"],
  "maxFileSize": 10485760
}
```

### Allowed Extensions

Default: `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`

### Max File Size

Default: 10MB (10485760 bytes)

## Using in Astro Components

After uploading images, use them in your Astro components:

```astro
---
// Get the blob URL from the upload
const imageUrl = "https://xxxxx.public.blob.vercel-storage.com/hero/repair.jpg";
---

<img src={imageUrl} alt="Repair work" />
```

Or create a reusable component:

```astro
---
// components/BlobImage.astro
interface Props {
  path: string;
  alt: string;
  class?: string;
}

const { path, alt, class: className } = Astro.props;
const blobBaseUrl = "https://xxxxx.public.blob.vercel-storage.com";
const fullUrl = `${blobBaseUrl}/${path}`;
---

<img src={fullUrl} alt={alt} class={className} />
```

## NPM Scripts

Add these to your workflow:

```json
{
  "scripts": {
    "upload": "node src/cli.js upload",
    "list": "node src/cli.js list",
    "delete": "node src/cli.js delete"
  }
}
```

Then use:

```bash
npm run upload dry-rot image.jpg
npm run list dry-rot
```

## Examples

### Upload hero images for all microsites

```bash
node src/cli.js upload dry-rot hero1.jpg --category hero
node src/cli.js upload deck-repair hero2.jpg --category hero
node src/cli.js upload chimney-repair hero3.jpg --category hero
```

### Upload a project gallery

```bash
node src/cli.js batch-upload deck-repair ./project-photos/deck-123 --category gallery
```

### Check storage usage

```bash
node src/cli.js list dry-rot
# Shows total size at the bottom
```

## Troubleshooting

### "Token not found" error

Make sure you've:
1. Created a `.env` file (copy from `.env.example`)
2. Added the correct token for the microsite
3. The token environment variable name matches `config.json`

### "Invalid file extension" error

Check that your file is one of the allowed types:
- JPG/JPEG
- PNG
- WebP
- GIF

### "File too large" error

Default max size is 10MB. To upload larger files, update `maxFileSize` in `config.json`.

### Token permissions

Make sure you're using a **read/write token**, not a read-only token.

## Best Practices

1. **Use categories** - Organize images by purpose for easier management
2. **Descriptive filenames** - Use clear names like `beam-repair-before.jpg`
3. **Optimize images** - Compress images before uploading to save storage
4. **Document URLs** - Keep a record of uploaded image URLs for your components
5. **Separate stores** - Use different blob stores for each microsite for better organization

## Next Steps

Consider adding:
- [ ] Image optimization/resizing before upload
- [ ] Metadata storage (alt text, captions, credits)
- [ ] Image catalog/database
- [ ] Bulk operations (copy between microsites, rename, etc.)
- [ ] Integration with content generator tool

## License

Part of the SFW Microsites project.
