# Редизайн каталога аппаратов (/apparaty) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat `.catalog__card` grid on `/apparaty` with a `CaseCard`-style card (gold border, chip, serif title) fed by real manufacturer/country/short data seeded into Directus, matching the approved design mockup.

**Architecture:** Directus already has `manufacturer`/`country` fields on the `devices` collection (schema, currently empty on every row) — this plan wires them through the existing Content Layer pipeline (`content.config.ts` → `src/lib/deviceContent.ts` → `src/pages/apparaty.astro`), adds one new `home.devices_catalog_lead` field for the page intro, seeds real content into Directus via a one-off migration script (repo convention: `scripts/migrate/NN-*.mjs`, dry-run by default), and rewrites the page template/styles. No new dependencies.

**Tech Stack:** Astro (Content Layer loaders, `astro:assets` `<Image>`), Directus REST (`directus/setup/lib.mjs` admin client for schema+content), `node --test` for the one pure function this feature adds, Playwright-core QA scripts (`scripts/qa/screenshots.mjs`, `scripts/qa/a11y.mjs`) as this repo's visual/a11y test harness (there is no DOM/visual-diff unit-test framework here).

Spec: `docs/superpowers/specs/2026-09-13-apparaty-redesign-design.md`
Approved reference screenshots (already committed): `docs/qa/apparaty-redesign/apparaty-{375,800,1440}.png`

---

## Before you start

This is a shared box — `ps aux | grep astro` will show other unrelated dev/preview servers on ports like 4321/4322/4332/4333/4399 belonging to other sessions/worktrees. **Do not stop or restart any of them.** Pick your own free port for this plan's QA runs:

```bash
ss -ltn 2>/dev/null | grep -E ':(4599)\b' || echo "4599 is free"
```

If 4599 is taken, pick another unused port and use it consistently below instead.

Start an isolated dev server. **Important:** this sandbox's shell has `NODE_ENV=production` set, which silently breaks Astro's dev-only `/_image` endpoint (`import.meta.env.DEV` reads false, every image 500s with "The dev image endpoint can only be used in dev mode" in `.astro/dev.log`, and screenshots come back with blank product photos). Override it explicitly:

```bash
cd /root/peri-clinnic.ru
source /root/.nvm/nvm.sh && nvm use
NODE_ENV=development nohup npx astro dev --port 4599 --host 127.0.0.1 > /tmp/apparaty-qa-dev.log 2>&1 &
echo $! > /tmp/apparaty-qa-dev.pid
```

Wait until it's actually serving (the process can print "Dev server running" a moment before the port accepts connections):

```bash
until curl -s -o /dev/null http://127.0.0.1:4599/apparaty; do sleep 1; done
curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:4599/_image?href=%2F%40fs%2Froot%2Fperi-clinnic.ru%2Fsrc%2Fassets%2Fhome%2Flogo.png%3ForigWidth%3D626%26origHeight%3D124%26origFormat%3Dpng&w=184&h=36&f=webp"
```

Expected: second command prints `200` (confirms the `NODE_ENV` override worked — if it prints `500`, the dev server was started without the override, kill it and redo the previous step).

Directus itself is already running via pm2 (`peri-directus`) and reachable at `DIRECTUS_URL` from `.env` (`http://127.0.0.1:8055`) — no extra setup.

At the end of the plan (last step of Task 5), stop the dev server:

```bash
kill "$(cat /tmp/apparaty-qa-dev.pid)"
```

---

### Task 1: Directus schema — `devices.manufacturer`/`country` through the loader, new `home.devices_catalog_lead` field

**Files:**
- Modify: `directus/setup/collections.mjs:202` (add one field definition)
- Modify: `src/content.config.ts:66-90` (`homeFields` array), `:117-140` (`home` schema), `:266-285` (`allDevices` collection)

