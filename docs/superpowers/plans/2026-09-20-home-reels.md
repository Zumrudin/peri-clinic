# Implementation and validation

1. Extend clinic_about with three text fields using additive home-reels-schema.mjs; preserve existing editor content.
2. Derive the feed from existing normalized specialist media; render only mobile, directly after staff.
3. Implement native scrolling and a single active player, deferred video sources, controls, visibility management and keyboard support.
4. Run Astro check/build, feed unit test and browser tests for 320/375/800/1440px, swipe, playback, pause, sound, viewport exit, hidden tab, reduced motion, failure fallback and accessibility.
5. Publish verified screenshots as review artifacts. Production release is a separate action from implementation.

Before building another CMS environment, run `directus/setup/home-reels-schema.mjs` with that environment's admin credentials. Existing video files and static video routes are reused; no content duplication or video re-upload is needed.

Streaming follow-up:
- Generate immutable HLS packages during builds, cache complete packages atomically, verify aligned segments and cache reuse.
- Lazy-load hls.js, prefetch short starts in parallel, retain a bounded player window and segment cache, preserve positions.
- Verify decoded-frame latency with cold/throttled Chromium and Linux WebKit, real touch swipe, long-feed eviction, reduced motion, fallback and accessibility.
- Copy targeted changes and media cache to dev source, rebuild via receiver, verify live media MIME/cache and playback.

Production rollout (authorized 2026-09-20): install ffmpeg/ffprobe, apply the additive `directus/setup/home-reels-schema.mjs` migration using production admin credentials, verify approved text fields and published specialist videos, install the media cache/MIME locations from production nginx templates, and rebuild through the receiver after pulling `main`. Preserve the prior release symlink and nginx backup for rollback. Video packages may be copied from the versioned build cache to avoid transcoding the same sources on the shared production host. Check public HTML, HLS bytes/MIME/cache, playback and positions after the atomic publish.
