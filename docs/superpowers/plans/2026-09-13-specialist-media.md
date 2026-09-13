# Implementation and release notes

Completed on the isolated branch:

- Native photo/video file upload fields and additive CMS migration.
- Local static video export, versioned caching, bounded/authenticated downloads and build failure on incomplete media.
- Optional cover with specialist portrait fallback; native player, playback on open, and cleanup on close.
- Removal of the Telegram widget and rejection of legacy Telegram video links.
- Isolated CMS integration tests, source tests, type checks, build and browser verification (see docs/qa/specialist-video/README.md).

## Future release — requires the user's explicit instruction

1. Back up CMS schema/data and the serving release.
2. Apply `node directus/setup/specialist-media-schema.mjs` with the target admin environment. This is necessary before building the branch against that CMS.
3. Build and publish the reviewed branch through the normal release process only after authorization. VIDEO_CACHE_DIR optionally moves the video download cache outside the checkout; otherwise `.cache/specialist-videos` persists between npm installs. nginx already serves static MP4/WebM with byte ranges.
4. Specialists → specialist → Фото и видео → create: title, photo or video upload, optional cover/description. Save the material and the specialist; normal publication rebuilds the site.
5. Upload the actual desired video. Old Telegram links do not import a file automatically.

The existing limit is 50 MB per upload. MP4 must contain browser-compatible codecs (H.264/AAC); WebM is also accepted. MOV/HEVC conversion and automatic video compression are outside this change.

## Checks

Node 22.23.2: `npm test`, `npm run check -- --minimumSeverity error`, `npm run build`.

`scripts/qa/specialist-media-cms.mjs <isolated-env-file> <test-mp4>` targets only a disposable Directus on 127.0.0.1:8057. The env file supplies ADMIN_EMAIL/ADMIN_PASSWORD. It applies the migration twice, uploads a photo and MP4, and verifies expanded file metadata, policy permissions, and preservation of an inactive flow.

`scripts/qa/specialist-video.mjs <isolated-nginx-origin>` checks a fixture build on mobile and desktop: same-origin video, no Telegram requests, no video download before opening, playback, seeking, byte ranges, close cleanup, photo lightbox and failure fallback.
