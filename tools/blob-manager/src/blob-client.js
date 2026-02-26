import { put, list, del } from '@vercel/blob';
import { readFile } from 'fs/promises';
import { basename, extname } from 'path';
import mime from 'mime-types';
import dotenv from 'dotenv';

dotenv.config();

export class BlobClient {
  constructor(microsite, config) {
    this.microsite = microsite;
    this.config = config;
    this.micrositeConfig = config.microsites[microsite];

    if (!this.micrositeConfig) {
      throw new Error(`Microsite "${microsite}" not found in config`);
    }

    const tokenEnvVar = this.micrositeConfig.tokenEnvVar;
    this.token = process.env[tokenEnvVar];

    if (!this.token) {
      throw new Error(`Token not found. Please set ${tokenEnvVar} in .env file`);
    }
  }

  /**
   * Upload a file to blob storage
   * @param {string} filePath - Local file path
   * @param {Object} options - Upload options
   * @param {string} options.category - Image category (e.g., 'before-after', 'hero')
   * @param {string} options.customPath - Custom path in blob storage
   * @param {Object} options.metadata - Additional metadata
   * @returns {Promise<Object>} Upload result with URL
   */
  async upload(filePath, options = {}) {
    const { category, customPath, metadata = {} } = options;

    // Validate file extension
    const ext = extname(filePath).toLowerCase();
    if (!this.config.allowedExtensions.includes(ext)) {
      throw new Error(`Invalid file extension: ${ext}. Allowed: ${this.config.allowedExtensions.join(', ')}`);
    }

    // Read file
    const fileBuffer = await readFile(filePath);

    // Validate file size
    if (fileBuffer.length > this.config.maxFileSize) {
      throw new Error(`File too large: ${(fileBuffer.length / 1048576).toFixed(2)}MB. Max: ${(this.config.maxFileSize / 1048576).toFixed(2)}MB`);
    }

    // Determine blob path
    const fileName = basename(filePath);
    const blobPath = customPath || (category ? `${category}/${fileName}` : fileName);

    // Get content type
    const contentType = mime.lookup(filePath) || 'application/octet-stream';

    // Upload to Vercel Blob
    const blob = await put(blobPath, fileBuffer, {
      access: 'public',
      token: this.token,
      contentType,
      addRandomSuffix: false,
    });

    return {
      url: blob.url,
      pathname: blob.pathname,
      size: blob.size,
      uploadedAt: blob.uploadedAt,
      microsite: this.microsite,
      category,
      ...metadata
    };
  }

  /**
   * List all blobs for this microsite
   * @param {Object} options - List options
   * @param {string} options.prefix - Filter by path prefix
   * @param {number} options.limit - Max number of results
   * @returns {Promise<Array>} List of blobs
   */
  async list(options = {}) {
    const { prefix, limit = 1000 } = options;

    const result = await list({
      token: this.token,
      prefix,
      limit,
    });

    return result.blobs.map(blob => ({
      url: blob.url,
      pathname: blob.pathname,
      size: blob.size,
      uploadedAt: blob.uploadedAt,
      microsite: this.microsite
    }));
  }

  /**
   * Delete a blob by URL
   * @param {string} url - Blob URL to delete
   * @returns {Promise<void>}
   */
  async delete(url) {
    await del(url, { token: this.token });
  }

  /**
   * Get blob storage info
   * @returns {Object} Storage info
   */
  getInfo() {
    return {
      microsite: this.microsite,
      name: this.micrositeConfig.name,
      domain: this.micrositeConfig.domain,
      tokenConfigured: !!this.token
    };
  }
}

export default BlobClient;
