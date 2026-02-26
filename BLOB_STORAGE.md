# Vercel Blob Storage for Microsites

This guide explains how to use Vercel Blob storage for uploading and managing images in the microsites.

## Overview

The blob storage implementation is based on [mt-tabor-bulb-society](https://github.com/tbhogstrom/mt-tabor-bulb-society) and provides:

- **Image uploads** up to 10MB
- **Multiple format support**: JPEG, PNG, HEIC, HEIF
- **Automatic validation** of file types and sizes
- **Development mode fallback** (base64 data URLs when token not configured)
- **Production storage** via Vercel Blob
- **Image management** API for listing and deleting images

## Setup

### 1. Install Dependencies

Dependencies are already installed at the root level:
```json
{
  "@vercel/blob": "^0.27.1",
  "uuid": "^9.0.0",
  "sharp": "^0.34.5"
}
```

### 2. Get Vercel Blob Token

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Navigate to **Storage** tab
4. Click **Create Database** → **Blob**
5. Once created, click **Connect** to get your token
6. Copy the `BLOB_READ_WRITE_TOKEN`

### 3. Configure Environment Variables

Create a `.env` file in your microsite app (e.g., `apps/dry-rot/.env`):

```bash
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxxxxxxxxx
```

**Important**: Add `.env` to your `.gitignore` if not already present!

### 4. Deploy to Vercel

Add the environment variable to your Vercel project:

1. Go to Project Settings → Environment Variables
2. Add `BLOB_READ_WRITE_TOKEN` with your token
3. Deploy your app

## API Endpoints

### Upload Image - POST `/api/upload`

Upload an image to Vercel Blob storage.

**Request:**
```javascript
const formData = new FormData();
formData.append('image', fileInput.files[0]);
formData.append('folder', 'gallery'); // optional, defaults to 'images'

const response = await fetch('/api/upload', {
  method: 'POST',
  body: formData
});

const result = await response.json();
```

**Response:**
```json
{
  "url": "https://xxxxx.public.blob.vercel-storage.com/gallery/uuid.jpg",
  "pathname": "gallery/uuid.jpg",
  "size": 245678,
  "contentType": "image/jpeg",
  "uploadedAt": "2024-01-01T00:00:00.000Z"
}
```

**Development Mode** (no token configured):
```json
{
  "url": "data:image/jpeg;base64,/9j/4AAQ...",
  "size": 245678,
  "contentType": "image/jpeg",
  "development": true
}
```

**Errors:**
- `400` - Invalid file type or size
- `500` - Upload failed

### List Images - GET `/api/images`

List all uploaded images with optional filtering.

**Query Parameters:**
- `folder` - Filter by folder prefix (e.g., `?folder=gallery`)
- `limit` - Max number of results (default: 100)
- `cursor` - Pagination cursor from previous response

**Request:**
```javascript
const response = await fetch('/api/images?folder=gallery&limit=20');
const data = await response.json();
```

**Response:**
```json
{
  "blobs": [
    {
      "url": "https://xxxxx.public.blob.vercel-storage.com/gallery/uuid.jpg",
      "pathname": "gallery/uuid.jpg",
      "size": 245678,
      "uploadedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "cursor": "next_page_token",
  "hasMore": true
}
```

### Delete Image - DELETE `/api/images`

Delete an image from Vercel Blob storage.

**Request:**
```javascript
const response = await fetch('/api/images', {
  method: 'DELETE',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: 'https://xxxxx.public.blob.vercel-storage.com/gallery/uuid.jpg'
  })
});

const result = await response.json();
```

**Response:**
```json
{
  "success": true
}
```

## Using the ImageUpload Component

### Basic Usage

Import and use the component in any Astro page:

```astro
---
import ImageUpload from '../components/ImageUpload.astro';
---

<ImageUpload folder="gallery" />
```

### With Callback

```astro
<ImageUpload
  folder="project-photos"
  onUploadComplete="handleUpload"
/>

<script>
  window.handleUpload = function(result) {
    console.log('Uploaded:', result.url);
    // Do something with the uploaded image
  };
</script>
```

### With Event Listener

```astro
<ImageUpload folder="gallery" />

<script>
  document.getElementById('uploadArea')?.addEventListener('imageUploaded', (e) => {
    console.log('Image uploaded:', e.detail);
    // Access result: e.detail.url, e.detail.size, etc.
  });

  document.getElementById('uploadArea')?.addEventListener('imageRemoved', () => {
    console.log('Image removed');
  });
</script>
```

### Props

- `folder` (string, default: 'images') - Folder path in blob storage
- `maxSizeMB` (number, default: 10) - Maximum file size in MB (display only)
- `onUploadComplete` (string) - Global callback function name

### Hidden Input

The component creates a hidden input with the uploaded image URL:

```html
<input type="hidden" id="imageUrl" name="imageUrl" value="https://..." />
```

This can be used in forms to submit the image URL.

## Example: Photo Gallery

See `apps/dry-rot/src/pages/image-upload-demo.astro` for a complete working example.

## File Organization

```
apps/dry-rot/
├── src/
│   ├── pages/
│   │   ├── api/
│   │   │   ├── upload.ts          # Upload endpoint
│   │   │   └── images.ts          # List/delete endpoint
│   │   └── image-upload-demo.astro # Demo page
│   └── components/
│       └── ImageUpload.astro      # Upload component
├── .env                           # Your token (git-ignored)
└── .env.example                   # Template
```

## Applying to Other Microsites

To add blob storage to another microsite:

1. Copy the API endpoints:
   ```bash
   cp -r apps/dry-rot/src/pages/api apps/YOUR-MICROSITE/src/pages/
   ```

2. Copy the component:
   ```bash
   cp apps/dry-rot/src/components/ImageUpload.astro apps/YOUR-MICROSITE/src/components/
   ```

3. Add environment variable to that microsite's `.env` file

4. Use the component in your pages!

## Development vs Production

**Development** (no token):
- Images converted to base64 data URLs
- No external storage required
- Perfect for local testing

**Production** (with token):
- Images uploaded to Vercel Blob
- Public URLs returned
- Persistent storage

## Validation Rules

- **File Types**: JPEG, PNG, HEIC, HEIF only
- **Max Size**: 10MB
- **Validation**: Both MIME type and file extension checked

## Cost Considerations

Vercel Blob Storage pricing (as of 2024):
- Free tier: 500MB storage
- Pay-as-you-go after that

See [Vercel Pricing](https://vercel.com/docs/storage/vercel-blob/pricing) for current rates.

## Troubleshooting

### "Blob storage not configured" error
- Make sure `BLOB_READ_WRITE_TOKEN` is set in your `.env` file
- Restart your dev server after adding the token

### Upload fails with 400 error
- Check file type (must be JPEG, PNG, HEIC, or HEIF)
- Check file size (must be under 10MB)

### Images not appearing after upload
- Check browser console for errors
- Verify the blob URL is accessible (try opening in new tab)
- Check CORS settings if loading from different domain

## Security Notes

- Never commit `.env` files to git
- Blob storage URLs are public by default
- Consider adding authentication for upload endpoints in production
- Rate limiting is not implemented - add if needed for production use

## Future Enhancements

Potential improvements:
- Thumbnail generation using Sharp
- Image optimization before upload
- Multiple file upload support
- Progress bars for large files
- Admin panel for managing uploads
- Access control / private storage options
