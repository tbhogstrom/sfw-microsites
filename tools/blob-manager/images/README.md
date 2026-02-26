# Image Staging Directory

This directory contains folders for organizing images before uploading to blob storage.

## Folder Structure

```
images/
├── beam-repair/          # beamrepairexpert.com
├── chimney-repair/       # woodchimneyrepair.com
├── crawlspace-rot/       # crawlspacerot.com
├── deck-repair/          # deckrepairexpert.com
├── dry-rot/              # rotrepairportland.com & rotrepairseattle.com
├── flashing-repair/      # flashingrepairs.com
├── lead-paint/           # leadpaintprofessionals.com
├── leak-repair/          # leakingwindow.com
├── restoration/          # historicrenovationsnw.com
├── siding-repair/        # sidingrepairexperts.com
└── trim-repair/          # exteriortrimrepairs.com
```

## Usage

### 1. Add Images to Folders

Place your images in the appropriate microsite folder:

```bash
# Copy images to dry-rot folder
cp ~/Desktop/project-photos/*.jpg images/dry-rot/

# Or organize by category within the folder
mkdir images/dry-rot/hero
mkdir images/dry-rot/before-after
cp ~/Desktop/hero-*.jpg images/dry-rot/hero/
```

### 2. Upload Images

Upload all images from a microsite folder:

```bash
# Upload all images from dry-rot folder
node src/cli.js batch-upload dry-rot images/dry-rot

# Upload with category
node src/cli.js batch-upload dry-rot images/dry-rot/hero --category hero

# Upload single image
node src/cli.js upload dry-rot images/dry-rot/repair-photo.jpg --category gallery
```

### 3. Clean Up After Upload

After successful upload, you can move images to an archive or delete them:

```bash
# Archive uploaded images
mkdir -p archive/dry-rot/2024-02-26
mv images/dry-rot/*.jpg archive/dry-rot/2024-02-26/

# Or delete them
rm images/dry-rot/*.jpg
```

## Recommended Organization

### Option 1: Flat Structure
```
images/dry-rot/
├── hero-image.jpg
├── before-1.jpg
├── after-1.jpg
├── repair-process-1.jpg
└── completed-project.jpg
```

Then upload with categories:
```bash
node src/cli.js upload dry-rot images/dry-rot/hero-image.jpg --category hero
node src/cli.js upload dry-rot images/dry-rot/before-1.jpg --category before-after
```

### Option 2: Nested by Category
```
images/dry-rot/
├── hero/
│   └── hero-image.jpg
├── before-after/
│   ├── before-1.jpg
│   └── after-1.jpg
├── process/
│   └── repair-process-1.jpg
└── gallery/
    └── completed-project.jpg
```

Then batch upload by category:
```bash
node src/cli.js batch-upload dry-rot images/dry-rot/hero --category hero
node src/cli.js batch-upload dry-rot images/dry-rot/before-after --category before-after
```

### Option 3: By Project
```
images/dry-rot/
├── project-2024-001/
│   ├── before.jpg
│   ├── during.jpg
│   └── after.jpg
├── project-2024-002/
│   ├── before.jpg
│   └── after.jpg
└── stock-photos/
    ├── team-photo.jpg
    └── equipment.jpg
```

Upload by project:
```bash
node src/cli.js batch-upload dry-rot images/dry-rot/project-2024-001 --category gallery
```

## Tips

1. **Use descriptive filenames** - `deck-repair-before-001.jpg` is better than `IMG_1234.jpg`
2. **Compress images first** - Optimize images before placing them here
3. **Keep originals** - Archive original high-res photos elsewhere
4. **Document uploads** - Keep a spreadsheet of uploaded URLs and their purposes
5. **Clean regularly** - Don't let this directory become cluttered with old images

## Image Guidelines

- **Formats**: JPG, PNG, WebP, GIF
- **Max size**: 10MB per file (can be changed in config.json)
- **Recommended size**: 1920px width for hero images, 800-1200px for content images
- **Naming**: Use lowercase, hyphens (not spaces), descriptive names

## Workflow Example

```bash
# 1. Add images to folder
cp ~/Downloads/project-photos/*.jpg images/dry-rot/

# 2. Review what you have
ls -lh images/dry-rot/

# 3. Upload all images with category
node src/cli.js batch-upload dry-rot images/dry-rot --category gallery

# 4. List uploaded images to get URLs
node src/cli.js list dry-rot

# 5. Archive the local copies
mkdir -p archive/dry-rot-$(date +%Y-%m-%d)
mv images/dry-rot/*.jpg archive/dry-rot-$(date +%Y-%m-%d)/
```

## .gitignore

The `.gitignore` file is configured to ignore image files in these folders:
- `*.jpg`
- `*.jpeg`
- `*.png`
- `*.webp`
- `*.gif`

This prevents accidentally committing large image files to the repository. Only the folder structure (via `.gitkeep` files) is tracked.
