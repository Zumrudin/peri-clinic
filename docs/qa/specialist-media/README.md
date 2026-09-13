# Specialist media QA — 2026-09-13

Branch: `feat/specialist-telegram-uploads`, created from `main` at `9fd0ea3`. No merge or deployment was performed by this task; production CMS schema/content were not changed.

## Result

The exact saved message https://t.me/peri_clinic/2055 cannot play in the official Telegram post widget: Telegram responds “Media is too big / VIEW IN TELEGRAM” and omits the video element. See `original-video-unavailable-375.png`. Integration alone cannot satisfy playback of that recording. It needs a smaller Telegram upload or a different hosting source.

https://t.me/peri_clinic/2048 was used as a playable control from the same clinic channel. In separate Chrome browser contexts at 375, 800, 1024 and 1440 px, the widget appeared in 0.77–1.48 seconds; playback reached its first frame in another 1.63–1.97 seconds. Each run confirmed playback continued past 3 seconds. These are server-browser observations, not a latency or uninterrupted-playback guarantee for mobile networks. The control post was substituted only in Playwright's document response, never written into CMS.

## Verification

- `npm test`: 9 passed, including legacy Telegram links with no covers, malformed/private links, and credential-bearing media URL rejection.
- `npm run check -- --minimumSeverity error`: 0 errors.
- Full isolated static build: 44 pages. The build read production content through a GET-only localhost proxy; the new media relation was supplied from an independently uploaded local CMS fixture. No migration was applied to production.
- Disposable Directus instance on 127.0.0.1:8057, separate SQLite DB and upload directory: migration applied twice; WebP uploaded; photo and Telegram records saved; nested file ID/dimensions resolved; invalid URLs rejected. Editor/Builder media permissions verified. Existing inactive publication flow remained inactive and gained new collection coverage.
- Browser: uploaded photo/lightbox/Escape, actual Telegram video playback, card and page overflow, blocked Telegram script fallback, and original video size limitation verified. No page JavaScript errors. Mobile cards give Telegram its required width; the desktop grid adapts to the available space.
- Browser HTML/JS/CSS scan: 0 CMS token or `access_token=` leaks.
- Accessibility scan after the loading-text contrast fix: 0 violations, including 0 serious/critical. Final build: 44 pages, completed successfully.

Fixtures are not part of the site's content. The uploaded cabinet image is a repository demo asset used only to exercise the file pipeline. The normal build requires the new CMS migration before deployment.

The widget is the official https://core.telegram.org/widgets/post implementation. It renders Telegram's message/player; its contents and large-file restrictions are controlled by Telegram.
