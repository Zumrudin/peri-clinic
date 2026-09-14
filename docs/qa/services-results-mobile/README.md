# Service results on mobile

Branch: `fix/services-results-mobile`, based on `main` (`2f68dcf`).

- Production build passed (43 pages).
- Browser checks passed for all 10 treatment pages containing results at widths 320, 375, 390, 430, 800, 801 and 1440 px.
- Mobile checks: square photo frames, uncropped images, matching home card width, no page overflow, next/previous state, keyboard navigation to first/last card, and native scrolling updating the counter. All service results remain accessible, including galleries with more than 10 cards.
- At 801 and 1440 px, card/image/title dimensions and display/object-fit styles matched the existing main build in `/root/peri-about-merge/dist`; carousel controls stay hidden.
- Home carousel next-button regression check passed.
- `beautylizer-390.png`: mobile results example (fixed site controls hidden for capture).

Run after building:

```sh
node scripts/qa/services-results-mobile.mjs <preview-url> [baseline-url]
```

Optional `QA_WIDTHS` environment variable selects comma-separated viewport widths.
