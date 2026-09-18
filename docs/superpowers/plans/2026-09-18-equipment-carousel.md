# Implementation and development deployment

1. Extract existing gallery drag recognition and looping spring into shared modules; use them in staff and mobile equipment.
2. Apply the approved mobile composition to Devices.astro; keep CMS data and desktop native scrolling.
3. Check Astro/TypeScript and build; exercise equipment at 320, 375, 390, 600, 800, 801 and 1440px, staff regression, reduced motion, links, breakpoint changes, image loading and accessibility.
4. Publish a new release to the local development stand at https://peri.zumrudin.ru, retaining the previous release. Update the stand's source files to preserve the change during CMS rebuilds. Do not push to origin or deploy to production.
5. Verify the external page and publish a checked screenshot URL for review.

## Deployment record

Published 2026-09-18 to `/srv/peri/releases/2026-09-18T17-40-00-equipment-carousel` by atomic replacement of `/srv/peri/current`. Previous release retained: `/srv/peri/releases/2026-09-18T17-38-08`. Backups of modified stand sources are in `/srv/peri/backups/2026-09-18T17-40-00-equipment-carousel`; the six changed/new source files were also copied into `/srv/peri/site` so CMS rebuilds keep the feature. Compared page body text with the immediately previous release: no differences outside the equipment section. No production deployment or git push performed.

Height/background refinement deployed to `/srv/peri/releases/2026-09-18T17-53-10-equipment-height`. Previous release retained: `/srv/peri/releases/2026-09-18T17-43-06`; three modified stand source files backed up in `/srv/peri/backups/2026-09-18T17-53-10-equipment-height` and updated for CMS rebuilds.
