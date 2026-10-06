import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { load } from 'cheerio';

const root = 'artifacts/directions-integration-20261006';
const photos = [
  ['apparatus', 'artifacts/directions-integration-20261006/originals/apparatus.png'],
  ['lips', 'artifacts/directions-integration-20261006/originals/lips.png'],
  ['aesthetic', 'artifacts/directions-integration-20261006/originals/aesthetic.png'],
];
const versions = [
  ['ivory-home-mobile-20261006-v14', 'ivory-home-mobile-20261006-v15'],
  ['ivory-home-20261006-v4', 'ivory-home-20261006-v5'],
];
for (const [previous, version] of versions) {
  const out = `artifacts/${version}/site`;
  await fs.cp(`artifacts/${previous}/site`, out, { recursive: true });
  async function rewrite(dir) {
    for (const item of await fs.readdir(dir, { withFileTypes: true })) {
      const file = path.join(dir, item.name);
      if (item.isDirectory()) await rewrite(file);
      else if (/\.(html|css|js)$/.test(item.name)) {
        await fs.writeFile(file, (await fs.readFile(file, 'utf8')).replaceAll(`/${previous}/`, `/${version}/`));
      }
    }
  }
  await rewrite(out);
  const $ = load(await fs.readFile(`${out}/index.html`, 'utf8'));
  const links = $('#services .service-card').map((_, el) => $(el).attr('href')).get();
  if (links.length !== 3) throw new Error('Expected three original category links');
  await fs.mkdir(`${out}/directions`, { recursive: true });
  const dimensions = [];
  for (const [key, source] of photos) {
    // Full source resolution and lossless encoding preserve approved faces and branding.
    const meta = await sharp(source).metadata();
    await sharp(source).webp({ lossless: true, effort: 6 }).toFile(`${out}/directions/${key}.webp`);
    dimensions.push(meta);
  }
  const titles = ['Аппаратная', 'Инъекционная', 'Эстетическая'];
  const descriptions = ['Лифтинг · Омоложение · Качество кожи', 'Контуры · Увлажнение · Гармонизация', 'Уход · Восстановление · Сияние'];
  const alts = ['Аппаратная процедура — пациентка в фирменном халате PERI CLINIC', 'Крупный план губ с натуральным розовым блеском', 'Уход за лицом — пациентка в фирменном халате PERI CLINIC'];
  $('#services').html(`<div class="directions-heading"><h2>Забота, подобранная<br>именно для вас</h2><p>Начинаем с консультации и составляем персональный план — без лишних процедур и навязанных решений.</p></div><div class="directions-grid">${photos.map(([key], i) => `<a class="direction-card direction-card--${key}" href="${links[i]}"><img class="direction-photo" src="./directions/${key}.webp" width="${dimensions[i].width}" height="${dimensions[i].height}" alt="${alts[i]}" loading="lazy" decoding="async"><div class="direction-copy"><h3>${titles[i]}<br>косметология</h3><p>${descriptions[i]}</p><span class="direction-arrow" aria-hidden="true">→</span></div></a>`).join('')}</div>`);
  $('head').append('<link rel="stylesheet" href="./directions.css">');
  await fs.writeFile(`${out}/index.html`, $.html());
  await fs.copyFile(`${root}/directions.css`, `${out}/directions.css`);
  await fs.writeFile(`artifacts/${version}/.gitignore`, 'site/\n');
  console.log(version, dimensions.map(({width,height}) => `${width}×${height}`).join(', '));
}
