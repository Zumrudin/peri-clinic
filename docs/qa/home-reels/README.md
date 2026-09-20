# Mobile home reels — 2026-09-20

Implemented the approved light design after the homepage staff gallery, using two existing videos from the CMS. No stock/reference people or invented clinic content was added. The additive text-field migration was applied to the development CMS; production has not been released.

Dev deployment (2026-09-20): approved title «Жизнь клиники». Applied the feature patch to `/srv/peri/site` without replacing its other local changes, then ran the rebuild receiver. Successful release: `/srv/peri/releases/2026-09-20T11-07-39`, completed 11:09:08 UTC. External GET https://peri.zumrudin.ru/ returned 200 with the new section and title. Pre-deploy source backup: `/srv/peri/backups/home-reels-1789902387`.

Validation:
- Astro check: 0 errors, 0 warnings (existing repository hints remain).
- Production build: 44 pages built successfully.
- Six relevant unit tests passed: feed filtering/deduplication, normalized media URLs, authenticated video caching and validation.
- Browser tests at 320/375/800 px: real CDP touch swipe, active-only playback, deferred sources, manual pause, mute, keyboard navigation, viewport exit, reduced-motion manual playback, and resize to desktop passed.
- Synthetic document visibility event stops/resumes playback. A physical iPhone/Safari check remains useful for OS autoplay/low-power behavior.
- At 1440 px the section is hidden and no video is downloaded.
- Failed video requests show a direct-link fallback.
- Axe: no serious/critical issues in the new section.

`scripts/qa/home-reels.mjs` reproduces browser checks against the built preview. `home-reels-preview.mjs` packages the section, compiled script, styles and required static media without CMS credentials. The 375 px image also documents the externally hosted interactive preview.

## Prefetch follow-up

Changed adjacent clips from `preload=none` to `auto` once the visible player can play. Source assignment and `load()` remain first-use only, so swiping merely pauses/resumes the same video element and retains its playback position. The development nginx config now serves versioned `/media/specialists/` files with `Cache-Control: public, max-age=31536000, immutable`; range GET was verified as 206 with the expected header. Offscreen/desktop initial loading restrictions remain.

`home-reels-cache.mjs` verifies adjacent buffering before the first swipe and performs six round-trip switches offline after buffering, asserting resumed timestamps and single-player playback.

Deployed prefetch change as `/srv/peri/releases/2026-09-20T11-15-23` (build completed 11:16:51 UTC). The browser limits native preloading to a playable segment rather than necessarily downloading the whole file. Six offline switches within that buffer passed without restarting timestamps; measured 120–197 ms from navigation to at least 0.1 s of resumed playback in headless Chromium. This is a controlled browser measurement, not an iPhone/network performance guarantee. See `cache-results.json`.

## iPhone report: revised mobile delivery

The original 720×1280 encodes were ~3 Mbit/s (18,482,375 and 22,220,734 bytes). `preload=auto` on multiple original files could compete with active playback, and native preload alone did not demonstrate iOS readiness. This supersedes the previous prefetch approach.

The homepage now uses separate 540px H.264/AAC fast-start derivatives (4,020,683 and 4,103,776 bytes). Originals and specialist-page videos are retained. The build requires ffmpeg; the new static endpoint caches versioned derivatives under `.cache/reel-videos` (override `REEL_CACHE_DIR`). Only the next owned derivative is explicitly fetched, after 1.5 seconds of playback and at least 8 buffered seconds; it becomes a blob URL once complete. Fetches are capped at 8 MiB, cancelled when active playback waits or the section is left, and blob URLs outside the nearby window are released. Viewed positions survive eviction. Near-viewport loading applies to the first video/posters; the top of the homepage requests no reels.

The repeatable cold-network test uses 1.6 Mbit/s and 100 ms latency with browser cache disabled. The baseline homepage transferred 373,231 resource bytes, FCP 556 ms, load ~2.63 s and zero video requests before scrolling; first-video start after scrolling was 3.53 s. A single simulated run is a diagnostic comparison, not a physical-iPhone guarantee.

Published mobile-delivery revision: `/srv/peri/releases/2026-09-20T11-39-07`, completed 11:40:54 UTC. External derivative range requests return 206, correct MP4 bytes and immutable caching. Cold 1.6 Mbit/s follow-up: initial resource transfer 306,949 bytes, FCP 568 ms, load 2.105 s, zero video requests before scrolling. First-video start measured 3.674 s versus baseline 3.530 s; this does **not** demonstrate faster initial playback, although payload and simultaneous startup downloads decreased. The primary validated improvements are reduced video weight, prioritized first stream, explicit next-video memory cache and preserved positions.

WebKit tests use installed Linux WebKit 26.6 with a mobile viewport, not Yandex/iOS on hardware. An initial WebKit test incorrectly waited for the offscreen cached video to decode before selection; WebKit may defer decoding. The test now verifies the cached blob, then actual playback after selection. A local run passed all playback/cache checks. An existing ResizeObserver warning also reproduces with the Reels script disabled; it is recorded separately in test output.

External WebKit validation of the published revision passed: first autoplay, next-file blob cache, return with saved positions, offline playback of the cached next video, and no reel requests above the fold. The existing unrelated ResizeObserver warning is recorded. Physical iPhone 15 / Yandex remains unverified.

## HLS streaming revision