`manufacturer`/`country` already exist on the Directus `devices` collection (`directus/setup/collections.mjs:299-313`, already declared) — they're just not fetched/typed by the `allDevices` Content Layer collection yet. `devices_catalog_lead` is a genuinely new field.

- [ ] **Step 1: Add the new home field definition**

Open `directus/setup/collections.mjs`. Find (currently line 202):

```js
      f.str('devices_catalog_title', 'Заголовок каталога'),
      f.str('devices_catalog_seo_title', 'SEO-заголовок каталога'),
```

Replace with:

```js
      f.str('devices_catalog_title', 'Заголовок каталога'),
      f.text('devices_catalog_lead', 'Лид каталога'),
      f.str('devices_catalog_seo_title', 'SEO-заголовок каталога'),
```

- [ ] **Step 2: Fetch/type the new field on the `home` collection**

Open `src/content.config.ts`. Find in the `homeFields` array (currently lines 72-74):

```ts
  'devices_catalog_title',
  'devices_catalog_seo_title',
  'devices_catalog_seo_description',
```

Replace with:

```ts
  'devices_catalog_title',
  'devices_catalog_lead',
  'devices_catalog_seo_title',
  'devices_catalog_seo_description',
```

Then find in the `home` collection's `schema` (currently lines 123-125):

```ts
    devices_catalog_title: z.string().nullable().optional(),
    devices_catalog_seo_title: z.string().nullable().optional(),
    devices_catalog_seo_description: z.string().nullable().optional(),
```

Replace with:

```ts
    devices_catalog_title: z.string().nullable().optional(),
    devices_catalog_lead: z.string().nullable().optional(),
    devices_catalog_seo_title: z.string().nullable().optional(),
    devices_catalog_seo_description: z.string().nullable().optional(),
```

- [ ] **Step 3: Fetch/type `manufacturer`/`country` on the `allDevices` collection**

In the same file, find the `allDevices` collection (currently lines 266-285):

```ts
const allDevices = defineCollection({
  loader: directusLoader('allDevices', () =>
    directusGet(
      `/items/devices${directusQuery({
        fields: `id,sort,name,short,procedure.slug,procedure.status,${fileFields('image')}`,
        filter: JSON.stringify({ status: { _eq: 'published' } }),
        sort: 'sort',
        limit: '-1',
      })}`,
    ),
  ),
  schema: z.object({
    id: z.number(),
    sort: z.number().nullable().optional(),
    name: z.string(),
    short: z.string().nullable().optional(),
    image: fileRef,
    procedure: z.object({ slug: z.string(), status: z.string() }).nullable().optional(),
  }),
});
```

Replace with:

```ts
const allDevices = defineCollection({
  loader: directusLoader('allDevices', () =>
    directusGet(
      `/items/devices${directusQuery({
        fields: `id,sort,name,short,manufacturer,country,procedure.slug,procedure.status,${fileFields('image')}`,
        filter: JSON.stringify({ status: { _eq: 'published' } }),
        sort: 'sort',
        limit: '-1',
      })}`,
    ),
  ),
  schema: z.object({
    id: z.number(),
    sort: z.number().nullable().optional(),
    name: z.string(),
    short: z.string().nullable().optional(),
    manufacturer: z.string().nullable().optional(),
    country: z.string().nullable().optional(),
    image: fileRef,
    procedure: z.object({ slug: z.string(), status: z.string() }).nullable().optional(),
  }),
});
```

- [ ] **Step 4: Create the new field in Directus and verify the loader picks everything up**

The field must exist in Directus before the content loader can fetch it (fetching an unknown field errors). Create it directly (Task 3 will also do this idempotently for a fresh environment, but do it now so you can verify this task in isolation):

