/** Build first. Compare every treatment page to its own CMS video selection. */
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { load } from 'cheerio';
process.loadEnvFile();
const response = await fetch(`${process.env.DIRECTUS_URL}/items/procedures?filter[status][_eq]=published&fields=slug,videos.id,videos.status,videos.sort,videos.title,videos.video,videos.image&limit=-1`, { headers: { Authorization: `Bearer ${process.env.DIRECTUS_TOKEN}` } });
assert.ok(response.ok, `CMS HTTP ${response.status}`);
const { data } = await response.json();
for (const procedure of data) {
  const $ = load(await readFile(`dist/${procedure.slug}.html`, 'utf8'));
  const expected = (procedure.videos || []).filter(v => v.status === 'published' && v.video && v.title.trim()).sort((a, b) => (a.sort ?? Infinity) - (b.sort ?? Infinity) || a.id - b.id);
  assert.deepEqual($('.treatment-videos [data-reel] h3').map((_, el) => $(el).text()).get(), expected.map(v => v.title), procedure.slug);
  assert.equal($('.treatment-videos').length, expected.length ? 1 : 0, `${procedure.slug}: empty state`);
  if (!expected.length) continue;
  assert.equal($('.treatment-videos [data-mobile-only]').length, 0, `${procedure.slug}: shown at every width`);
  if ($('#results').length) assert.ok($('.treatment-videos').next().is('#results'), `${procedure.slug}: placement`);
  for (const [index, video] of $('.treatment-videos video').toArray().entries()) {
    for (const attribute of ['data-src', 'data-hls']) {
      const path = $(video).attr(attribute);
      assert.ok(path?.startsWith('/media/reels/'));
      await access(`dist${path}`);
    }
    // An editor cover wins; otherwise the build's first frame keeps the card from looking empty.
    const poster = $(video).attr('data-poster');
    assert.equal(/^\/media\/posters\/.+-v1\.webp$/.test(poster || ''), !expected[index].image, `${procedure.slug}: poster ${index + 1}`);
    await access(`dist${poster}`);
  }
}
console.log(`${data.length} services: isolated selections, publication, order, empty state, MP4/HLS files and posters verified`);
