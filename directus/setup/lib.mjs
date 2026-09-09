/**
 * Minimal Directus REST client for setup scripts (no SDK dependency).
 * Env: DIRECTUS_URL (http://127.0.0.1:8055), and either DIRECTUS_ADMIN_TOKEN
 * or DIRECTUS_ADMIN_EMAIL + DIRECTUS_ADMIN_PASSWORD.
 */
import { fileURLToPath } from 'node:url';

try {
  process.loadEnvFile(fileURLToPath(new URL('../../.env', import.meta.url)));
} catch {}

export const BASE = (process.env.DIRECTUS_URL || 'http://127.0.0.1:8055').replace(/\/$/, '');
let token = process.env.DIRECTUS_ADMIN_TOKEN || null;

export async function login() {
  if (token) return token;
  const email = process.env.DIRECTUS_ADMIN_EMAIL;
  const password = process.env.DIRECTUS_ADMIN_PASSWORD;
  if (!email || !password) throw new Error('Set DIRECTUS_ADMIN_TOKEN or DIRECTUS_ADMIN_EMAIL/PASSWORD');
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`login failed: ${res.status} ${await res.text()}`);
  token = (await res.json()).data.access_token;
  return token;
}

export async function api(method, path, body, { ok404 = false } = {}) {
  await login();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 204) return null;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (ok404 && res.status === 404) return null;
    const msg = json?.errors?.map((e) => e.message).join('; ') || res.statusText;
    throw new Error(`${method} ${path} → ${res.status}: ${msg}`);
  }
  return json.data ?? json;
}

export const get = (p, o) => api('GET', p, undefined, o);
export const post = (p, b) => api('POST', p, b);
export const patch = (p, b) => api('PATCH', p, b);
export const del = (p) => api('DELETE', p);

export function log(...args) {
  console.log('[directus-setup]', ...args);
}
