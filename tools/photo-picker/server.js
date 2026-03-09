#!/usr/bin/env node
import express from 'express';
import { readdir } from 'fs/promises';
import { resolve, extname, join, dirname } from 'path';
import { fileURLToPath } from 'url';
import open from 'open';
import sharp from 'sharp';
import { presets } from './presets.js';

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

const PORT = 3000;
app.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`Photo Picker running at ${url}`);
  console.log(`Photos folder: ${photosDir}`);
  open(url);
});

export { app };
