/** Check every built treatment page at phone, tablet and desktop widths. */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { load } from 'cheerio';
import { chromium } from 'playwright-core';

const base = process.argv[2] || 'http://127.0.0.1:4322';
const paths = readdirSync('dist').filter(file => file.endsWith('.html') && load(readFileSync(`dist/${file}`, 'utf8'))('section.treatment-hero').length).map(file => `/${file.replace(/\.html$/, '')}`);
if (!paths.length) throw new Error('Build treatment pages before running QA.');
const executablePath = process.env.CHROME_PATH || ['/usr/bin/google-chrome', '/usr/bin/chromium'].find(existsSync);
const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });
const failures = [];
try {
  for (const width of [320, 375, 800, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    for (const path of paths) {
      await page.goto(base + path, { waitUntil: 'networkidle' });
      const errors = await page.evaluate(() => {
        const errors = [];
        if (document.querySelectorAll('h1').length !== 1) errors.push('Expected one h1');
        for (const link of document.querySelectorAll('.treatment-nav a')) {
          if (!document.querySelector(link.getAttribute('href'))) errors.push(`Missing anchor ${link.hash}`);
        }
        for (const el of document.querySelectorAll('section[class*="treatment-"] *, .treatment-nav')) {
          const rect = el.getBoundingClientRect();
          if (rect.width && (rect.right > innerWidth + 1 || rect.left < -1)) errors.push(`Overflow: ${el.tagName}.${el.className}`);
        }
        return [...new Set(errors)];
      });
      await page.locator('.treatment-hero [data-open-sheet]').click();
      if (!(await page.locator('#contact-sheet').evaluate(el => el.open))) errors.push('Booking dialog did not open');
      await page.keyboard.press('Escape');
      if (errors.length) failures.push({ path, width, errors });
    }
    await page.close();
    console.log(`${width}px: checked ${paths.length} treatment pages`);
  }
} finally { await browser.close(); }
if (failures.length) { console.error(JSON.stringify(failures, null, 2)); process.exitCode = 1; }
else console.log('OK: anchors, heading, booking dialog and horizontal bounds.');
