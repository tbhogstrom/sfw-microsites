import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/**
 * Generate and output the QA report.
 * @param {string} site
 * @param {object[]} results — array of checkPage results
 * @param {string} reportDir — directory for JSON report
 */
export async function generateReport(site, results, reportDir) {
  const totalPages = results.length;
  const passedPages = results.filter((r) => r.passed).length;
  const failedPages = totalPages - passedPages;

  const totalChecks = results.reduce((sum, r) => sum + r.checks.length, 0);
  const passedChecks = results.reduce(
    (sum, r) => sum + r.checks.filter((c) => c.passed).length, 0
  );

  const report = {
    site,
    timestamp: new Date().toISOString(),
    summary: {
      pages: { total: totalPages, passed: passedPages, failed: failedPages },
      checks: { total: totalChecks, passed: passedChecks, failed: totalChecks - passedChecks },
    },
    passed: failedPages === 0,
    results,
  };

  // Write JSON report
  const jsonPath = resolve(reportDir, 'report.json');
  await writeFile(jsonPath, JSON.stringify(report, null, 2));

  // Print stdout summary
  console.log('');
  console.log(`=== Visual QA Report: ${site} ===`);
  console.log(`Timestamp: ${report.timestamp}`);
  console.log(`Overall: ${report.passed ? 'PASS' : 'FAIL'}`);
  console.log(`Pages: ${passedPages}/${totalPages} passed`);
  console.log(`Checks: ${passedChecks}/${totalChecks} passed`);
  console.log('');

  for (const result of results) {
    const icon = result.passed ? 'PASS' : 'FAIL';
    console.log(`  [${icon}] ${result.page} (${result.url})`);
    for (const check of result.checks) {
      if (!check.passed) {
        console.log(`    FAIL: ${check.name} — ${check.detail}`);
      }
    }
    if (result.screenshot) {
      console.log(`    Screenshot: ${result.screenshot}`);
    }
  }

  console.log('');
  console.log(`JSON report: ${jsonPath}`);
  console.log(`Screenshots: ${reportDir}`);

  return report;
}
