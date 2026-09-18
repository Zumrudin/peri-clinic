# Implementation and development deployment

1. Extract existing gallery drag recognition and looping spring into shared modules; use them in staff and mobile equipment.
2. Apply the approved mobile composition to Devices.astro; keep CMS data and desktop native scrolling.
3. Check Astro/TypeScript and build; exercise equipment at 320, 375, 390, 600, 800, 801 and 1440px, staff regression, reduced motion, links, breakpoint changes, image loading and accessibility.
4. Publish a new release to the local development stand at https://peri.zumrudin.ru, retaining the previous release. Update the stand's source files to preserve the change during CMS rebuilds. Do not push to origin or deploy to production.
5. Verify the external page and publish a checked screenshot URL for review.

## Deployment record

Published 2026-09-18 to `/srv/peri/releases/2026-09-18T17-40-00-equipment-carousel` by atomic replacement of `/srv/peri/current`. Previous release retained: `/srv/peri/releases/2026-09-18T17-38-08`. Backups of modified stand sources are in `/srv/peri/backups/2026-09-18T17-40-00-equipment-carousel`; the six changed/new source files were also copied into `/srv/peri/site` so CMS rebuilds keep the feature. Compared page body text with the immediately previous release: no differences outside the equipment section. No production deployment or git push performed.

Height/background refinement deployed to `/srv/peri/releases/2026-09-18T17-53-10-equipment-height`. Previous release retained: `/srv/peri/releases/2026-09-18T17-43-06`; three modified stand source files backed up in `/srv/peri/backups/2026-09-18T17-53-10-equipment-height` and updated for CMS rebuilds.

## Production deployment — 2026-09-18

User authorized commit, push to main and production deployment. Committed external-file instructions as `c8b2441` and the equipment carousel, final height/background refinements and QA as `3d2175f`. Pushed main to GitHub and the production bare repository, fast-forwarded `/srv/peri/site` on 217.114.0.254, then requested a build through the authenticated rebuild receiver.

Build started at 17:56:21 UTC and completed at 17:57:23 UTC with result `ok`: 44 pages, SEO validation with zero errors/warnings, precompression and atomic release switch to `/srv/peri/releases/2026-09-18T20-56-21`. Previous release: `/srv/peri/releases/2026-09-18T20-15-40`.

External verification at https://prod.peri-clinic.zumrudin.ru/#equipment: HTTP 200; equipment interaction tests passed at 390, 801 and 1440px (images, touch, wrap, reduced motion, links, responsive mode and desktop scrolling). Height/background checks passed at 320, 375, 390, 430, 600, 601, 768 and 800px, with captions fully visible. Source checkout clean at `3d2175f`. Production DNS and CMS content were not changed. This deployment record is documentation only and does not require another site build.
