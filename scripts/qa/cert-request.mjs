// Real config GET through nginx; all submissions/PDF responses are intercepted.
import { chromium } from 'playwright-core';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
const base = process.argv[2] || 'http://127.0.0.1:4397';
const out = process.argv[3] || 'docs/qa/cert-request';
const api = '/api/public/cert-requests/clinic-1';
const configResponse = await fetch(base + api + '/config');
assert.equal(configResponse.status, 200);
const config = await configResponse.json();
assert.ok(config.years.length > 0);
assert.equal(configResponse.headers.get('cache-control'), 'no-store');
assert.equal((await fetch(base + '/api/public/cert-requests/clinic-2/config')).status, 404);
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || ['/usr/bin/google-chrome', '/usr/bin/chromium'].find(existsSync), args: ['--no-sandbox'] });
mkdirSync(out, { recursive: true });
let posts = [];
let mode = 'success';
let failConfig = false;
let pdfMode = 'success';
const context = await browser.newContext({ reducedMotion: 'reduce' });
await context.addInitScript(() => localStorage.setItem('peri_consent', '0'));
await context.route('**/api/public/cert-requests/**', async route => {
  const request = route.request();
  if (request.method() === 'POST') {
    posts.push(request.postDataJSON());
    if (mode === 'network') return route.abort('failed');
    await new Promise(resolve => setTimeout(resolve, 150));
    if (mode === 'validation') return route.fulfill({ status: 400, json: { error: 'validation', fields: ['payer_inn', '<img src=x onerror=alert(1)>'] } });
    if (mode === 'limit') return route.fulfill({ status: 429, json: { error: 'too_many_requests' } });
    return route.fulfill({ json: { ok: true, applicationToken: 'a'.repeat(48) } });
  }
  if (request.url().endsWith('/config')) return route.fulfill({ status: failConfig ? 503 : 200, json: failConfig ? {} : config });
  if (request.url().includes('/application/')) {
    if (pdfMode === 'expired') return route.fulfill({ status: 404, json: { error: 'expired' } });
    if (pdfMode === 'network') return route.abort('failed');
    return route.fulfill({ contentType: 'application/pdf', body: '%PDF-1.4\n%%EOF' });
  }
  return route.abort();
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
async function open() {
  await page.goto(base + '/spravka', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !document.getElementById('cr-submit').disabled);
}
async function fill(prefix = 'payer') {
  const values = { last: 'Тестов', first: 'Тест', middle: 'Тестович', birthdate: '1990-01-01', inn: '123456789012', doc_serie_number: '1234 567890', phone: '8 999 123 45 67' };
  for (const [field, value] of Object.entries(values)) await page.locator(`#cr-${prefix}_${field}`).fill(value);
  await page.locator(`#cr-${prefix}_${prefix === 'payer' ? 'doc_issue_date' : 'doc_date'}`).fill('2010-01-01');
}
try {
  await open();
  assert.equal(await page.locator('iframe').count(), 0);
  assert.equal(await page.locator('#cr-policy').getAttribute('href'), '/politika');
  await page.locator('#cr-submit').click();
  assert.equal(posts.length, 0);
  assert.match(await page.locator('#cr-error').innerText(), /согласии/);
  await fill();
  await page.locator('#cr-consent').check();
  await page.locator('#cr-payer_is_patient').uncheck();
  await page.locator('#cr-submit').click();
  assert.equal(posts.length, 0);
  assert.match(await page.locator('#cr-error').innerText(), /пациента/);
  await fill('patient');
  await page.locator('#cr-patient_doc_type_code').selectOption('03');
  await page.locator('#cr-patient_doc_serie_number').fill('II-МЮ №123456');
  assert.match(await page.locator('#cr-patient_doc_label').innerText(), /свидетельства/);
  await page.locator('#cr-relationship').selectOption('child');
  for (const scenario of ['validation', 'limit', 'network']) {
    mode = scenario;
    await page.locator('#cr-submit').click();
    await page.waitForFunction(() => !document.getElementById('cr-submit').disabled);
    assert.ok((await page.locator('#cr-error').innerText()).length > 0);
    assert.equal(await page.locator('#cr-error img').count(), 0);
    assert.equal(await page.locator('#cr-payer_first').inputValue(), 'Тест');
  }
  mode = 'success';
  const before = posts.length;
  await page.locator('#cr-form').evaluate(form => {
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    form.dispatchEvent(new Event('submit', { cancelable: true }));
  });
  await page.locator('#cr-success-title').waitFor({ state: 'visible' });
  assert.equal(posts.length, before + 1);
  assert.equal(posts.at(-1).payer_phone, '+79991234567');
  assert.equal(posts.at(-1).patient_phone, '+79991234567');
  assert.equal(posts.at(-1).payer_is_patient, false);
  assert.equal(posts.at(-1).patient_doc_type_code, '03');
  const download = page.waitForEvent('download');
  await page.locator('#cr-download').click();
  assert.equal((await download).suggestedFilename(), 'zayavlenie.pdf');
  pdfMode = 'expired';
  await page.locator('#cr-download').click();
  await page.waitForFunction(() => document.getElementById('cr-download-error').textContent.includes('истёк'));
  pdfMode = 'network';
  await page.locator('#cr-download').click();
  await page.waitForFunction(() => document.getElementById('cr-download-error').textContent.includes('повторно'));
  assert.equal(posts.length, before + 1);
  await open();
  await fill();
  await page.locator('#cr-consent').check();
  await page.locator('#cr-submit').click();
  await page.locator('#cr-success-title').waitFor({ state: 'visible' });
  assert.equal(posts.at(-1).payer_is_patient, true);
  failConfig = true;
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.locator('#cr-submit').isDisabled(), true);
  failConfig = false;
  await page.locator('#cr-retry').click();
  await page.waitForFunction(() => !document.getElementById('cr-submit').disabled);
  for (const width of [375, 800, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await open();
    await page.evaluate(() => document.querySelectorAll('.reveal').forEach(el => el.classList.add('is-visible')));
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: `${out}/spravka-${width}.png`, fullPage: true });
    await page.locator('#cr-payer_is_patient').uncheck();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const result = await new AxeBuilder({ page }).include('.cert-request').analyze();
    assert.deepEqual(result.violations.filter(v => ['serious', 'critical'].includes(v.impact)).map(v => v.id), []);
  }
  assert.deepEqual(errors, []);
  console.log('PASS: real config/proxy isolation; self/relative; validation, rate limit, network failure; duplicate submit; PDF, expiry, retry; config retry; 375/800/1440 layout and accessibility. No real submissions.');
} finally { await browser.close(); }
