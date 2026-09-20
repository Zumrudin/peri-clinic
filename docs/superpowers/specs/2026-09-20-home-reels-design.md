# Mobile home reels

Selected section title: «Жизнь клиники» (user decision, 2026-09-20).

Approved: light reference, https://dev.zumrudin.ru/peri-concepts/reels-20260920-1038/01-light.png.

Place a mobile-only section immediately after the staff gallery. Paper background, existing Cormorant/Golos typography, rounded 9:16 video cards, next-card peek, caption and author over a dark readability gradient, pause/mute controls, playback progress, pagination and swipe hint.

Initial content uses deduplicated videos from published, non-demo specialists in CMS order. Photos are excluded. The section is absent when no videos or no section title are configured. Section title, description and hint live in clinic_about. No generated reference people are used on the website.

Native horizontal scroll snap preserves vertical page scrolling and supports touch. Arrow keys/Home/End and pagination provide alternatives. Autoplay is muted and only applies to the active visible card on mobile. Stop on page exit, hidden tab, desktop breakpoint, or opening a dialog. Manual pause is preserved. Reduced-motion visitors start videos explicitly. Blocked autoplay retains play controls; failed media provides a direct link. Video bytes stay on the static site, never exposing CMS credentials.

Playback follow-up: warm the next/previous clips with native auto preload after the active player can play. Keep video elements and sources across swipes, preserving playback position and decoded/buffered data. Versioned static video URLs receive immutable browser caching on the development server.

Streaming revision (supersedes whole-file prefetch): owned videos publish two aligned HLS/fMP4 renditions (360 and 540 pixels wide), with 2-second segments. Lazy hls.js initializes within 1200px of the section on mobile. Current and next two starts load in parallel; inactive players remain paused with a short buffer. Retain the previous player, remember evicted positions, and cap the shared segment byte cache at 12 MiB. No reel media or streaming library is requested above the fold. Modern iPhone uses ManagedMediaSource with remote playback disabled; native HLS and MP4 remain compatibility fallbacks. Actual iOS preloading and decoding are browser-controlled, so hardware verification is still required.