Supersedes the preceding whole-MP4 scheme. Build output includes 360px/540px H.264/AAC HLS VOD, aligned 2-second fMP4 segments. The first low rendition fragments are 90,875 and 60,648 bytes for the two current clips. Packages are cached under `.cache/reel-hls` (override `REEL_HLS_CACHE_DIR`) and published atomically; ffmpeg/ffprobe are required on build hosts. Nginx serves `.m3u8` as `application/vnd.apple.mpegurl` and `.m4s` as `video/mp4`, with versioned immutable URLs. External GET checks matched cached originals by SHA-256.

The player uses pinned hls.js 1.7.3 (light entry, loaded near the mobile section). Startup fragments begin fetching while the library loads. A shared request/byte cache deduplicates speculative and player fetches, retains up to 12 MiB, and supplies copies to the HLS worker. Current plus next two starts are requested in parallel; neighbours stay paused with approximately 2–4 seconds buffered. Active buffering targets 8 seconds, capped at 12; previous player is retained and stopped, distant players are released with position saved. Adaptive quality is enabled for the active card; neighbours start at the lower rendition. Hidden/desktop/paused states stop streaming. Native HLS/MP4 remain compatibility fallbacks. External editor video URLs retain native delivery.

Validation includes all 26 existing unit tests plus a real ffmpeg HLS test for segment alignment, complete playlists, startup size and cache reuse. Astro check reports no errors/warnings (existing hints remain). Chromium UI tests pass at 320/375/800/1440px: actual touch swipe, single active player, controls, keyboard, saved positions, tab/page visibility, reduced motion, error UI and zero serious/critical axe violations. A synthetic six-card feed using the two real sources verifies player eviction (maximum four attached) and restored positions; this tests lifecycle bounds, not six distinct video downloads.

A first live iteration exposed duplicate speculative/player requests and serial library-then-media startup. It measured a ~6 s cold start at 1.6 Mbit/s, despite fast subsequent switching. This was rejected as a startup regression; the revised loader shares in-flight requests and starts segment requests before the light library finishes loading. Final live measurements are recorded separately below.

The shared-loader revision passed live HLS failure → MP4 playback, six offline round trips within retained buffers, six-card eviction/return, and continuous playback past 12 seconds with adaptation to 540×960 on a simulated DPR=3 screen. One offline-test setup timed out while a build was running; the same check passed after the build finished. Browser performance measurements run after builds, without concurrent encoding.

Cold-cache test at 1.6 Mbit/s / 100 ms on release `2026-09-20T12-30-26`: homepage resource transfer 307,116 bytes, load 1.999 s, zero reel/streaming-library requests above the fold. A direct jump from the top to the video required 4.495 s for first playback; this is still slower than the earlier MP4 cold-start measurement (3.674 s), so no first-start improvement is claimed. Already prepared card switches took 39–110 ms in Chromium. Linux WebKit (unthrottled) first start was 960 ms, switches 34–98 ms. The final near-section trigger was moved to 1200px so preparation begins while visitors are still viewing the staff block, and poster assignment was bounded to nearby cards. A separate approach test checks preparation before visibility.

These results are server-side browser tests, not physical iPhone/Yandex measurements. Native iOS manages decoding and memory itself; first playback on a cold connection can still wait for data. The supported outcome is early bounded preparation and fast switches when the adjacent clip is ready, with timestamps preserved. Sudden jumps to distant unprepared clips still require a network fetch.

Final published release: /srv/peri/releases/2026-09-20T12-34-01, completed 2026-09-20 12:35:45 UTC. Live approach test at 1.6 Mbit/s / 100 ms: preparation while the section was offscreen took 4544 ms; first playback after revealing the already prepared card took 217 ms. No offscreen autoplay. Final direct-jump measurements: chromium: first 4276 ms, prepared switches 27–108 ms; webkit: first 1140 ms, prepared switches 39–150 ms. Above-fold checks again found no media or streaming-library requests. Live WebKit autoplay, buffered neighbour, offline return and saved positions passed. The pre-existing ResizeObserver warning remains filtered separately. Final Astro check: 0 errors, 0 warnings.

## Production deployment — 2026-09-20

User authorized commit, push to main and production deployment. Feature commit `774b0ea` was pushed to GitHub and the production bare repository, then pulled with `--ff-only`. Production now serves release `/srv/peri/releases/2026-09-20T15-40-30` (host timezone UTC+3), completed at 12:41:33 UTC, at https://prod.peri-clinic.zumrudin.ru/. The production build and its SEO gate passed.

Installed ffmpeg 6.1.1, applied the additive reels-field migration (approved Russian values confirmed through the Builder token), copied versioned video caches, and applied only the media cache/MIME additions to both production nginx vhosts. `nginx -t` passed with existing shared-vhost protocol warnings. Previous release pointer, nginx configurations and pre-migration clinic_about record are saved in `/srv/peri/backups/reels-20260920/` on production.

External GETs returned homepage/master/segment HTTP 200, correct MIME and immutable media caching; master and segment bytes matched source cache SHA-256. Production Chromium and WebKit use HLS and preserve playback positions across repeated switches. Full UI checks passed at 320/375/800/1440px, including actual touch swipe, keyboard, pause/sound, reduced motion, visibility, failure UI and no serious/critical axe findings. See `hls-production.json` and `production-ui-results.json`. All 27 unit tests passed before publishing. Physical iPhone/Yandex verification remains the user's hardware check.
