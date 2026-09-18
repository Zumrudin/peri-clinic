# Mobile equipment carousel verification

- `npm run check`: 0 errors, 0 warnings (existing project hints remain).
- `npm run build`: 44 pages successfully built using Node 22 and development CMS.
- `node --test src/lib/motion.test.ts`: 6/6 passed.
- `node scripts/qa/equipment-carousel.mjs http://127.0.0.1:4322`: 320, 375, 390 and 600px passed; browser closed during the 800px scenario in the long run. The remaining 800, 801 and 1440px scenarios passed in a separate `QA_WIDTHS=800,801,1440` run.
- Tests cover loaded CMS images, card geometry, no page overflow, all-card wraparound, both directions, touch swipe click suppression, keyboard, reduced motion, mid-animation breakpoint changes, CMS order restoration, detail links and desktop native scrolling.
- Additional 390px check: rapid button retargeting and grabbing an in-flight animation without jumps or navigation.
- Staff gallery: all eight combinations of 375/390/600/800px and 3/4 cards pass, including lightbox and focus restoration.
- Axe: mobile equipment has no violations after the existing entrance reveal settles. Homepage desktop has zero serious/critical violations; three existing redundant-alt nodes remain.
- SEO validator reports six existing CMS metadata issues on /spravka and specialist pages. The identical six issues occur on the previous development release; this change introduces none.

Screenshots show actual CMS order and photos, not the generated reference assets. Screenshot-only tests do not change content.

## Height/background refinement

Measured staff and equipment full-card and photo heights at 320, 375, 390, 430, 600, 601, 768 and 800px: equal within 1px at every width. Checked caption boxes fit without clipping, both navigation buttons, and 801/1440px desktop layouts. Examples: 375px → both 463.59px; 390px → both 442.59px; photo height is 280px through 600px. Background is now `rgb(238, 235, 231)` (`#eeebe7`). The full-card height follows a ResizeObserver on the staff card; 24px titles and flexible details-row whitespace preserve full descriptions, including the narrow 430px case. Screenshot `equipment-390-lighter.png` hides fixed site chrome only for the section capture.
