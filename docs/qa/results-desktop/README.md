# Desktop results carousel

Reference: `output/references/results-desktop/01-carousel.png`.
Branch: `feat/results-desktop-reference`, based on `main` (`6719b62`).

The home section uses the shared 1500px container, section spacing and gutters. Above 800px the introduction and controls sit beside a single row of equal cards, with a preview of the next card and progress below. Photos retain their original aspect ratio. The mobile layout and mobile-only service carousels retain their behavior.

Validation:

- `npm run build` and `npm run check` (Node 22).
- `RESULTS_QA_OUT=output/qa/results-desktop node scripts/qa/results-mobile.mjs http://127.0.0.1:4327`: passed at 320, 375, 390, 430, 800, 801, 1024, 1440 and 1920px. Checks equal cards, one row, shared right gutter, full last-card visibility, arrows, keyboard, resize, mobile viewport fit, accessibility and no-JavaScript scrolling.
- Fixtures of 10 and 11 records verify the mobile limit and unrestricted desktop count.

Screenshots and machine-readable results: `output/qa/results-desktop/`.