```bash
node --input-type=module -e "
const { get, post } = await import('./directus/setup/lib.mjs');
const { collections } = await import('./directus/setup/collections.mjs');
const fields = await get('/fields/home');
if (!fields.some(f => f.field === 'devices_catalog_lead')) {
  const def = collections.find(c => c.collection === 'home').fields.find(f => f.field === 'devices_catalog_lead');
  await post('/fields/home', def);
  console.log('created devices_catalog_lead');
} else {
  console.log('devices_catalog_lead already exists');
}
"
```

Expected: prints `created devices_catalog_lead` (or `already exists` on a rerun — idempotent).

Restart the isolated dev server so the Content Layer re-syncs against the new schema (it caches on boot):

```bash
kill "$(cat /tmp/apparaty-qa-dev.pid)"
NODE_ENV=development nohup npx astro dev --port 4599 --host 127.0.0.1 > /tmp/apparaty-qa-dev.log 2>&1 &
echo $! > /tmp/apparaty-qa-dev.pid
until curl -s -o /dev/null http://127.0.0.1:4599/apparaty; do sleep 1; done
grep -i "error\|Directus GET" /tmp/apparaty-qa-dev.log | tail -20
```

Expected: no `Directus GET .../items/devices... → 4xx/5xx` or `Directus GET .../items/home... → 4xx/5xx` errors in the log (an unknown-field typo would show up here as a 400).

- [ ] **Step 5: Type-check**

```bash
npm run check
```

Expected: no new diagnostics.

- [ ] **Step 6: Commit**

```bash
git add directus/setup/collections.mjs src/content.config.ts
git commit -m "feat: expose device manufacturer/country and a new catalog lead field

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: `deviceChip()` pure function (TDD) + wire into `getAllDevices()`/`getHomeContent()`

**Files:**
- Create: `src/lib/deviceContent.test.ts`
- Modify: `src/lib/deviceContent.ts` (full file, currently 16 lines)
- Modify: `src/lib/homeContent.ts:78-80`

- [ ] **Step 1: Write the failing test**

Create `src/lib/deviceContent.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deviceChip } from './deviceContent.ts';

test('deviceChip(): joins manufacturer and country with a comma', () => {
  assert.equal(deviceChip('InMode Ltd.', 'Израиль'), 'InMode Ltd., Израиль');
});

test('deviceChip(): falls back to whichever value is present', () => {
  assert.equal(deviceChip('InMode Ltd.', null), 'InMode Ltd.');
  assert.equal(deviceChip(null, 'Израиль'), 'Израиль');
});

test('deviceChip(): empty string when both are missing', () => {
  assert.equal(deviceChip(null, null), '');
  assert.equal(deviceChip(undefined, undefined), '');
});
```

- [ ] **Step 2: Run it and confirm it FAILS**

```bash
node --test src/lib/deviceContent.test.ts
```

Expected: fails to even load — `deviceChip` is not exported from `./deviceContent.ts` yet.

- [ ] **Step 3: Implement `deviceChip()` and wire it into `getAllDevices()`**

Replace the full contents of `src/lib/deviceContent.ts`:

```ts
import { getCollection } from 'astro:content';
import { bySort } from './directus';
import { directusImage } from './media';

/** "Производитель, Страна" chip text for a device card — omits whichever half is missing. */
export function deviceChip(manufacturer?: string | null, country?: string | null): string {
  return [manufacturer, country].filter(Boolean).join(', ');
}

export async function getAllDevices() {
  const [devices, procedures] = await Promise.all([getCollection('allDevices'), getCollection('procedures')]);
  const publishedSlugs = new Set(procedures.map(({ data }) => data.slug));
  return bySort(devices).map(({ data: d }) => ({
    id: d.id,
    name: d.name,
    short: d.short || '',
    chip: deviceChip(d.manufacturer, d.country),
    image: directusImage(d.image),
    href: d.procedure?.status === 'published' && publishedSlugs.has(d.procedure.slug) ? `/${d.procedure.slug}` : undefined,
  }));
}
```

- [ ] **Step 4: Run the test again and confirm it PASSES**

```bash
node --test src/lib/deviceContent.test.ts
```

Expected: all 3 tests pass, 0 failures.

- [ ] **Step 5: Thread `devices_catalog_lead` through `getHomeContent()`**

Open `src/lib/homeContent.ts`. Find (currently lines 78-80):

```ts
      catalog_title: h.devices_catalog_title || '',
      catalog_seo_title: h.devices_catalog_seo_title || '',
      catalog_seo_description: h.devices_catalog_seo_description || '',
