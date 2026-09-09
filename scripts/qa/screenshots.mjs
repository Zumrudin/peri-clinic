/**
 * Full-page screenshots at 3 widths for visual QA.
 * Usage: node scripts/qa/screenshots.mjs <baseUrl> <outDir> [paths...]
 * Example: node scripts/qa/screenshots.mjs http://127.0.0.1:4322 docs/qa/phase-0 / /result
 */
import { chromium } from 'playwright-core';
import { mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const [baseUrl = 'http://127.0.0.1:4322', outDir = 'docs/qa', ...paths] = process.argv.slice(2);
const pages = paths.length ? paths : ['/'];
const widths = [375, 800, 1440];

const executablePath =
  process.env.CHROME_PATH ||
  ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((p) => existsSync(p));

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });

for (const path of pages) {
  for (const width of widths) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
    await page.goto(baseUrl + path, { waitUntil: 'networkidle' });
    // Scroll through the page so IntersectionObserver reveals everything, then back to top.
    const revealed = await page.evaluate(async () => {
      // Make lazy images load now and wait for every image to finish.
      document.querySelectorAll('img[loading="lazy"]').forEach((img) => (img.loading = 'eager'));
      await Promise.all(
        [...document.images].map((img) =>
          img.complete ? null : new Promise((r) => ((img.onload = r), (img.onerror = r))),
        ),
      );
      const step = 500;
      const max = document.documentElement.scrollHeight;
      for (let y = 0; y <= max; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 90));
      }
      // Force-show anything the observer did not catch (e.g. below the last scroll stop).
      document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible'));
      window.scrollTo(0, 0);
      await new Promise((r) => setTimeout(r, 1000));
      return document.querySelectorAll('.reveal.is-visible').length;
    });
    const name = (path === '/' ? 'index' : path.replace(/^\//, '').replace(/\//g, '_')) + `-${width}.png`;
    await page.screenshot({ path: join(outDir, name), fullPage: true, animations: 'disabled' });
    console.log('saved', join(outDir, name), `(revealed ${revealed})`);
    await page.close();
  }
}
await browser.close();
