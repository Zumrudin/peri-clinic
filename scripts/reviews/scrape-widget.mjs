/** Public widget fallback: only its visible selection, never a full Maps export. */
import { chromium } from 'playwright-core';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { normalize } from './import.mjs';
const out = process.argv[2];
if (!out) throw new Error('Usage: node scripts/reviews/scrape-widget.mjs <output-directory>');
const organization = '38588977489';
const source = `https://yandex.ru/maps-reviews-widget/${organization}?comments`;
const maps = `https://yandex.ru/maps/org/peri_clinic/${organization}/reviews/`;
const executablePath = process.env.CHROME_PATH || ['/usr/bin/google-chrome', '/usr/bin/chromium'].find(existsSync);
const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ locale: 'ru-RU', viewport: { width: 1000, height: 1000 } });
  await page.goto(source, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('.comment').first().waitFor({timeout:15000});
  const result = await page.evaluate(() => ({
    summary: document.querySelector('.mini-badge__rating')?.textContent?.trim(),
    rows: [...document.querySelectorAll('.comment')].flatMap(el => {
      const stars = [...el.querySelectorAll('.comment__stars .stars-list__star')];
      // Fail closed on any unfamiliar star modifier (empty or partial stars).
      if (stars.length !== 5 || stars.some(star => star.className !== 'stars-list__star')) return [];
      return [{ author_name: el.querySelector('.comment__name')?.textContent?.trim(),
        text: el.querySelector('.comment__text')?.textContent?.trim(),
        date_label: el.querySelector('.comment__date')?.textContent?.trim(), rating: 5 }];
    }),
  }));
  if (!result.rows.length) throw new Error('No confirmed five-star reviews: inspect widget markup');
  const reviews = result.rows.map(r => ({...r,
    // The widget exposes no original review ID. This fingerprint only deduplicates unchanged snapshots.
    id: 'widget-' + createHash('sha256').update(JSON.stringify([organization,r.author_name,r.text])).digest('hex'),
    date: null, source_url: maps, source_url_scope: 'organization',
  }));
  normalize(reviews);
  const metadata = { fetched_at: new Date().toISOString(), source, organization, count: reviews.length,
    scope: 'widget_selection_only', summary: result.summary,
    limitations: ['Not all organization reviews', 'Dates have no verified year', 'No original review IDs or individual permalinks; IDs are content fingerprints'] };
  const escape = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const html = `<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Отзывы PERI CLINIC — выборка Яндекса</title><style>body{font:16px/1.6 system-ui,sans-serif;color:#262620;background:#f6f4ee;margin:0;padding:24px}main{max-width:760px;margin:auto}h1{font-size:28px}article{background:white;border:1px solid #ddd8c8;border-radius:16px;padding:24px;margin:20px 0}h2{font-size:20px;margin:0}.stars{color:#876b27}blockquote{margin:16px 0;white-space:pre-wrap}small{color:#625e53}a{color:#6e5723}</style><main><h1>Отзывы с оценкой 5 звёзд</h1><p>PERI CLINIC · ${reviews.length} отзывов из публичного виджета Яндекса. Это частичная выборка, не полный список. Собрано ${escape(metadata.fetched_at.slice(0,10))}.</p><p>Тексты сохранены без редактирования. Год в виджете не указан. Ссылки открывают общий раздел отзывов клиники.</p>${reviews.map(r=>`<article><h2>${escape(r.author_name)}</h2><div class="stars" aria-label="5 из 5">★★★★★</div><small>${escape(r.date_label)} · год не указан</small><blockquote>${escape(r.text)}</blockquote><a href="${maps}" target="_blank" rel="noopener noreferrer">Отзывы клиники на Яндекс Картах</a></article>`).join('')}<p><a href="${source}">Источник: публичный виджет Яндекса</a></p></main></html>`;
  await mkdir(out,{recursive:true});
  await writeFile(`${out}/reviews.json`,JSON.stringify(reviews,null,2)+'\n');
  await writeFile(`${out}/metadata.json`,JSON.stringify(metadata,null,2)+'\n');
  await writeFile(`${out}/reviews.html`,html);
  await writeFile(`${out}/widget-source.html`,await page.content());
  console.log(JSON.stringify(metadata));
} finally { await browser.close(); }
