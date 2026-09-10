/**
 * Downloads raw SSR HTML for every non-redirect, non-home entry in manifest.json into
 * scripts/migrate/raw/<slug>.html (gitignored). Idempotent: skips files that already
 * exist unless --force is passed. Polite: 300ms between requests.
 * Run: node scripts/migrate/02-scrape.mjs [--force]
 */
import { readFile, writeFile, access } from 'node:fs/promises';
import { fetchHtml, ensureDir, RAW_DIR } from './lib.mjs';

const FORCE = process.argv.includes('--force');
const DELAY_MS = 300;

async function main() {
  const manifest = JSON.parse(await readFile(new URL('./manifest.json', import.meta.url), 'utf8'));
  await ensureDir(RAW_DIR);

  const targets = manifest.filter((m) => m.type !== 'redirect' && m.type !== 'home');
  let done = 0;
  let skipped = 0;
  for (const entry of targets) {
    const dest = new URL(`./${entry.slug}.html`, RAW_DIR);
    if (!FORCE) {
      try {
        await access(dest);
        skipped++;
        continue;
      } catch {}
    }
    const html = await fetchHtml(entry.wixUrl);
    await writeFile(dest, html);
    done++;
    console.log(`scraped ${entry.slug} (${html.length} bytes)`);
    await new Promise((r) => setTimeout(r, DELAY_MS));
  }
  console.log(`done: ${done} fetched, ${skipped} already cached (use --force to refetch)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
