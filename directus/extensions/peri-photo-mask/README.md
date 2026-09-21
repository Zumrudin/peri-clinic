# PERI photo mask

Directus 12 bundle: wraps the built-in `file-image` interface and adds an authenticated image compositing endpoint. No changes to the static site's rendering are needed.

Build with Node 22:

```sh
npm ci --include=dev
npm test
npm run build
```

Copy `package.json`, `package-lock.json`, and `dist/` to the Directus extensions directory as `directus-extension-peri-photo-mask/`. Run `npm ci --omit=dev` in the deployed folder and restart Directus. Then run `directus/setup/photo-mask-deploy.mjs` on the CMS host: it verifies the extension is loaded, backs up image field metadata, and applies the additive migration. `PERI_CMS_ENV` and `PERI_MASK_BACKUP_DIR` override the default environment and backup paths.

The existing authenticated file library keeps originals. The editor saves new PNG files and puts their UUID in the form. Users must save the content record to publish the replacement. Previously published copies are never rewritten. Hidden `directus_files.peri_eye_edit` data is validated before reuse; callers retain their normal Directus file permissions. Custom masks are vector PERI strips with opaque backgrounds, shared identically between preview and server.

Supported: static JPEG, PNG, WebP, up to 50 MB / 40 million pixels, 1–12 masks. EXIF orientation is applied; output EXIF is stripped. Full resolution is preserved. Canceling the content form after creating a copy leaves an unused file in the library, consistent with ordinary Directus uploads.

Integration test: `scripts/qa/photo-mask.mjs`, deliberately restricted to a disposable CMS at localhost:8058; never run it against patient content. It exercises REST security/validation, orientation, immutable original, source recovery, mouse/keyboard interaction, mobile layout, and saving the content record.
