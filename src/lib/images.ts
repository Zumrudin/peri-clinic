import type { ImageMetadata } from 'astro';

/** All homepage assets, keyed by file name. Phase 3 replaces this with Directus file URLs. */
const modules = import.meta.glob<{ default: ImageMetadata }>('/src/assets/home/*.{jpg,jpeg,png,webp,avif}', {
  eager: true,
});

const byName = new Map<string, ImageMetadata>();
for (const [path, mod] of Object.entries(modules)) {
  byName.set(path.split('/').pop()!, mod.default);
}

export function homeImage(name: string): ImageMetadata {
  const img = byName.get(name);
  if (!img) throw new Error(`Unknown homepage image "${name}". Known: ${[...byName.keys()].join(', ')}`);
  return img;
}
