/**
 * Idempotent upsert of everything extracted in scripts/migrate/out/*.json into Directus,
 * via the same lib.mjs REST client used by directus/setup/*.mjs. Order matters: files →
 * devices → service_categories → procedures → faq_items → pages. Everything content
 * lands as `status: draft` (except the categories, already published in phase 3) so an
 * editor reviews before publishing — matches the phase-4 plan's design.
 *
 * Run: DIRECTUS_URL=... DIRECTUS_ADMIN_EMAIL=... DIRECTUS_ADMIN_PASSWORD=... node scripts/migrate/05-seed.mjs
 */
import { readFile, readdir } from 'node:fs/promises';
import { get, post, patch, login, BASE, log } from '../../directus/setup/lib.mjs';
import { OUT_DIR, MEDIA_DIR } from './lib.mjs';

async function readJson(url) {
  return JSON.parse(await readFile(url, 'utf8'));
}

async function upsert(collection, key, value, payload) {
  const existing = (await get(`/items/${collection}?filter[${key}][_eq]=${encodeURIComponent(value)}&limit=1`))[0];
  if (existing) {
    await patch(`/items/${collection}/${existing.id}`, payload);
    return existing.id;
  }
  return (await post(`/items/${collection}`, { [key]: value, ...payload })).id;
}

// --- files -------------------------------------------------------------------

const fileIdCache = new Map(); // originalWixUrl -> Directus file id
let mediaIndex = {};
let deviceFolderId = null;
let procedureFolderId = null;

async function folderId(name) {
  const found = (await get(`/folders?filter[name][_eq]=${encodeURIComponent(name)}`))[0];
  return found?.id ?? null;
}

