# Homepage Hero Full-Bleed Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the homepage hero's two-column layout with a single full-bleed photo hero (new copy, new consultation photo) that works identically across all breakpoints.

**Architecture:** `src/components/home/Hero.astro` is rewritten to stack a blurred backdrop + sharp foreground photo behind a scrim, with text overlaid top (eyebrow/heading) and bottom (lead/stats/CTA). A new global `.button--light` variant is added to `src/styles/base.css`. The new photo and copy are pushed into the live Directus `home` singleton via a one-off script that reuses `directus/setup/lib.mjs`, then deleted — this is a content edit, not a repeatable migration.

**Tech Stack:** Astro 5 (`astro:assets` `Picture`), vanilla scoped CSS using existing design tokens, Directus REST API (Node `fetch`, no SDK).

**Reference spec:** `docs/superpowers/specs/2026-09-12-hero-full-bleed-redesign-design.md`

---

## Task 1: Add the `.button--light` global button variant

**Files:**
- Modify: `src/styles/base.css:191-198`

- [ ] **Step 1: Add the variant CSS**

Insert immediately after the existing `.button--outline:hover` block (before `.text-link {`):

```css
.button--light {
  background: var(--ivory);
  border-color: var(--ivory);
  color: var(--ink);
}
.button--light:hover {
  background: var(--paper);
  border-color: var(--paper);
}
```

So the surrounding block reads:

```css
.button--outline {
  background: transparent;
  color: var(--gold-deep);
}
.button--outline:hover {
  background: var(--gold-deep);
  color: #fff;
}
.button--light {
  background: var(--ivory);
  border-color: var(--ivory);
  color: var(--ink);
}
.button--light:hover {
  background: var(--paper);
  border-color: var(--paper);
}
.text-link {
  display: inline-flex;
  ...
```

- [ ] **Step 2: Sanity-check with astro check**

