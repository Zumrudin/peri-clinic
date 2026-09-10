/**
 * axe-core accessibility scan across representative pages.
 * Usage: node scripts/qa/a11y.mjs <baseUrl> [paths...]
 * Example: node scripts/qa/a11y.mjs http://127.0.0.1:4322 / /result /kontakty
 * Exits non-zero if any page has a "serious" or "critical" violation.
 */
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';

const [baseUrl = 'http://127.0.0.1:4322', ...paths] = process.argv.slice(2);
const pages = paths.length ? paths : ['/'];

const executablePath =
  process.env.CHROME_PATH ||
  ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((p) => existsSync(p));

const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });
let hadFailure = false;

for (const path of pages) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(baseUrl + path, { waitUntil: 'networkidle' });
  const results = await new AxeBuilder({ page }).analyze();
  const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  const minor = results.violations.filter((v) => v.impact !== 'serious' && v.impact !== 'critical');

  console.log(`\n${path} — ${results.violations.length} violation(s) (${bad.length} serious/critical)`);
  for (const v of bad) {
    console.log(`  [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s))`);
    for (const n of v.nodes.slice(0, 3)) console.log(`    ${n.target.join(' ')}`);
  }
  for (const v of minor) {
    console.log(`  [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s)) — not blocking`);
  }
  if (bad.length > 0) hadFailure = true;
  await context.close();
}

await browser.close();
if (hadFailure) {
  console.error('\nFAIL: serious/critical accessibility violations found.');
  process.exit(1);
}
console.log('\nOK: no serious/critical accessibility violations.');
