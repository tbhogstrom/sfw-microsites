#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import chalk from 'chalk';
import ora from 'ora';
import { readFile } from 'fs/promises';
import { resolve, basename } from 'path';
import { BlobClient } from './blob-client.js';

// Load config
const configPath = new URL('../config.json', import.meta.url);
const config = JSON.parse(await readFile(configPath, 'utf-8'));

// CLI setup
yargs(hideBin(process.argv))
  .command(
    'upload <microsite> <file>',
    'Upload an image to blob storage',
    (yargs) => {
      return yargs
        .positional('microsite', {
          describe: 'Microsite name (e.g., deck-repair)',
          type: 'string'
        })
        .positional('file', {
          describe: 'Path to image file',
          type: 'string'
        })
        .option('category', {
          alias: 'c',
          describe: 'Image category',
          type: 'string',
          choices: config.imageCategories
        })
        .option('path', {
          alias: 'p',
          describe: 'Custom path in blob storage',
          type: 'string'
        });
    },
    async (argv) => {
      const spinner = ora('Uploading image...').start();

      try {
        const client = new BlobClient(argv.microsite, config);
        const filePath = resolve(argv.file);

        const result = await client.upload(filePath, {
          category: argv.category,
          customPath: argv.path
        });

        spinner.succeed('Image uploaded successfully!');
        console.log(chalk.green('\n✓ Upload Details:'));
        console.log(chalk.cyan('  URL:'), result.url);
        console.log(chalk.cyan('  Path:'), result.pathname);
        console.log(chalk.cyan('  Size:'), (result.size / 1024).toFixed(2), 'KB');
        console.log(chalk.cyan('  Microsite:'), result.microsite);
        if (result.category) {
          console.log(chalk.cyan('  Category:'), result.category);
        }
      } catch (error) {
        spinner.fail('Upload failed');
        console.error(chalk.red('\n✗ Error:'), error.message);
        process.exit(1);
      }
    }
  )
  .command(
    'batch-upload <microsite> <directory>',
    'Upload multiple images from a directory',
    (yargs) => {
      return yargs
        .positional('microsite', {
          describe: 'Microsite name',
          type: 'string'
        })
        .positional('directory', {
          describe: 'Directory containing images',
          type: 'string'
        })
        .option('category', {
          alias: 'c',
          describe: 'Image category for all uploads',
          type: 'string',
          choices: config.imageCategories
        });
    },
    async (argv) => {
      const { readdir } = await import('fs/promises');
      const { join, extname } = await import('path');

      try {
        const client = new BlobClient(argv.microsite, config);
        const dirPath = resolve(argv.directory);
        const files = await readdir(dirPath);

        // Filter image files
        const imageFiles = files.filter(file =>
          config.allowedExtensions.includes(extname(file).toLowerCase())
        );

        console.log(chalk.blue(`\nFound ${imageFiles.length} images to upload\n`));

        const results = [];
        for (const file of imageFiles) {
          const spinner = ora(`Uploading ${file}...`).start();

          try {
            const result = await client.upload(join(dirPath, file), {
              category: argv.category
            });
            results.push(result);
            spinner.succeed(`${file} uploaded`);
          } catch (error) {
            spinner.fail(`${file} failed: ${error.message}`);
          }
        }

        console.log(chalk.green(`\n✓ Uploaded ${results.length}/${imageFiles.length} images`));

        // Print URLs
        if (results.length > 0) {
          console.log(chalk.cyan('\nUploaded URLs:'));
          results.forEach(r => console.log(chalk.gray(`  ${r.url}`)));
        }
      } catch (error) {
        console.error(chalk.red('\n✗ Error:'), error.message);
        process.exit(1);
      }
    }
  )
  .command(
    'list <microsite>',
    'List all images in blob storage',
    (yargs) => {
      return yargs
        .positional('microsite', {
          describe: 'Microsite name',
          type: 'string'
        })
        .option('prefix', {
          alias: 'p',
          describe: 'Filter by path prefix',
          type: 'string'
        })
        .option('limit', {
          alias: 'l',
          describe: 'Maximum number of results',
          type: 'number',
          default: 100
        });
    },
    async (argv) => {
      const spinner = ora('Fetching blob list...').start();

      try {
        const client = new BlobClient(argv.microsite, config);
        const blobs = await client.list({
          prefix: argv.prefix,
          limit: argv.limit
        });

        spinner.succeed(`Found ${blobs.length} images`);

        if (blobs.length === 0) {
          console.log(chalk.yellow('\nNo images found'));
          return;
        }

        console.log(chalk.cyan(`\nImages in ${argv.microsite}:`));
        blobs.forEach((blob, i) => {
          console.log(chalk.gray(`\n${i + 1}. ${blob.pathname}`));
          console.log(chalk.gray(`   URL: ${blob.url}`));
          console.log(chalk.gray(`   Size: ${(blob.size / 1024).toFixed(2)} KB`));
          console.log(chalk.gray(`   Uploaded: ${new Date(blob.uploadedAt).toLocaleString()}`));
        });

        const totalSize = blobs.reduce((sum, blob) => sum + blob.size, 0);
        console.log(chalk.green(`\nTotal: ${blobs.length} images, ${(totalSize / 1048576).toFixed(2)} MB`));
      } catch (error) {
        spinner.fail('Failed to list blobs');
        console.error(chalk.red('\n✗ Error:'), error.message);
        process.exit(1);
      }
    }
  )
  .command(
    'delete <microsite> <url>',
    'Delete an image from blob storage',
    (yargs) => {
      return yargs
        .positional('microsite', {
          describe: 'Microsite name',
          type: 'string'
        })
        .positional('url', {
          describe: 'Blob URL to delete',
          type: 'string'
        });
    },
    async (argv) => {
      const spinner = ora('Deleting image...').start();

      try {
        const client = new BlobClient(argv.microsite, config);
        await client.delete(argv.url);

        spinner.succeed('Image deleted successfully!');
        console.log(chalk.green('\n✓ Deleted:'), argv.url);
      } catch (error) {
        spinner.fail('Delete failed');
        console.error(chalk.red('\n✗ Error:'), error.message);
        process.exit(1);
      }
    }
  )
  .command(
    'info <microsite>',
    'Show microsite blob storage info',
    (yargs) => {
      return yargs
        .positional('microsite', {
          describe: 'Microsite name',
          type: 'string'
        });
    },
    async (argv) => {
      try {
        const client = new BlobClient(argv.microsite, config);
        const info = client.getInfo();

        console.log(chalk.cyan('\nBlob Storage Info:'));
        console.log(chalk.gray('  Microsite:'), info.microsite);
        console.log(chalk.gray('  Name:'), info.name);
        console.log(chalk.gray('  Domain:'), info.domain);
        console.log(chalk.gray('  Token:'), info.tokenConfigured ? chalk.green('✓ Configured') : chalk.red('✗ Not configured'));
      } catch (error) {
        console.error(chalk.red('\n✗ Error:'), error.message);
        process.exit(1);
      }
    }
  )
  .command(
    'sites',
    'List all available microsites',
    () => {},
    () => {
      console.log(chalk.cyan('\nAvailable Microsites:'));
      Object.entries(config.microsites).forEach(([key, site]) => {
        console.log(chalk.gray(`\n  ${key}`));
        console.log(chalk.gray(`    Name: ${site.name}`));
        console.log(chalk.gray(`    Domain: ${site.domain}`));
        console.log(chalk.gray(`    Token Env: ${site.tokenEnvVar}`));
      });
    }
  )
  .demandCommand(1, 'You need to specify a command')
  .help()
  .argv;
