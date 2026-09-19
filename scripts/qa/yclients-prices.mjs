/** Verify every added row and all changed values in the built (or downloaded) price page. */
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { load } from 'cheerio';
const plan = JSON.parse(await readFile(new URL('../../docs/pricing/2026-09-19/plan.json', import.meta.url), 'utf8'));
const $ = load(await readFile(process.argv[2] || 'dist/uslugi-i-ceny.html', 'utf8'));
const normalize = value => value.replace(/\s+/gu, ' ').trim();
const money = value => value === null ? '—' : new Intl.NumberFormat('ru-RU').format(value) + ' ₽';
assert.equal($('.price-table tbody tr').length, 296);
assert.equal($('.pricing__category').length, 8);
function findRow(name, slug, group) {
  const scope = slug ? $(`#price-${slug}`) : $('.pricing__category').filter((_, el) => $(el).find('h2').text() === group);
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
for (const { values } of plan.additions) checkValues(findRow(values.name, values.procedure_slug, values.price_group), values);
for (const { match, values } of plan.updates) {
  const row = findRow(values.name || match.name, match.slug);
  checkValues(row, values);
  if (values.price_max && !('price' in values)) assert(normalize(row.find('.price-table__amount').first().text()).endsWith(normalize('–' + money(values.price_max))));
}
console.log('Verified 296 rendered rows, 8 groups, 75 additions and 8 updates.');
