# Staff carousel regression

Branch: `fix/staff-mobile-carousel`, based on `main` (`68fdae9`).

Changes:
- Disable native horizontal scrolling and scroll snapping when the JavaScript carousel is active; explicitly reserve horizontal photo gestures for the carousel.
- Limit the swipe threshold to 40 CSS pixels, including wider mobile cards.
- Closing the lightbox restores focus to its opener without reordering cards.

Run `node scripts/qa/staff-mobile-carousel.mjs <base-url>` against a running site. The test uses Chrome touch input at 375, 390, 600, and 800 pixels with three and four cards. It checks 60-pixel swipes in both directions, wrapping, actual visible card position, click suppression, and order/focus after closing with the button or Escape, including after browsing photos.

The original implementation fails the order-preservation assertion when closing the second portrait. Existing general gallery QA was updated to expect focus on the opener and handle the current CMS photo count. The edge suite's gesture checks passed; its accessibility scan reported `image-redundant-alt` in CMS content. The general gallery suite encountered an image decoding error on the development server.

Result: all eight targeted scenarios passed against the static build in Chrome mobile emulation.

## 2026-09-18 shared-carousel regression

The original test started touch on the offscreen center of the second card and failed on the unchanged development release. The test now swipes the visible first card by 66% of its width, pauses before release for deterministic single-card movement, waits for the spring to settle, and waits for the lightbox close animation before checking focus. The second card is opened by its visible edge. All eight width/count combinations pass after extraction of shared motion.