```

Replace with:

```ts
      catalog_title: h.devices_catalog_title || '',
      catalog_lead: h.devices_catalog_lead || '',
      catalog_seo_title: h.devices_catalog_seo_title || '',
      catalog_seo_description: h.devices_catalog_seo_description || '',
```

- [ ] **Step 6: Type-check and run the full existing unit suite**

```bash
npm run check
npm test
```

Expected: no new diagnostics; all tests pass (existing `markup.test.ts`/`directus.test.ts` plus the new `deviceContent.test.ts`).

- [ ] **Step 7: Commit**

```bash
git add src/lib/deviceContent.ts src/lib/deviceContent.test.ts src/lib/homeContent.ts
git commit -m "feat: add deviceChip() and thread catalog lead through home content

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Seed manufacturer/country/short and the catalog intro copy into Directus

**Files:**
- Create: `scripts/migrate/devices-catalog-content.json`
- Create: `scripts/migrate/10-devices-catalog.mjs`

Follows the existing dry-run-by-default, backup-before-write convention (`scripts/migrate/07-devices.mjs`, `scripts/migrate/09-equipment-mobile.mjs`). Values are the ones the user confirmed during design (see spec's manufacturer/country table); `short` is only set where currently empty; `devices_catalog_title` is only rewritten if it doesn't already contain the `_..._` gold-italic markup (idempotent — won't clobber an editor's later edit).

- [ ] **Step 1: Create the content JSON**

Create `scripts/migrate/devices-catalog-content.json`:

```json
{
  "home": {
    "devices_catalog_title": "Аппараты _клиники_",
    "devices_catalog_lead": "Оборудование премиум-класса, которое используют врачи PERI CLINIC. Каждый аппарат подобран под конкретную задачу — от лифтинга до лазерной эпиляции."
  },
  "devices": [
    { "name": "Morpheus8", "manufacturer": "InMode Ltd.", "country": "Израиль" },
    { "name": "Volnewmer", "manufacturer": "CLASSYS", "country": "Южная Корея" },
    { "name": "InMode", "manufacturer": "InMode Ltd.", "country": "Израиль" },
    { "name": "ProFacial", "manufacturer": "SeoulinMedicare", "country": "Южная Корея", "short": "Комплексный аппаратный уход за кожей" },
    { "name": "Beautylizer", "manufacturer": "Beautyliner Group", "country": "Россия", "short": "RSL-скульптурирование тела" },
    { "name": "Pacer One Pro", "manufacturer": "MBT Lasers", "country": "Китай", "short": "Диодная лазерная эпиляция" },
    { "name": "HELEO4", "manufacturer": "HELEO4", "country": "Россия", "short": "Фотодинамическая терапия и фотобиомодуляция" }
  ]
}
```

- [ ] **Step 2: Write the migration script**

Create `scripts/migrate/10-devices-catalog.mjs`:

```js
/** Seed device manufacturer/country/short and the catalog intro copy; default dry-run, --apply backs up before writing. */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { collections } from '../../directus/setup/collections.mjs';
const { get, post, patch } = await import('../../directus/setup/lib.mjs');

const content = JSON.parse(await readFile(new URL('./devices-catalog-content.json', import.meta.url), 'utf8'));

const fields = await get('/fields/home');
const home = await get('/items/home');
const missingFields = Object.keys(content.home).filter((key) => !fields.some((f) => f.field === key));
const homeValues = {
  ...(home.devices_catalog_lead ? {} : { devices_catalog_lead: content.home.devices_catalog_lead }),
  ...(home.devices_catalog_title?.includes('_') ? {} : { devices_catalog_title: content.home.devices_catalog_title }),
};

const devices = await get('/items/devices?limit=-1');
const deviceUpdates = content.devices
  .map(({ name, ...fields }) => {
    const existing = devices.find((d) => d.name === name);
    if (!existing) throw new Error(`Missing device ${name}`);
    const values = Object.fromEntries(Object.entries(fields).filter(([key]) => !existing[key]));
    return { id: existing.id, name, values };
  })
  .filter(({ values }) => Object.keys(values).length);

console.log(JSON.stringify({ missingFields, homeValues, deviceUpdates: deviceUpdates.map(({ name, values }) => ({ name, values })) }, null, 2));
console.log('apply:', process.argv.includes('--apply'));
if (!process.argv.includes('--apply')) process.exit(0);

const dir = new URL('./out/devices-catalog-backups/', import.meta.url);
await mkdir(dir, { recursive: true });
await writeFile(new URL(`${Date.now()}.json`, dir), JSON.stringify({ home, devices }, null, 2));

const homeDefinition = collections.find((c) => c.collection === 'home');
for (const key of missingFields) await post('/fields/home', homeDefinition.fields.find((f) => f.field === key));
if (Object.keys(homeValues).length) await patch('/items/home', homeValues);
for (const { id, values } of deviceUpdates) await patch(`/items/devices/${id}`, values);
console.log(`Patched home + ${deviceUpdates.length} device(s).`);
```

- [ ] **Step 3: Dry run and review**

```bash
node --env-file=.env scripts/migrate/10-devices-catalog.mjs
```

Expected: JSON printing `missingFields: []` (Task 1 already created the field), `homeValues` with both keys (fresh singleton, neither set yet — unless Task 1's verification step or a previous run already patched them, in which case whichever key is already set should NOT reappear here), and `deviceUpdates` listing all 7 devices from the JSON with their `manufacturer`/`country` (and `short` for the 4 that lack one). Confirm the printed plan matches the JSON file exactly — this is a real write to the shared dev Directus, reviewed before applying.

- [ ] **Step 4: Apply**

```bash
node --env-file=.env scripts/migrate/10-devices-catalog.mjs --apply
```

Expected: `Patched home + 7 device(s).`, and a new timestamped backup file under `scripts/migrate/out/devices-catalog-backups/`.

- [ ] **Step 5: Verify against Directus directly**

```bash
node --input-type=module -e "
const { get } = await import('./directus/setup/lib.mjs');
const home = await get('/items/home?fields=devices_catalog_title,devices_catalog_lead');
const devices = await get('/items/devices?fields=name,manufacturer,country,short&filter=' + encodeURIComponent(JSON.stringify({status:{_eq:'published'}})));
console.log(JSON.stringify({ home, devices }, null, 2));
"
```

Expected: `devices_catalog_title` is `"Аппараты _клиники_"`, `devices_catalog_lead` is the intro paragraph, and all 8 published devices show non-empty `manufacturer`/`country` except `Ultraformer` (out of scope per spec — no base photo/procedure data to make its card presentable) and non-empty `short` for every device including the 4 that were previously blank.

- [ ] **Step 6: Rerun the dry run once more to confirm idempotency**

```bash
node --env-file=.env scripts/migrate/10-devices-catalog.mjs
```

Expected: `missingFields: []`, `homeValues: {}`, `deviceUpdates: []` — nothing left to patch, safe to run again later without clobbering edits.

- [ ] **Step 7: Commit**

```bash
git add scripts/migrate/10-devices-catalog.mjs scripts/migrate/devices-catalog-content.json
git commit -m "content: seed device manufacturer/country and catalog intro copy

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Rewrite `/apparaty` with the new card

**Files:**
- Modify: `src/pages/apparaty.astro` (full file, currently 58 lines)

- [ ] **Step 1: Replace the full file**

```astro
---
import { Image } from 'astro:assets';
import Page from '../layouts/Page.astro';
import { getAllDevices } from '../lib/deviceContent';
import { getHomeContent } from '../lib/homeContent';
import { em } from '../lib/markup';

const [items, home] = await Promise.all([getAllDevices(), getHomeContent()]);
const copy = home.devices;
---
<Page title={copy.catalog_seo_title || copy.catalog_title} description={copy.catalog_seo_description}>
  <section class="catalog" aria-labelledby="catalog-title">
    <p class="eyebrow">{copy.eyebrow}</p>
    <h1 id="catalog-title" set:html={em(copy.catalog_title)} />
    {copy.catalog_lead && <p class="catalog__lead">{copy.catalog_lead}</p>}
    <div class="catalog__grid">
      {items.map((item, i) => {
        const Tag = item.href ? 'a' : 'article';
        return (
          <Tag class="device-card" href={item.href}>
            <div class="device-card__image">
              <span class="device-card__index">{String(i + 1).padStart(2, '0')}</span>
              {item.image ? (
                <Image src={item.image.src} alt="" width={item.image.width} height={item.image.height} widths={[240, 480, 720]} sizes="(max-width: 800px) 44vw, 30vw" loading="lazy" />
              ) : (
                <span class="device-card__placeholder" aria-hidden="true">{item.name}</span>
              )}
            </div>
            <div class="device-card__body">
              {item.chip && <p class="device-card__chip glass-chip">{item.chip}</p>}
              <h2>{item.name}</h2>
              {item.short && <p class="device-card__desc">{item.short}</p>}
              {item.href && <span class="device-card__arrow" aria-hidden="true">→</span>}
            </div>
          </Tag>
        );
      })}
    </div>
    {copy.consultation_title && copy.consultation_label && <div class="catalog__consultation">
      <h2>{copy.consultation_title}</h2>
      <button class="button" type="button" data-open-sheet>{copy.consultation_label} <span aria-hidden="true">→</span></button>
    </div>}
  </section>
</Page>
<style>
  .catalog { max-width: var(--container); margin: auto; padding: 64px var(--gutter); }
  h1 { font: 400 clamp(36px, 5vw, 64px)/1.1 var(--display); margin: 0 0 20px; }
  .catalog__lead { color: var(--muted); font-size: 15px; line-height: 1.7; max-width: 62ch; margin: 0 0 40px; }
  .catalog__grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }

  .device-card {
    background: var(--gold-05);
    border: 1px solid var(--line-gold);
    border-radius: var(--radius-lg);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    transition: transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast);
  }
  .device-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-gold); }

  .device-card__image { position: relative; height: 300px; overflow: hidden; display: flex; align-items: center; justify-content: center; padding: 20px; background: var(--paper); border-bottom: 1px solid var(--line-gold); }
  .device-card__image :global(img) { max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain; mix-blend-mode: multiply; }
  .device-card__placeholder { font: 400 26px var(--display); color: var(--ink-2); }
  .device-card__index { position: absolute; top: 16px; left: 18px; font-size: 11px; color: var(--gold-deep); }

  .device-card__body { padding: 24px; display: flex; flex-direction: column; flex: 1; }
  .device-card__chip { margin: 0 0 10px; color: var(--gold-deep); font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; }
  .device-card h2 { font: 400 24px var(--display); margin: 0 0 10px; }
  .device-card__desc { color: var(--muted); font-size: 13px; line-height: 1.5; margin: 0 0 14px; }
  .device-card__arrow {
    align-self: flex-end;
    margin-top: auto;
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--gold-deep);
    color: #fff;
    font-size: 22px;
  }

  .catalog__consultation { padding: 32px; margin-top: 32px; border-radius: var(--radius-lg); background: var(--sand); text-align: center; }
  .catalog__consultation h2 { font: 400 30px/1.1 var(--display); margin: 0 0 16px; }

  @media (max-width: 800px) {
    .catalog { padding: 36px 18px; }
    h1 { font-size: clamp(30px, 8.4vw, 40px); }
    .catalog__lead { font-size: 14px; margin-bottom: 24px; }
    .catalog__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .device-card__image { height: clamp(145px, 42vw, 220px); padding: 10px; }
    .device-card__index { top: 10px; left: 12px; }
    .device-card__body { padding: 14px; }
    .device-card h2 { font-size: clamp(19px, 5.4vw, 22px); }
    .device-card__desc { font-size: 13px; -webkit-line-clamp: 2; display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden; }
    .device-card__arrow { width: 34px; height: 34px; font-size: 19px; }
    .catalog__consultation { padding: 20px; }
    .catalog__consultation h2 { font-size: 24px; }
  }
