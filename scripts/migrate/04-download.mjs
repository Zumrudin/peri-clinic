/**
 * Downloads every unique image referenced by scripts/migrate/out/*.json (procedure
 * cover_image + gallery_images) into scripts/migrate/media/<sha1>.<ext>, with an index
 * mapping the original Wix URL to the local file + dimensions (via sharp). Idempotent:
 * skips URLs already present in media-index.json.
 * Run: node scripts/migrate/04-download.mjs
 */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { ensureDir, OUT_DIR, MEDIA_DIR } from './lib.mjs';

const INDEX_PATH = new URL('./media-index.json', import.meta.url);

async function loadIndex() {
  try {
    return JSON.parse(await readFile(INDEX_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function extOf(contentType, url) {
  if (contentType?.includes('png')) return 'png';
  if (contentType?.includes('webp')) return 'webp';
  if (contentType?.includes('gif')) return 'gif';
  if (/\.png(\?|$)/i.test(url)) return 'png';
  return 'jpg';
}

async function main() {
  await ensureDir(MEDIA_DIR);
  const index = await loadIndex();

  const files = (await readdir(OUT_DIR)).filter((f) => f.endsWith('.json'));
  const urls = new Set();
  for (const f of files) {
    const data = JSON.parse(await readFile(new URL(`./${f}`, OUT_DIR), 'utf8'));
    if (data.cover_image) urls.add(data.cover_image);
    for (const u of data.gallery_images ?? []) urls.add(u);
  }

  let downloaded = 0;
  let skipped = 0;
  for (const url of urls) {
    if (index[url]) {
      skipped++;
      continue;
    }
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`skip (${res.status}): ${url}`);
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const sha1 = createHash('sha1').update(buf).digest('hex');
    const ext = extOf(res.headers.get('content-type'), url);
    const filename = `${sha1}.${ext}`;
    await writeFile(new URL(`./${filename}`, MEDIA_DIR), buf);

    let width = null;
    let height = null;
    try {
      const meta = await sharp(buf).metadata();
      width = meta.width;
      height = meta.height;
    } catch {}

    index[url] = { file: filename, width, height, bytes: buf.length };
    downloaded++;
    console.log(`downloaded ${filename} (${buf.length} bytes) ← ${url}`);
  }

  await writeFile(INDEX_PATH, JSON.stringify(index, null, 2));
  console.log(`done: ${downloaded} downloaded, ${skipped} already cached, ${urls.size} total referenced`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
