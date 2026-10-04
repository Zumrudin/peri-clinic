/** Build first. Compare every treatment page to its own CMS video selection. */
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { load } from 'cheerio';
process.loadEnvFile();
const response = await fetch(`${process.env.DIRECTUS_URL}/items/procedures?filter[status][_eq]=published&fields=slug,videos.id,videos.status,videos.sort,videos.title,videos.video&limit=-1`, { headers: { Authorization: `Bearer ${process.env.DIRECTUS_TOKEN}` } });
assert.ok(response.ok, `CMS HTTP ${response.status}`);
const { data } = await response.json();
for (const procedure of data) {
  const $ = load(await readFile(`dist/${procedure.slug}.html`, 'utf8'));
  const expected = (procedure.videos || []).filter(v => v.status === 'published' && v.video && v.title.trim()).sort((a, b) => (a.sort ?? Infinity) - (b.sort ?? Infinity) || a.id - b.id);
  assert.deepEqual($('.treatment-videos [data-reel] h3').map((_, el) => $(el).text()).get(), expected.map(v => v.title), procedure.slug);
  assert.equal($('.treatment-videos').length, expected.length ? 1 : 0, `${procedure.slug}: empty state`);
  if (!expected.length) continue;
  assert.equal($('.treatment-videos [data-mobile-only]').length, 1);
  if ($('#results').length) assert.ok($('.treatment-videos').next().is('#results'), `${procedure.slug}: placement`);
  for (const video of $('.treatment-videos video').toArray()) {
    for (const attribute of ['data-src', 'data-hls']) {
      const path = $(video).attr(attribute);
      assert.ok(path?.startsWith('/media/reels/'));
      await access(`dist${path}`);
    }
  }
}
console.log(`${data.length} services: isolated selections, publication, order, empty state and MP4/HLS files verified`);
