# Implementation and review

- [x] Create an isolated branch from main.
- [x] Recognize public Telegram message links, including legacy video_url values without covers.
- [x] Add official lazy post widgets and a persistent external-link fallback.
- [x] Add a related CMS collection with native photo upload, file metadata, ordering, and Telegram URL validation.
- [x] Render uploaded images through Astro; preserve legacy content.
- [x] Prepare an additive release migration with permissions and publication-flow coverage.
- [x] Exercise migration twice, upload, expanded relations, and URL validation against a separate Directus instance with SQLite on 127.0.0.1:8057.
- [x] Finish browser, build and accessibility verification; record results in docs/qa/specialist-media/README.md.
- [ ] Await the user's explicit release instruction. Do not deploy as part of development.

## Future release, only after authorization

1. Back up CMS schema/data and the serving release.
2. Apply `node directus/setup/specialist-media-schema.mjs` with the target admin environment. It does not overwrite specialist content.
3. Build the reviewed branch against the updated CMS and run the normal release process only after authorization.
4. In Specialists → specialist → Фото и Telegram, create a material and set a title plus either a photo upload or a public Telegram message link. Save the material and the specialist. Existing links remain in Ранее добавленные материалы (ссылки).
5. Check the chosen message: 2055 currently cannot play in Telegram's widget because Telegram reports its media is too big.

## Isolated checks

`npm test`, `npm run check`, `npm run build` require Node 22.23.2 or newer compatible Node.

`scripts/qa/specialist-media-cms.mjs` expects a disposable bootstrapped Directus on 127.0.0.1:8057 and a local env file containing ADMIN_EMAIL/ADMIN_PASSWORD (pass its path as argv[2]). It uploads the repository's cabinet.webp and creates only test records in that instance.

`scripts/qa/specialist-media.mjs <isolated-preview-origin>` tests real Telegram playback on 375/800/1024/1440 widths using message 2048, verifies the 2055 limitation, photo lightbox and blocked-script fallback. The browser intercepts its own document response to substitute the playable permalink; no CMS content is changed.
