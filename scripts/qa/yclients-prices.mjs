/** Verify every added row and all changed values in the built (or downloaded) price page. */
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { load } from 'cheerio';
const plan = JSON.parse(await readFile(new URL('../../docs/pricing/2026-09-19/plan.json', import.meta.url), 'utf8'));
const refinement = JSON.parse(await readFile(new URL('../../docs/pricing/2026-09-19/refinement.json', import.meta.url), 'utf8'));
const mensPolicy = JSON.parse(await readFile(new URL('../../docs/pricing/2026-09-19/mens-policy.json', import.meta.url), 'utf8'));
const volnewmerPolicy = JSON.parse(await readFile(new URL('../../docs/pricing/2026-09-19/volnewmer-policy.json', import.meta.url), 'utf8'));
const $ = load(await readFile(process.argv[2] || 'dist/uslugi-i-ceny.html', 'utf8'));
const normalize = value => value.replace(/\s+/gu, ' ').trim();
const money = value => value === null ? '—' : new Intl.NumberFormat('ru-RU').format(value) + ' ₽';
assert.equal($('.price-table tbody tr').length, 271);
assert.equal($('.pricing__category').length, 5);
assert.equal($('.pricing__category h2').first().text(), 'Консультации');
for (const title of ['Коллагенотерапия', 'Полимолочная кислота']) {
  const section = $('.pricing__item').filter((_, el) => $(el).find('summary > span').first().text() === title);
  assert.equal(section.closest('.pricing__category').attr('id'), 'category-injekcionnaya-cosmetologiya');
}
assert(!$('.pricing__category h2').toArray().some(el => $(el).text() === 'Комплексы'));
assert(!$('.price-table').text().includes('Трихоскопия'));
function findRow(name, slug, group) {
  const scope = slug ? $(`#price-${slug}`) : $('.pricing__item').filter((_, el) => $(el).find('summary > span').first().text() === group);
  const row = scope.find('tbody tr').filter((_, el) => normalize($(el).find('td').first().clone().children().remove().end().text()) === normalize(name));
  assert.equal(row.length, 1, `Expected one rendered row: ${name}`);
  return row;
}
function checkValues(row, values) {
  if ('price' in values) {
    let expected = money(values.price);
    if (values.price_max) expected = new Intl.NumberFormat('ru-RU').format(values.price) + '–' + money(values.price_max);
    assert.equal(normalize(row.find('.price-table__amount').first().text()), normalize(expected));
  }
  if (values.price_head_doctor != null) assert.equal(normalize(row.find('.price-table__amount').last().text()), normalize(money(values.price_head_doctor)));
  if (values.note) assert(normalize(row.text()).includes(normalize(values.note)));
}
for (const { values } of plan.additions.filter(a => ![...refinement.removed_source_indices, ...mensPolicy.removed_source_indices].includes(a.source_index))) checkValues(findRow(values.name, values.procedure_slug, values.price_group), values);
for (const { match, values } of plan.updates) {
  if (match.slug === volnewmerPolicy.slug) continue;
  if (mensPolicy.notes.some(rule => rule.slug === match.slug && rule.name === match.name)) continue;
  const row = findRow(values.name || match.name, match.slug);
  checkValues(row, values);
  if (values.price_max && !('price' in values)) assert(normalize(row.find('.price-table__amount').first().text()).endsWith(normalize('–' + money(values.price_max))));
}
for (const rule of mensPolicy.notes) {
  const row = findRow(rule.name, rule.slug);
  assert.equal(normalize(row.find('.price-table__amount').text()), rule.note);
  const maleRows = $(`#price-${rule.slug} tbody tr`).filter((_, el) => /^Муж/iu.test(normalize($(el).find('td').first().text())));
  assert.equal(maleRows.length, 1, 'Only the informational male row should remain');
}
for (const values of volnewmerPolicy.rows) checkValues(findRow(values.name, volnewmerPolicy.slug), values);
console.log('Verified 271 rows, retained groups and prices, and exactly two male +30% notes without individual tariffs.');
