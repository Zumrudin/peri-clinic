/**
 * Writes .br and .gz siblings for text assets so nginx can serve them with
 * `brotli_static on; gzip_static on;`. Usage: node scripts/postbuild/precompress.mjs dist
 */
import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import { brotliCompressSync, gzipSync, constants } from 'node:zlib';

const root = process.argv[2] || 'dist';
const exts = new Set(['.html', '.css', '.js', '.mjs', '.svg', '.xml', '.json', '.txt', '.webmanifest']);
let files = 0;
let saved = 0;

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else if (exts.has(extname(name)) && st.size > 1024) {
      const buf = readFileSync(p);
      const br = brotliCompressSync(buf, {
        params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_SIZE_HINT]: buf.length },
      });
      const gz = gzipSync(buf, { level: 9 });
      writeFileSync(p + '.br', br);
      writeFileSync(p + '.gz', gz);
      files++;
      saved += buf.length - br.length;
    }
  }
}
walk(root);
console.log(`[precompress] ${files} files, brotli saved ${(saved / 1024).toFixed(0)} KB`);
