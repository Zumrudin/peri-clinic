# Reels playback implementation

- Separate the animated caption from persistent controls and add an accessible caption toggle.
- Track the remaining caption delay across playback, buffering, pauses and card changes; dispose timers with the player.
- Advance the rail on ended, prevent accidental replay during scrolling, and support explicit replay of the last clip.
- Verify with Astro diagnostics, a production build and browser checks for caption timing, pause/resume, toggles, real playback completion, final replay and reduced motion.
