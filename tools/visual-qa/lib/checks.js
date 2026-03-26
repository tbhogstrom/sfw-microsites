import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

/**
 * Run all QA checks on a single page.
 * @param {import('playwright').Page} page — Playwright page instance
 * @param {string} pageUrl — full URL to navigate to
 * @param {string} pageName — human-readable name (e.g. 'homepage', 'blog/index')
 * @param {string} screenshotDir — directory to save screenshots
 * @returns {Promise<{ page: string, url: string, passed: boolean, checks: object[], screenshot: string }>}
 */
export async function checkPage(page, pageUrl, pageName, screenshotDir) {
  const checks = [];

  // Collect console errors during page load
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  const pageErrors = [];
  page.on('pageerror', (err) => {
    pageErrors.push(err.message);
  });

  // Navigate
  let navigationError = null;
  try {
    const response = await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 15_000 });
    checks.push({
      name: 'http_status',
      passed: response.status() >= 200 && response.status() < 400,
      detail: `HTTP ${response.status()}`,
    });
  } catch (err) {
    navigationError = err.message;
    checks.push({ name: 'http_status', passed: false, detail: navigationError });
  }

  if (navigationError) {
    return { page: pageName, url: pageUrl, passed: false, checks, screenshot: null };
  }

  // Check: no console errors
  checks.push({
    name: 'no_console_errors',
    passed: consoleErrors.length === 0,
    detail: consoleErrors.length === 0
      ? 'No console errors'
      : `${consoleErrors.length} error(s): ${consoleErrors.slice(0, 3).join('; ')}`,
  });

  // Check: no uncaught page errors
  checks.push({
    name: 'no_page_errors',
    passed: pageErrors.length === 0,
    detail: pageErrors.length === 0
      ? 'No uncaught errors'
      : `${pageErrors.length} error(s): ${pageErrors.slice(0, 3).join('; ')}`,
  });

  // Check: no broken images
  const brokenImages = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('img'));
    return imgs
      .filter((img) => img.src && !img.complete)
      .map((img) => img.src);
  });
  // Also check naturalWidth for loaded but broken images
  const zeroWidthImages = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('img'));
    return imgs
      .filter((img) => img.src && img.complete && img.naturalWidth === 0)
      .map((img) => img.src);
  });
  const allBroken = [...brokenImages, ...zeroWidthImages];
  checks.push({
    name: 'no_broken_images',
    passed: allBroken.length === 0,
    detail: allBroken.length === 0
      ? 'All images loaded'
      : `${allBroken.length} broken: ${allBroken.slice(0, 3).join(', ')}`,
  });

  // Check: key components present
  const components = {
    header: 'header',
    main_content: 'main#main-content',
    footer: 'footer',
  };
  for (const [name, selector] of Object.entries(components)) {
    const found = await page.locator(selector).count();
    checks.push({
      name: `component_${name}`,
      passed: found > 0,
      detail: found > 0 ? `Found <${selector}>` : `Missing <${selector}>`,
    });
  }

  // Check: main content is not empty
  const mainText = await page.locator('main#main-content').textContent().catch(() => '');
  const hasContent = mainText.trim().length > 50;
  checks.push({
    name: 'main_has_content',
    passed: hasContent,
    detail: hasContent
      ? `Main content: ${mainText.trim().length} chars`
      : 'Main content appears empty or very thin',
  });

  // Check: hero section present (homepage-specific, skip for other pages)
  if (pageName === 'homepage') {
    const heroFound = await page.locator('section').first().count();
    checks.push({
      name: 'hero_section',
      passed: heroFound > 0,
      detail: heroFound > 0 ? 'Hero section found' : 'No hero section detected',
    });
  }

  // Take screenshot
  await mkdir(screenshotDir, { recursive: true });
  const screenshotPath = resolve(screenshotDir, `${pageName.replace(/\//g, '_')}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });

  const passed = checks.every((c) => c.passed);

  return { page: pageName, url: pageUrl, passed, checks, screenshot: screenshotPath };
}
