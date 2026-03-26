import { spawn, execSync } from 'node:child_process';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..');
const READY_TIMEOUT_MS = 30_000;
const BUILD_TIMEOUT_MS = 120_000;
const READY_PATTERN = /localhost:(\d+)/;

/**
 * Start a server for a given site.
 * Tries `astro dev` first. If the dev server returns HTTP 500 on the homepage
 * (common ESM resolution issue on Node 24), falls back to `astro build` + `astro preview`.
 * @param {string} site — app directory name, e.g. 'siding-repair'
 * @param {{ mode?: 'dev' | 'preview' }} options
 * @returns {Promise<{ url: string, stop: () => void, mode: string }>}
 */
export async function startServer(site, options = {}) {
  const mode = options.mode || 'dev';

  if (mode === 'preview') {
    return startPreviewServer(site);
  }

  // Try dev server first
  const server = await startRawServer(site, ['astro', 'dev']);

  // Quick health check — if the dev server returns 500, fall back to preview
  try {
    const response = await fetch(server.url);
    if (response.status >= 500) {
      console.log('Dev server returns 500 — falling back to build + preview...');
      server.stop();
      return startPreviewServer(site);
    }
  } catch {
    // Fetch failed — server might still be warming up, proceed anyway
  }

  return { ...server, mode: 'dev' };
}

// Legacy alias
export const startDevServer = startServer;

/**
 * Build the site then start `astro preview`.
 */
async function startPreviewServer(site) {
  const appDir = resolve(REPO_ROOT, 'apps', site);

  console.log(`Building ${site}...`);
  execSync('npx astro build', {
    cwd: appDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
    timeout: BUILD_TIMEOUT_MS,
  });
  console.log('Build complete. Starting preview server...');

  const server = await startRawServer(site, ['astro', 'preview']);
  return { ...server, mode: 'preview' };
}

/**
 * Start a raw Astro CLI command and wait for "localhost:PORT" in output.
 */
async function startRawServer(site, command) {
  const appDir = resolve(REPO_ROOT, 'apps', site);

  const proc = spawn('npx', command, {
    cwd: appDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  });

  let stderr = '';
  proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

  const url = await new Promise((resolveUrl, reject) => {
    const timeout = setTimeout(() => {
      proc.kill();
      reject(new Error(
        `Server for "${site}" did not start within ${READY_TIMEOUT_MS}ms.\nStderr: ${stderr}`
      ));
    }, READY_TIMEOUT_MS);

    function onData(chunk) {
      const text = chunk.toString();
      const match = text.match(READY_PATTERN);
      if (match) {
        clearTimeout(timeout);
        proc.stdout.off('data', onData);
        proc.stderr.off('data', onData);
        resolveUrl(`http://localhost:${match[1]}`);
      }
    }

    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);

    proc.on('error', (err) => {
      clearTimeout(timeout);
      reject(new Error(`Failed to start server for "${site}": ${err.message}`));
    });

    proc.on('exit', (code) => {
      if (code !== null && code !== 0) {
        clearTimeout(timeout);
        reject(new Error(`Server for "${site}" exited with code ${code}.\nStderr: ${stderr}`));
      }
    });
  });

  return {
    url,
    stop() {
      proc.kill('SIGTERM');
    },
  };
}
