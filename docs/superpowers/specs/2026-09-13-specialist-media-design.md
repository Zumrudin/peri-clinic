# Specialist photo and video uploads

Final scope: direct uploads to the clinic website, replacing the Telegram experiment. Work remains in `feat/specialist-telegram-uploads`, created from main at `9fd0ea3`. No merge, deployment, serving-checkout switch, or production CMS migration is authorized by the development task.

In Specialists → specialist → Фото и видео, editors create a material with a title and upload an image or a video. Supported videos: MP4 with browser-compatible H.264/AAC, or WebM, up to the existing 50 MB CMS limit. No automatic transcoding is provided: MOV/HEVC recordings should be exported as compatible MP4 before upload. An uploaded image becomes the video's cover; without it the specialist portrait is used. Ordering uses the related collection's sort field.

The `specialist_media` collection has native image and video file relations. The targeted idempotent migration adds fields, relations, Editor/Builder permissions and publication-flow coverage while preserving flow status and old content. If the earlier experimental telegram_url field exists, it is hidden and retained for rollback. The widget and its script are removed from the site. Legacy Telegram links are ignored; they are not automatically downloaded or converted. Existing direct video-file links and photo links retain their prior behavior.

Photos use Astro image optimization. A prerendered binary endpoint exports only videos referenced by published, renderable specialists into `/media/specialists/<uuid>-<version>.mp4` (or `.webm`) in the release. At build time it fetches files using the CMS token in an Authorization header; browser URLs contain no secrets and contact neither Telegram nor Directus. Modified/upload timestamps and file size version the URL and persistent `.cache/specialist-videos` download cache (override with VIDEO_CACHE_DIR). Failed, oversized or truncated downloads fail the build; partial cache files are removed. This preserves the existing atomic release behavior.

The website's nginx serves the exported files as ordinary static assets, including HTTP Range requests for seeking. No production nginx changes are needed. Native controls and playsinline support desktop/mobile playback; clicking a video card requests playback, with controls available if a browser blocks it. Video bytes are not requested before the card is opened. Closing the dialog stops playback and removes the source.

No original user video was uploaded by this task. Verification uses an explicitly identified test clip in an isolated CMS and build.
