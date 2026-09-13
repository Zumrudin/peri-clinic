# Direct photo/video upload QA — 2026-09-13

Final feature replaces the earlier Telegram experiment. Changes remain on `feat/specialist-telegram-uploads`; no production CMS mutation, merge or deployment was performed.

Verified:

- 11 source tests passed: public URL filtering, Telegram rejection, video metadata/size validation, replacement cache invalidation, authenticated download, cache reuse and truncated-download rejection.
- Type check: 0 errors. Full static build: 44 pages plus the binary video endpoint.
- Separate Directus on port 8057 with its own SQLite DB/storage: migration applied twice; native photo and MP4 uploads succeeded; nested video ID/MIME/size/timestamps expanded; Editor/Builder permissions verified; inactive publication flow remained inactive and gained collection coverage.
- The build read production content through a GET-only fixture proxy and injected only isolated CMS test media into the test specialist. Actual production CMS schema/content were not changed.
- Separate nginx on 127.0.0.1:8097 served the build with standard static-file handling: video Range requests returned HTTP 206 and exactly 1024 requested bytes, Content-Type video/mp4.
- Chrome at 375/800/1440: no video request before opening, playback after clicking the card, seek to 2 seconds, correct dialog close/stop/source cleanup, photo lightbox, and failed-video fallback passed. No JavaScript errors and no Telegram requests. `results.json` records first-frame times (0.42–1.49s for this small local test clip, not a real-user speed guarantee).
- Accessibility: 0 violations. HTML/JS/CSS scan: 0 CMS token leaks and no Telegram widget script.

Test clip: https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4 (MDN's CC0 example, downloaded only into the isolated test CMS). Screenshots show this test video, not clinic content. Test photo: repository cabinet.webp. No media fixtures are inserted into the released site's source or CMS.

MP4 must use browser-compatible H.264/AAC; WebM is accepted. Existing limit: 50 MB. Automatic compression, MOV/HEVC conversion and importing recordings from Telegram are not implemented. Videos need to be uploaded after the authorized CMS release.
