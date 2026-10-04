// Where does the clinic rank in Yandex for local queries? Region 213 = Moscow. Detects SmartCaptcha instead of guessing.
import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
const queries = process.argv.slice(2).length ? process.argv.slice(2) : [
  'косметологи Домодедовская', 'косметолог Домодедовская', 'косметология Домодедовская',
  'клиника косметологии Домодедовская', 'косметология метро Домодедовская', 'косметология Орехово-Борисово Южное',
  'косметология Генерала Белова', 'PERI CLINIC', 'Пери Клиник косметология',
];
const OUR = /peri-clinic\.ru/i;
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--lang=ru-RU'] });
const ctx = await browser.newContext({ locale: 'ru-RU', viewport: { width: 1366, height: 900 },
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36' });
await mkdir('docs/qa/yandex-serp', { recursive: true });
const page = await ctx.newPage();
const out = [];
for (const q of queries) {
  const url = `https://yandex.ru/search/?text=${encodeURIComponent(q)}&lr=213`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);
  const html = await page.content();
  const captcha = /smartcaptcha|showcaptcha|Подтвердите, что запросы|captcha/i.test(html) || /showcaptcha/.test(page.url());
  if (captcha) { out.push({ q, captcha: true }); await page.screenshot({ path: `docs/qa/yandex-serp/captcha.png` }); console.log(`CAPTCHA  ${q}`); continue; }
  const results = await page.evaluate(() => {
    const items = [...document.querySelectorAll('li.serp-item, .serp-item')];
    return items.map((el) => {
      const a = el.querySelector('a[href^="http"]');
      const title = (el.querySelector('h2, .OrganicTitle, .organic__title') || a)?.textContent?.trim() || '';
      return { href: a?.href || '', title, cls: el.className.slice(0, 80) };
    }).filter((r) => r.href);
  });
  const organic = results.filter((r) => !/yandex\.ru\/maps|yandex\.ru\/profile|yabs\.yandex|yandex\.ru\/search/.test(r.href));
  const pos = organic.findIndex((r) => OUR.test(r.href)) + 1;
  const mapsBlock = results.filter((r) => /yandex\.ru\/(maps|profile)/.test(r.href)).map((r) => r.title).filter(Boolean);
  const ours = organic.filter((r) => OUR.test(r.href)).map((r) => r.href);
  out.push({ q, total: organic.length, position: pos || null, ours, top: organic.slice(0, 10).map((r) => r.href.replace(/^https?:\/\//, '').split('/')[0]), mapsBlock: mapsBlock.slice(0, 5) });
  await page.screenshot({ path: `docs/qa/yandex-serp/${q.replace(/[^\p{L}\d]+/gu, '-')}.png`, fullPage: false });
  console.log(`${pos ? 'POS ' + pos : 'NONE '}  ${q}  (organic ${organic.length})`);
}
await browser.close();
console.log(JSON.stringify(out, null, 1));