</style>
```

Note: no `h1 em` color rule is needed — `base.css` already has a global `h1 em, h2 em { color: var(--gold); font-style: italic; }` rule that covers the `set:html`-injected `<em>` from `em()`.

- [ ] **Step 2: Type-check**

```bash
npm run check
```

Expected: no new diagnostics.

- [ ] **Step 3: Visual smoke-check in the browser**

```bash
curl -s http://127.0.0.1:4599/apparaty | grep -o 'device-card__chip glass-chip[^<]*<[^>]*>[^<]*' | head -3
```

Expected: at least one line showing a chip's inner text (e.g. `...>INMODE LTD., ИЗРАИЛЬ<`) — confirms real Directus data (from Task 3) is flowing through, not empty strings.

- [ ] **Step 4: Commit**

```bash
git add src/pages/apparaty.astro
git commit -m "feat: redesign /apparaty catalog cards to match CaseCard styling

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Final QA — screenshots, accessibility, full suite

**Files:**
- Modify: `docs/qa/apparaty-redesign/apparaty-{375,800,1440}.png` (regenerated from the real page, replacing the mockup screenshots committed during design)

- [ ] **Step 1: Regenerate the QA screenshots from the real page**

```bash
node scripts/qa/screenshots.mjs http://127.0.0.1:4599 docs/qa/apparaty-redesign /apparaty
```

