# Independent homepage reels library QA

2026-09-20: 27 unit tests pass; Astro check reports zero errors/warnings. Selection test covers publication, explicit sort, missing files/captions, reused files and empty collection.

Development migration seeded two uploaded clips into `home_reels`, retaining file IDs, captions, secondary doctor names and covers. Re-running the migration preserved records exactly. A generated temporary MP4 was uploaded through Directus, attached to a draft, replaced by an existing specialist file, and saved with caption/secondary caption/order changes. Builder published query excluded the draft. Test draft and newly uploaded test file were removed afterwards; existing media was not deleted or changed.

Authenticated admin browser check: «Жизнь клиники» appears in the content sidebar. Create form has status, numeric order, caption, secondary caption, video and optional cover. Clicking the video field exposes «Загрузить файл с устройства» and «Выбрать файл из библиотеки». Default list preset sorts by the collection's manual sort field. Editor CRUD and Builder read policies and publication flow membership are provisioned additively.

Development build completed successfully, homepage has two curated cards; Chromium and WebKit both play HLS and preserve positions through repeated switches. Results: `dev-hls.json`. Physical iPhone behaviour was not retested because playback code is unchanged.

Production: feature commit `ecf892b` applied; additive migration seeded two existing uploaded clips and Builder read returned the approved captions in order. Backup: `/srv/peri/backups/reels-library-20260920/specialists-before.json`. Build and SEO gate passed; release `/srv/peri/releases/2026-09-20T16-13-37`, completed 2026-09-20 13:14:41 UTC. Admin route https://admin-cms.peri-clinic.ru/admin/content/home_reels returns HTTP 200. Production UI tests at 320/375/800/1440px passed, including touch, keyboard, playback controls, visibility, reduced motion and axe. WebKit passed autoplay, next-video buffering, offline return and preserved positions; existing unrelated ResizeObserver warning is recorded. See production JSON results.
