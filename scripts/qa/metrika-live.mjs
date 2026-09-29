// Live check of the real counter on production: nothing before consent, hits after, silence after revoke.
// Unlike cookie-analytics.mjs this sends a handful of REAL hits to the clinic's counter — run sparingly.
// Usage: node scripts/qa/metrika-live.mjs [https://www.peri-clinic.ru]
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
const base = process.argv[2] || 'https://www.peri-clinic.ru';
const COUNTER = '99099738';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
async function fixture() {
  const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1280, height: 900 } });
  const yandex = [];
  ctx.on('request', (r) => { if (/mc\.yandex/.test(r.url())) yandex.push({ url: r.url(), status: null }); });
  ctx.on('response', (r) => { if (/mc\.yandex/.test(r.url())) { const e = yandex.find((x) => x.url === r.url() && x.status === null); if (e) e.status = r.status(); } });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base + '/');
  await page.waitForFunction(() => document.querySelector('[data-cookie-notice]')?.dataset.initialized === 'true');
  return { ctx, page, yandex, errors };
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, extra = '') => { results.push({ name, ok, extra }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); };
try {
  // 1. Fresh visitor: banner shown, counter configured, zero requests to Yandex.
  let { ctx, page, yandex, errors } = await fixture();
  const counter = await page.getAttribute('[data-cookie-notice]', 'data-counter');
  check('data-counter is the real counter', counter === COUNTER, counter);
  check('banner visible on first visit', await page.locator('[data-cookie-notice]').isVisible());
  check('accept button enabled', !(await page.locator('[data-cookie-accept]').isDisabled()));
  await wait(3000);
  check('no Yandex requests before consent', yandex.length === 0, JSON.stringify(yandex));

  // 2. Accept: tag.js loads, a hit for the current page is sent and answered.
  await page.locator('[data-cookie-accept]').click();
  await page.waitForFunction(() => typeof window.ym === 'function' && !!document.querySelector('script[data-peri-metrika]'));
  await page.waitForFunction((c) => !!window[`yaCounter${c}`], COUNTER, { timeout: 15000 }).catch(() => {});
  await wait(4000);
  const tag = yandex.find((r) => r.url.endsWith('/metrika/tag.js'));
  const watch = yandex.filter((r) => new RegExp(`/watch/${COUNTER}`).test(r.url));
  check('tag.js loaded after consent', !!tag && tag.status === 200, tag && `${tag.status}`);
  // Metrika answers the very first /watch request with a 302 to its cookie-sync endpoint; that is normal.
  check('hit sent to counter after consent', watch.some((w) => w.status === 200) && watch.every((w) => [200, 302].includes(w.status)), JSON.stringify(watch.map((w) => w.status)));
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('peri_analytics_consent')));
  check('stored consent bound to counter', stored?.choice === 'accepted' && stored.counter === COUNTER, JSON.stringify(stored));
  const ymCookie = (await ctx.cookies()).filter((c) => /^_ym/.test(c.name)).map((c) => c.name);
  check('first-party _ym cookies set', ymCookie.length > 0, ymCookie.join(','));

  // 3. Client-side navigation is reported as a new hit.
  const before = yandex.length;
  await page.locator('a[href="/kontakty"]').first().click();
  await page.waitForURL(/\/kontakty$/);
  await wait(3000);
  const navHits = yandex.slice(before).filter((r) => new RegExp(`/watch/${COUNTER}`).test(r.url) && /kontakty/.test(decodeURIComponent(r.url)));
  check('navigation hit for /kontakty', navHits.length >= 1, JSON.stringify(navHits.map((w) => w.status)));

  // 4. Revoke from footer settings: counter disabled, cookies cleared, no more hits.
  await page.locator('[data-cookie-settings]').first().click();
  await page.locator('[data-cookie-revoke]').click();
  await wait(1000);
  check('disableYaCounter set after revoke', await page.evaluate((c) => window[`disableYaCounter${c}`] === true, COUNTER));
  const cookiesAfter = (await ctx.cookies()).filter((c) => /^_ym/.test(c.name) && c.domain.includes('peri-clinic.ru')).map((c) => c.name);
  check('first-party _ym cookies removed', cookiesAfter.length === 0, cookiesAfter.join(','));
  const afterRevoke = yandex.length;
  await page.locator('a[href="/"]').first().click();
  await page.waitForURL(/\/$/);
  await wait(3000);
  const late = yandex.slice(afterRevoke).filter((r) => /\/watch\//.test(r.url));
  check('no hits after revoke', late.length === 0, JSON.stringify(late));
  check('no page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();

  // 5. Reject: no requests at all, banner stays hidden on reload.
  ({ ctx, page, yandex, errors } = await fixture());
  await page.locator('[data-cookie-reject]').click();
  await page.reload();
  await page.waitForFunction(() => document.querySelector('[data-cookie-notice]')?.dataset.initialized === 'true');
  await wait(3000);
  check('reject: no Yandex requests', yandex.length === 0, JSON.stringify(yandex));
  check('reject: banner hidden after reload', !(await page.locator('[data-cookie-notice]').isVisible()));
  await ctx.close();
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