Expected: `saved docs/qa/apparaty-redesign/apparaty-375.png`, `-800.png`, `-1440.png`.

- [ ] **Step 2: Compare against the approved mockup**

Use the Read tool on `docs/qa/apparaty-redesign/apparaty-1440.png` and `docs/qa/apparaty-redesign/apparaty-375.png`. Confirm against the spec's approved reference (same files, pre-regeneration, are visible via `git show HEAD:docs/qa/apparaty-redesign/apparaty-1440.png` if you need a side-by-side):
- All 8 cards show a gold chip with real manufacturer/country text (not empty).
- No product photo overlaps the chip/title/description below it (the flex/`max-height` fix from Task 4 — check the tall narrow devices specifically: Morpheus8, Volnewmer, Beautylizer).
- Desktop grid is 4 columns at 1440px width; mobile is 2 columns.
- Golden `клиники` in the `<h1>`.

- [ ] **Step 3: Accessibility check**

```bash
node scripts/qa/a11y.mjs http://127.0.0.1:4599 /apparaty
```

Expected: exits 0, 0 serious/critical violations.

- [ ] **Step 4: Full existing suite**

```bash
npm test
npm run check
```

Expected: all green.

- [ ] **Step 5: Commit the refreshed screenshots**

```bash
git add docs/qa/apparaty-redesign/
git status --porcelain docs/qa/apparaty-redesign/
git commit -m "docs: refresh apparaty QA screenshots from the built page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Stop the isolated dev server**

```bash
kill "$(cat /tmp/apparaty-qa-dev.pid)"
```
