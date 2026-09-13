/**
 * Thin fetch-based Directus REST client used at build time by Content Layer loaders.
 * No @directus/sdk dependency — same pattern as the proven directus/setup/lib.mjs.
 *
 * Requires DIRECTUS_URL and DIRECTUS_TOKEN in the environment (see .env.example,
 * deploy/site.env.example). A missing/unreachable Directus is a build failure by design —
 * the site is meant to always build against real CMS content.
 */

function env(name: string): string {
  const value = import.meta.env[name] ?? process.env[name];
  if (!value) throw new Error(`Missing required env var "${name}" (see .env.example)`);
  return value;
}

export function directusUrl(): string {
  return env('DIRECTUS_URL').replace(/\/$/, '');
}

/**
 * Static token for use as an `?access_token=` query param on `/assets/:id` URLs.
 * Astro's remote-image fetcher (inferSize + the actual build-time download) can't send our
 * Authorization header, and the public role has no read access — Directus accepts the same
 * static token as a query param on GET requests for exactly this case. Safe here: these image
 * URLs are only ever fetched during the build, never shipped in the final static HTML (Astro
 * re-hosts the optimized output as local hashed files).
 */
export function directusToken(): string {
  return env('DIRECTUS_TOKEN');
}

/** GET a Directus REST path (e.g. "/items/home?fields=*"). Returns the `data` payload. */
export async function directusGet<T = unknown>(path: string): Promise<T> {
  const token = env('DIRECTUS_TOKEN');
  const url = `${directusUrl()}${path}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Directus GET ${path} → ${res.status} ${res.statusText}\n${body.slice(0, 500)}`);
  }
  const json = (await res.json()) as { data: T };
  return json.data;
}

/** Builds a query string from a Directus filter/fields/sort object, skipping empty values. */
export function directusQuery(params: Record<string, string | undefined>): string {
  const usable = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  return usable.length ? '?' + usable.map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`).join('&') : '';
}

/**
 * Astro's Content Layer persists each collection re-sorted by entry ID (string compare),
 * discarding whatever order the loader fetched in — so a Directus `sort` field survives the
 * query but not `getCollection()`. Re-sort by it explicitly after every `getCollection()` call
 * for any collection where display order matters (editors reorder via drag-and-drop in Directus).
 */
export function bySort<T extends { data: { sort?: number | null } }>(entries: T[]): T[] {
  // Match the CMS: records without an assigned position follow ordered records.
  return [...entries].sort((a, b) => (a.data.sort ?? Infinity) - (b.data.sort ?? Infinity));
}
