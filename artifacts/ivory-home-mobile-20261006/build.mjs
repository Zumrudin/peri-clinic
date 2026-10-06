import fs from 'node:fs/promises';
import path from 'node:path';
const root = 'artifacts/ivory-home-mobile-20261006';
const out = `${root}/site`;
await fs.cp('artifacts/ivory-home-20261006-v4/site', out, { recursive: true });
async function rewrite(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) await rewrite(file);
    else if (/\.(html|css|js)$/.test(entry.name)) {
      await fs.writeFile(file, (await fs.readFile(file, 'utf8')).replaceAll('/ivory-home-20261006-v4/', '/ivory-home-mobile-20261006/'));
    }
  }
}
await rewrite(out);
const html = await fs.readFile(`${out}/index.html`, 'utf8');
await fs.writeFile(`${out}/index.html`, html.replace('</head>', '<link rel="stylesheet" href="./mobile.css"></head>'));
await fs.copyFile(`${root}/mobile.css`, `${out}/mobile.css`);
