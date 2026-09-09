import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://www.peri-clinic.ru',
  trailingSlash: 'never',
  build: { format: 'file', inlineStylesheets: 'always' },
  image: {
    // Persistent cache on the server makes rebuilds fast (see deploy/rebuild/build.sh)
    cacheDir: process.env.ASTRO_CACHE_DIR || './node_modules/.astro',
  },
});
