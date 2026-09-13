# Specialist photos and Telegram video

Work is isolated in `feat/specialist-telegram-uploads`, created from `main` at `9fd0ea3`. Do not merge, deploy, switch the serving checkout, or apply the CMS migration without the user's release instruction.

Editors add a material inside a specialist's new “Фото и Telegram” relation: a title and either an uploaded image or a public Telegram message permalink. Telegram supplies its own preview and player; a separate cover is unnecessary. Photos use Directus's file library and Astro's existing build-time optimization, so browser HTML never contains CMS credentials. New materials can be reordered. Existing JSON media remain readable and their saved Telegram links are recognized automatically.

The official Telegram post widget loads as the card approaches the viewport (300px margin). It controls iframe height and video playback. The page retains a direct message link, including when scripts are blocked; a 12-second hint covers slow loading. No Telegram scraping, expiring CDN video URLs, downloads, or unofficial players are part of the feature.

Private group links, invitations and links to channel home pages are invalid. The CMS validates new permalink fields. A valid public permalink does not guarantee video availability: Telegram may withhold large files, delete a post, or deny embedding. The exact saved video `https://t.me/peri_clinic/2055` currently returns “Media is too big” in the official widget. The frontend cannot remove that server-side limitation. A smaller re-upload or website-hosted video would be needed for this particular recording.

Schema changes are additive: `specialist_media` plus `specialists.media_items`. A targeted idempotent migration adds relations, content-policy access, and existing publication-flow coverage without changing flow status or existing content. The generic schema also declares the new relation and file field. No migration has been applied to the working site's CMS.