Run: `cd /root/peri-clinnic.ru && source ~/.nvm/nvm.sh && nvm use && npm run check`
Expected: no new errors (CSS isn't type-checked, this just confirms the repo still builds its TS/Astro graph).

- [ ] **Step 3: Commit**

```bash
git add src/styles/base.css
git commit -m "$(cat <<'EOF'
feat: add button--light variant for text-over-photo CTAs

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Rewrite the Hero component

**Files:**
- Modify: `src/components/home/Hero.astro` (full replace)

- [ ] **Step 1: Replace the entire file contents**

```astro
---
import { Picture } from 'astro:assets';
import { em } from '../../lib/markup';
import { getSiteSettings } from '../../lib/siteContent';
import { getHomeContent } from '../../lib/homeContent';

const site = await getSiteSettings();
const home = await getHomeContent();
const { hero } = home;
---

<section class="hero" aria-labelledby="hero-title">
  <div class="hero__media" aria-hidden="true">
    <div class="hero__backdrop">
      <Picture
        src={hero.image.src}
        inferSize
        alt=""
        widths={[400]}
        sizes="100vw"
        formats={['webp']}
        fallbackFormat="jpg"
        loading="eager"
        decoding="async"
      />
    </div>
    <div class="hero__photo">
      <Picture
        src={hero.image.src}
        inferSize
        alt={hero.image_alt}
        widths={[480, 840, 1200, 1800]}
        sizes="100vw"
        formats={['avif', 'webp']}
        fallbackFormat="jpg"
        loading="eager"
        fetchpriority="high"
        decoding="async"
      />
    </div>
  </div>
  <div class="hero__scrim" aria-hidden="true"></div>

  <div class="hero__address glass-panel glass-panel--dark">
    <span class="glass-chip glass-chip--dark">{site.city}</span>
    <p set:html={em(site.address_lines)} />
  </div>

  <div class="hero__content reveal">
    <div class="hero__top">
      <p class="eyebrow">{hero.eyebrow}</p>
      <h1 id="hero-title" set:html={em(hero.title)} />
    </div>
    <div class="hero__bottom">
      <p class="hero__lead">{hero.lead}</p>
      <div class="hero__facts" aria-label="Преимущества клиники">
        {
          hero.facts.map((f) => (
            <div>
              <strong>{f.value}</strong>
              <span set:html={em(f.label)} />
            </div>
          ))
        }
      </div>
      <div class="hero__actions">
        <button class="button button--light" type="button" data-open-sheet>{hero.primary_label} <span>↗</span></button>
        <a class="text-link text-link--light" href={hero.secondary_href}>{hero.secondary_label} <span>↓</span></a>
      </div>
    </div>
  </div>
</section>

<style>
  .hero {
    position: relative;
    z-index: 0;
    min-height: calc(100vh - var(--header-h));
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .hero__media {
    position: absolute;
    inset: 0;
    z-index: 0;
    overflow: hidden;
    background: var(--dark);
  }
  .hero__backdrop {
    position: absolute;
    inset: -20px;
  }
  .hero__backdrop :global(picture),
  .hero__backdrop :global(img) {
    width: 100%;
    height: 100%;
  }
  .hero__backdrop :global(img) {
    object-fit: cover;
    filter: blur(60px) brightness(0.75);
    transform: scale(1.15);
  }
  .hero__photo {
    position: absolute;
    inset: 0;
  }
  .hero__photo :global(picture),
  .hero__photo :global(img) {
    width: 100%;
    height: 100%;
  }
  .hero__photo :global(img) {
    object-fit: cover;
    object-position: center 30%;
  }
  .hero__scrim {
    position: absolute;
    inset: 0;
    z-index: 1;
    background: linear-gradient(
      180deg,
      rgba(20, 18, 12, 0.4) 0%,
      rgba(20, 18, 12, 0.05) 28%,
      rgba(20, 18, 12, 0.15) 55%,
      rgba(20, 18, 12, 0.82) 100%
    );
  }
  .hero__address {
    position: absolute;
    z-index: 2;
    top: 24px;
    right: 24px;
    display: flex;
    gap: 16px;
    align-items: center;
    padding: 14px 20px;
    color: #fff;
  }
  .hero__address span {
    font-size: 11px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }
  .hero__address p {
    font: 17px/1.2 var(--display);
    margin: 0;
  }
  .hero__content {
    position: relative;
    z-index: 2;
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    max-width: var(--container-wide);
    width: 100%;
    margin: auto;
    padding: 96px 4.1vw 46px;
  }
  .hero__top {
    max-width: 640px;
  }
  .hero .eyebrow {
    color: var(--gold-light);
  }
  .hero h1 {
    margin: 0;
    font-size: var(--t-h1);
    line-height: 0.9;
    color: var(--dark-text);
  }
  .hero__bottom {
    max-width: 560px;
  }
  .hero__lead {
    margin: 0 0 28px;
    color: rgba(245, 242, 233, 0.85);
    font-size: 16px;
    line-height: 1.6;
  }
  .hero__facts {
    display: flex;
    margin-bottom: 32px;
  }
  .hero__facts div {
    display: flex;
    align-items: center;
    gap: 13px;
    min-width: 155px;
    margin-right: 28px;
    padding-right: 28px;
    border-right: 1px solid var(--line-on-dark);
  }
  .hero__facts div:last-child {
    border: 0;
    margin: 0;
    padding: 0;
  }
  .hero__facts strong {
    font: 400 27px var(--display);
    color: var(--gold-light);
    white-space: nowrap;
  }
  .hero__facts span {
    color: rgba(245, 242, 233, 0.75);
    font-size: 11px;
    line-height: 1.4;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .hero__actions {
    display: flex;
    align-items: center;
    gap: 30px;
    flex-wrap: wrap;
  }
  .text-link--light {
    border-bottom-color: var(--dark-text);
    color: var(--dark-text);
  }

  @media (min-width: 900px) {
    .hero__photo :global(img) {
      object-fit: contain;
      object-position: center;
    }
  }

  @media (max-width: 1100px) {
    .hero__address {
      top: 18px;
      right: 18px;
    }
  }

  @media (max-width: 800px) {
    .hero__content {
      padding: 45px 18px 32px;
    }
    .hero__top,
    .hero__bottom {
      max-width: none;
    }
    .hero h1 {
      font-size: 16.5vw;
      line-height: 0.88;
    }
    .hero__lead {
      font-size: 14px;
      margin-bottom: 22px;
    }
    .hero__facts {
      justify-content: space-between;
      margin-bottom: 24px;
    }
    .hero__facts div {
      display: block;
      min-width: auto;
      margin: 0;
      padding: 0 9px 0 0;
      border: 0;
    }
    .hero__facts strong,
    .hero__facts span {
      display: block;
    }
    .hero__facts strong {
      font-size: 21px;
      margin-bottom: 5px;
    }
    .hero__actions {
      gap: 16px;
      flex-direction: column;
      align-items: stretch;
    }
    .hero__actions .button {
      width: 100%;
    }
    .hero__actions .text-link {
      align-self: flex-start;
    }
    .hero__address {
      top: 14px;
      right: 14px;
      padding: 10px 14px;
    }
    .hero__address p {
      font-size: 14px;
    }
  }
</style>
```

- [ ] **Step 2: Run astro check**

Run: `cd /root/peri-clinnic.ru && source ~/.nvm/nvm.sh && nvm use && npm run check`
Expected: 0 errors. (`hero.note` is no longer referenced — this is expected and fine, the field simply isn't read anymore; `getHomeContent()`'s return type still has it, unused fields aren't a TS error.)

- [ ] **Step 3: Commit**

```bash
git add src/components/home/Hero.astro
git commit -m "$(cat <<'EOF'
feat: full-bleed hero redesign for all breakpoints

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Push the new photo and copy into Directus

This is a one-off content edit against the live CMS (`peri-cms.zumrudin.ru`, reachable on this box at `127.0.0.1:8055`), not a repeatable migration — no file under `scripts/migrate/` is created. The temporary script below is written to the repo root, run once, then deleted before it can ever be committed.

**Files:**
- Create (temporary, deleted in Step 4): `update-hero-content.mjs`

- [ ] **Step 1: Write the temporary script**

```javascript
import { writeFile, unlink } from 'node:fs/promises';
import { patch, log, login, BASE } from './directus/setup/lib.mjs';

const PHOTO_URL = 'https://dev.zumrudin.ru/peri-concepts/mobile-2026-09-12/peri-consultation-jewelry-v2.png';
const TMP_PATH = '/tmp/peri-hero-photo.png';

async function main() {
  log('downloading photo...');
  const res = await fetch(PHOTO_URL);
  if (!res.ok) throw new Error(`download failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(TMP_PATH, buf);

  log('uploading to Directus...');
  const token = await login();
  const form = new FormData();
  form.set('title', 'home-hero-consultation');
  form.set('file', new Blob([buf], { type: 'image/png' }), 'peri-consultation-jewelry-v2.png');
  const uploadRes = await fetch(`${BASE}/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!uploadRes.ok) throw new Error(`upload failed: ${uploadRes.status}: ${await uploadRes.text()}`);
  const { data: file } = await uploadRes.json();
  log('uploaded file id:', file.id);

  log('patching home singleton...');
  await patch('/items/home', {
    hero_eyebrow: 'PERI CLINIC · ЭСТЕТИЧЕСКАЯ МЕДИЦИНА',
    hero_title: 'Начнём с заботы о вас.',
    hero_lead: 'Обсудим ваши пожелания на консультации.',
    hero_primary_label: 'Записаться на консультацию',
    hero_image: file.id,
    hero_image_alt: 'Врач-косметолог PERI CLINIC на консультации с пациенткой',
  });
  log('done.');

  await unlink(TMP_PATH);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Run it against the live Directus instance**

Credentials are read from the deployed Directus `.env` on this box rather than typed into any command or file, so nothing sensitive ends up in shell history beyond a variable name:

```bash
cd /root/peri-clinnic.ru
export DIRECTUS_URL=http://127.0.0.1:8055
export DIRECTUS_ADMIN_EMAIL=$(grep '^ADMIN_EMAIL=' /srv/peri/directus/.env | cut -d= -f2)
export DIRECTUS_ADMIN_PASSWORD=$(grep '^ADMIN_PASSWORD=' /srv/peri/directus/.env | cut -d= -f2)
node update-hero-content.mjs
```

Expected output:
```
[directus-setup] downloading photo...
[directus-setup] uploading to Directus...
[directus-setup] uploaded file id: <uuid>
[directus-setup] patching home singleton...
[directus-setup] done.
```

- [ ] **Step 3: Verify the write against the live API**

```bash
TOKEN=$(curl -s -X POST http://127.0.0.1:8055/auth/login \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$DIRECTUS_ADMIN_EMAIL\",\"password\":\"$DIRECTUS_ADMIN_PASSWORD\"}" | node -e "process.stdin.once('data', d => console.log(JSON.parse(d).data.access_token))")
curl -s http://127.0.0.1:8055/items/home?fields=hero_eyebrow,hero_title,hero_lead,hero_primary_label,hero_image,hero_image_alt \
  -H "Authorization: Bearer $TOKEN"
```

Expected: JSON showing the six fields above with the new values, and `hero_image` set to the uploaded file's UUID.

- [ ] **Step 4: Delete the temporary script**

```bash
rm update-hero-content.mjs
unset DIRECTUS_ADMIN_EMAIL DIRECTUS_ADMIN_PASSWORD DIRECTUS_URL
git status
```

Expected: `update-hero-content.mjs` is gone and `git status` shows no trace of it (it was never staged, so nothing to unstage).

No commit for this task — it changes live CMS data, not repo files.

---

## Task 4: Local build access to Directus

The repo checkout has no local `.env`, so `npm run dev`/`npm run build` can't reach Directus yet. Directus is reachable from this same box at `127.0.0.1:8055`, and a read-only `builder` token already exists in `/srv/peri/site.env` — reuse it rather than minting a new one.

**Files:**
- Create (gitignored, not committed): `.env`

- [ ] **Step 1: Create the local env file**

```bash
cd /root/peri-clinnic.ru
BUILDER_TOKEN=$(grep '^DIRECTUS_TOKEN=' /srv/peri/site.env | cut -d= -f2)
cat > .env <<EOF
DIRECTUS_URL=http://127.0.0.1:8055
DIRECTUS_TOKEN=${BUILDER_TOKEN}
EOF
unset BUILDER_TOKEN
```

- [ ] **Step 2: Confirm it's ignored by git**

```bash
git check-ignore -v .env
```

Expected: prints `.gitignore:4:.env	.env` (confirms it won't be committed).

---

## Task 5: Verify in a real browser

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

```bash
cd /root/peri-clinnic.ru
source ~/.nvm/nvm.sh && nvm use
npm run dev
```

Expected: server starts at `http://127.0.0.1:4321` with no errors in the console (watch for Directus fetch errors — if the `home` singleton fetch fails, check `.env` from Task 4).

- [ ] **Step 2: Visually inspect the hero at three widths**

Open `http://127.0.0.1:4321/` in a browser and resize to ~375px, ~800px, and ~1440px (or use devtools device toolbar). Confirm at each width:
- The consultation photo fills the section edge-to-edge with no visible cropping of the two women or the wall logo at ≥900px (blurred pillarbox should appear on very wide/short viewports instead).
- Eyebrow + heading are legible near the top; lead, stats, and the CTA row are legible near the bottom, against the scrim.
- The primary button is ivory with dark text and opens the contact sheet dialog when clicked.
- The secondary link "Смотреть результаты ↓" scrolls to `#results`.
- The address glass chip sits in the top-right corner without overlapping the heading or the bottom content block.

- [ ] **Step 3: Stop the dev server, build, and preview**

```bash
npm run build
npm run preview
```

Open `http://127.0.0.1:4322/` and repeat the same visual check against the production build.

---

## Task 6: QA screenshots and accessibility check

**Files:**
- Create: `docs/qa/hero-redesign/` (screenshot PNGs at 375/800/1440, per project convention)

- [ ] **Step 1: Capture screenshots against the preview build**

With `npm run preview` still running from Task 5 (or restarted):

```bash
cd /root/peri-clinnic.ru
source ~/.nvm/nvm.sh && nvm use
node scripts/qa/screenshots.mjs http://127.0.0.1:4322 docs/qa/hero-redesign /
```

Expected: PNG files land under `docs/qa/hero-redesign/` for each configured width.

- [ ] **Step 2: Run the accessibility check**

```bash
node scripts/qa/a11y.mjs http://127.0.0.1:4322 /
```

Expected: exit code 0, no serious/critical violations. If the light-on-dark text (`.hero__lead`, `.hero__facts span`, `.text-link--light`) fails contrast, darken the scrim gradient in `src/components/home/Hero.astro` (increase the `0.4`/`0.82` alpha values) and re-run this step until it passes — don't lower the text/background contrast requirement.

- [ ] **Step 3: Review the screenshots**

Open the PNGs under `docs/qa/hero-redesign/` and confirm they match what was checked manually in Task 5, Step 2.

- [ ] **Step 4: Commit the QA screenshots**

```bash
git add docs/qa/hero-redesign/
git commit -m "$(cat <<'EOF'
docs: add QA screenshots for full-bleed hero redesign

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-review notes

- **Spec coverage:** content structure (§1) → Task 2; photo/blur-pillarbox layering (§2) → Task 2; colour treatment (§3) → Task 1 + Task 2; address placement (§4) → Task 2; Directus content changes (§5) → Task 3; testing/QA (§6) → Tasks 4–6. No spec section is without a task.
- **No placeholders:** every step has literal file contents or literal commands with expected output; the a11y step gives a concrete remediation (adjust named CSS values) rather than "handle any failures."
- **Type/name consistency:** `hero.primary_label`/`hero.secondary_label`/`hero.secondary_href`/`hero.facts`/`hero.image`/`hero.image_alt` all match the existing `getHomeContent()` shape in `src/lib/homeContent.ts:29-38` — unchanged by this plan. `.button--light` and `.text-link--light` are the only new class names, used consistently between Task 1 (definition) and Task 2 (usage).
