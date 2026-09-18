# Mobile equipment carousel

Approved reference: https://dev.zumrudin.ru/peri-concepts/equipment-mobile-20260918-v1/reference.png

The user approved implementation on the development stand only. Replace the home equipment grid at widths up to 800px with the staff gallery composition: large rounded photo on a neutral background, device name, short description and the CMS details label underneath. Keep a preview of the next card and outlined previous/next controls. Retain the equipment catalog and consultation actions. Preserve CMS device order, images and text; no generated product images are used on the site.

Use staff widths (82% up to 600px, 64% through 800px), 16px gaps, 280px contained images on phones, and 22px image corners. Keep the existing desktop native scrolling rail. Share the staff spring and drag recognizer: 1:1 finger tracking, projected momentum, circular ordering without cloned cards, interruptible critically damped response 0.4s. Keyboard and reduced-motion navigation settle immediately. Swiping a linked card must not open its detail page. Restore CMS order on return to desktop.

Reuse the site's ivory, specialist photo background, gold, Cormorant Garamond and Golos Text. The raster reference is directional; responsive dimensions follow the existing staff gallery.

## Approved refinement: equal height and lighter background

Match the entire mobile equipment card to the actual staff card height, not just the photo. Observe the staff card's border box so CMS text, fonts and responsive wrapping remain the reference. Use the same 24px caption heading, a flexible details-row whitespace area, and preserve complete descriptions. Scope the matched height to widths up to 800px; desktop remains unchanged. Lighten equipment photo backgrounds to `#eeebe7`, independent of staff photo backgrounds.
