# Reels captions and automatic advance

The homepage mobile player shows each newly active caption for 1.5 seconds of actual playback. Pausing or buffering suspends the countdown. Tapping the video toggles the caption and cancels automatic hiding until another card becomes active. Pause, progress and sound controls remain visible.

Caption transitions use transform and opacity with the existing 250 ms / ease-out tokens. Reduced motion retains only the fade. A keyboard-accessible full-video button exposes the caption state.

Remove video looping. On completion, smoothly scroll to the next card using the existing rail navigation and playback window. The final card stops and can be replayed with its play button. Reduced-motion navigation stays instant and preserves the existing manual playback policy.
