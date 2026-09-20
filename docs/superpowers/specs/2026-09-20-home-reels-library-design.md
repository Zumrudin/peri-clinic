# Independent homepage video library

Directus collection `home_reels`, displayed as «Жизнь клиники» in the content navigation. Each record has a required video file selected from the existing Directus file library or uploaded, required caption, optional secondary caption and cover, draft/published/archived status and manual ordering. File references are shared with specialist records without copying or modifying those records.

The homepage and both reel media build routes read only this collection, sorted by sort then id. Drafts, archived entries and records without a video are excluded. Reusing a video in multiple curated cards is supported; build artefacts deduplicate file encodes. An empty curated list hides the section, with no implicit fallback to specialists. Existing uploaded homepage videos are seeded once on collection creation, preserving captions, order and covers. No later rerun recreates a deliberately emptied list. Existing adaptive streaming and bounded prefetch stay intact.

Editor CRUD, Builder read permissions, list preset, automatic publication including reorder and manual publish button are provisioned additively. The migration saves a source snapshot before first creation. Dev validation precedes production rollout.
