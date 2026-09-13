# Upload error follow-up

Production nginx recorded a POST /files request with Content-Length 2,849,004,799 bytes. It exceeds both the CMS/video limit (50 MiB) and nginx's request limit (64 MiB). Limits were intentionally not raised to accept multi-gigabyte recordings; the video requires compression or a short exported segment.

A separate request failed because nginx temporary directories were owned by nobody:root with mode 700, while production workers run as www-data. Ownership of /var/lib/nginx/{body,proxy,fastcgi,scgi,uwsgi} was restored to www-data:root. The disposable QA nginx configuration now explicitly uses separate temporary paths under /tmp/peri-video-nginx, avoiding the production paths.

CMS nginx now returns a readable Directus-shaped JSON error for HTTP 413 instead of an HTML error page. nginx -t and graceful reload passed. A header-only request declaring the original oversized body returned 413 application/json with the 50 MB instruction, without transferring gigabytes.

The specialist relation is assigned by the parent form. Its field is now hidden instead of presenting an inactive selector; the underlying relation and required metadata are retained. The field metadata was applied to the live CMS, with its previous value backed up at /srv/peri/backups/specialist-parent-field-20260913.json.

A real 1,128,375-byte MP4 upload through https://peri-cms.zumrudin.ru/files returned HTTP 200. The temporary verification file was deleted afterwards and was never attached to a specialist. No content rebuild is needed for these nginx/CMS interface changes.
