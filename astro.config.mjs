import { defineConfig } from 'astro/config';

// Directus serves file assets over HTTP(S); astro:assets needs its origin allow-listed
// to optimize those remote images at build time (AVIF/WebP via the local sharp install).
const directusUrl = new URL(process.env.DIRECTUS_URL || 'http://127.0.0.1:8055');

export default defineConfig({
  site: process.env.SITE_URL || 'https://www.peri-clinic.ru',
  trailingSlash: 'never',
  build: { format: 'file', inlineStylesheets: 'always' },
  image: {
    // Persistent cache on the server makes rebuilds fast (see deploy/rebuild/build.sh)
    cacheDir: process.env.ASTRO_CACHE_DIR || './node_modules/.astro',
    remotePatterns: [
      {
        protocol: directusUrl.protocol.replace(':', ''),
        hostname: directusUrl.hostname,
        port: directusUrl.port,
        pathname: '/assets/**',
      },
    ],
  },
});