async function uploadImage(wixUrl, { title, folder }) {
  if (!wixUrl) return null;
  if (fileIdCache.has(wixUrl)) return fileIdCache.get(wixUrl);

  const existingByTitle = (await get(`/files?filter[title][_eq]=${encodeURIComponent(title)}&limit=1`))[0];
  if (existingByTitle) {
    fileIdCache.set(wixUrl, existingByTitle.id);
    return existingByTitle.id;
  }

  const meta = mediaIndex[wixUrl];
  if (!meta) {
    log('WARN: no downloaded file for', wixUrl, '(run 04-download.mjs first) — skipping');
    return null;
  }
  const buf = await readFile(new URL(`./${meta.file}`, MEDIA_DIR));
  const ext = meta.file.split('.').pop();
  const type = { png: 'image/png', webp: 'image/webp', gif: 'image/gif' }[ext] ?? 'image/jpeg';

  const form = new FormData();
  if (folder) form.set('folder', folder);
  form.set('title', title);
  form.set('file', new Blob([buf], { type }), meta.file);

  const token = await login();
  const res = await fetch(`${BASE}/files`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  if (!res.ok) throw new Error(`upload ${title} → ${res.status}: ${await res.text()}`);
  const { data } = await res.json();
  fileIdCache.set(wixUrl, data.id);
  return data.id;
}

// --- main ----------------------------------------------------------------------

async function main() {
  mediaIndex = await readJson(new URL('./media-index.json', import.meta.url));
  deviceFolderId = await folderId('Аппараты');
  procedureFolderId = await folderId('Процедуры');

  const files = (await readdir(OUT_DIR)).filter((f) => f.endsWith('.json'));
  const pages = await Promise.all(files.map((f) => readJson(new URL(`./${f}`, OUT_DIR))));

  const categoryPages = pages.filter((p) => p.kind === 'category');
  const procedurePages = pages.filter((p) => p.kind === 'procedure');
  const legalPages = pages.filter((p) => p.kind === 'legal_page');

  log(`${categoryPages.length} categories, ${procedurePages.length} procedures, ${legalPages.length} legal pages`);

  // Some procedure pages exist and are live but aren't linked from any category page's
  // nav (e.g. /microtoki — see docs/CONTENT-MAP.md) — append them to their manifest
  // categoryHint's list so they still get seeded, at the end (sort order after the linked ones).
  const manifest = await readJson(new URL('./manifest.json', import.meta.url));
  for (const proc of procedurePages) {
    const linked = categoryPages.some((c) => c.procedureSlugs.includes(proc.slug));
    if (linked) continue;
    const hint = manifest.find((m) => m.slug === proc.slug)?.category;
    const cat = categoryPages.find((c) => c.slug === hint);
    if (cat) {
      cat.procedureSlugs.push(proc.slug);
      log(`  orphan procedure /${proc.slug} appended to /${cat.slug} (not linked from its category page)`);
    }
  }

  // 1) service_categories: update description/intro on the three already seeded in phase 3.
  log('service_categories...');
  const categoryIdBySlug = {};
  for (const cat of categoryPages) {
    const id = await upsert('service_categories', 'slug', cat.slug, {
      description: cat.intro ? `<p>${cat.intro}</p>` : undefined,
    });
    categoryIdBySlug[cat.slug] = id;
  }

  // 2) procedures: upsert by slug, status draft, sort = position within its category page.
  log('procedures...');
  const procedureIdBySlug = {};
  for (const cat of categoryPages) {
    let sort = 1;
    for (const slug of cat.procedureSlugs) {
      const proc = procedurePages.find((p) => p.slug === slug);
      if (!proc) {
        log(`  WARN: ${slug} listed on /${cat.slug} but no extracted procedure JSON — skipping`);
        continue;
      }
      const cover = await uploadImage(proc.cover_image, { title: `procedure-${proc.slug}-cover`, folder: procedureFolderId });

      const id = await upsert('procedures', 'slug', proc.slug, {
        status: 'draft',
        sort: sort++,
        title: proc.title,
        category: categoryIdBySlug[cat.slug],
        summary: proc.lead,
        lead: proc.lead,
        body: proc.body || null,
        cover: cover || undefined,
        steps: proc.steps.length ? proc.steps : undefined,
        indications: proc.indications && proc.indications !== '<p></p>' ? proc.indications : null,
        contraindications: proc.contraindications && proc.contraindications !== '<p></p>' ? proc.contraindications : null,
        legacy_wix_url: `https://www.peri-clinic.ru/${proc.slug}`,
      });
      procedureIdBySlug[proc.slug] = id;

      // Gallery: remaining images beyond the cover, capped to keep uploads reasonable.
      const galleryIds = [];
      for (const url of (proc.gallery_images ?? []).slice(1, 6)) {
        const fid = await uploadImage(url, { title: `procedure-${proc.slug}-gallery-${galleryIds.length + 1}`, folder: procedureFolderId });
        if (fid) galleryIds.push(fid);
      }
      if (galleryIds.length) {
        // procedures.gallery is a files-M2M; set via the junction collection directly.
        for (const fid of galleryIds) {
          const junctionExists = (
            await get(`/items/procedures_files?filter[procedures_id][_eq]=${id}&filter[directus_files_id][_eq]=${fid}&limit=1`)
          )[0];
          if (!junctionExists) await post('/items/procedures_files', { procedures_id: id, directus_files_id: fid });
        }
      }

      // FAQ: upsert by (procedure, question) — question text is the natural key here.
      for (const [i, item] of proc.faq.entries()) {
        const existing = (
          await get(`/items/faq_items?filter[procedure][_eq]=${id}&filter[question][_eq]=${encodeURIComponent(item.question)}&limit=1`)
        )[0];
        const payload = { status: 'draft', sort: i + 1, procedure: id, scope: 'procedure', question: item.question, answer: `<p>${item.answer}</p>` };
        if (existing) await patch(`/items/faq_items/${existing.id}`, payload);
        else await post('/items/faq_items', payload);
      }
    }
  }

  // 3) legal/info pages.
  log('pages...');
  for (const p of legalPages) {
    await upsert('pages', 'slug', p.slug, {
      status: 'draft',
      title: p.title,
      template: p.template ?? 'info',
      body: p.body || null,
      legacy_wix_url: `https://www.peri-clinic.ru/${p.slug}`,
    });
  }

  log('seed complete');
  log(`procedures seeded: ${Object.keys(procedureIdBySlug).length}, pages seeded: ${legalPages.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
