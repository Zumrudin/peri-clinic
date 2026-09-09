/**
 * Creates roles + policies + permissions:
 *   Редактор — app access, full CRUD on content collections and files, read-only build_log.
 *   Builder  — API only; read content + files, create/update build_log. Prints its static token.
 * Run: node directus/setup/roles.mjs
 */
import { randomBytes } from 'node:crypto';
import { get, post, patch, log } from './lib.mjs';
import { contentCollections, filesJunctions } from './collections.mjs';

const junctions = filesJunctions.map(([c]) => `${c}_files`);
const readable = [...contentCollections, ...junctions, 'build_log', 'directus_files', 'directus_folders'];
const editable = [...contentCollections.filter((c) => c !== 'site_settings'), ...junctions, 'directus_files', 'directus_folders'];

async function ensurePolicy(name, opts) {
  const found = (await get(`/policies?filter[name][_eq]=${encodeURIComponent(name)}`))[0];
  if (found) return found;
  log('create policy', name);
  return post('/policies', { name, ...opts });
}

async function ensureRole(name, opts) {
  const found = (await get(`/roles?filter[name][_eq]=${encodeURIComponent(name)}`))[0];
  if (found) return found;
  log('create role', name);
  return post('/roles', { name, ...opts });
}

async function attachPolicy(role, policy) {
  const access = await get(`/access?filter[role][_eq]=${role.id}&filter[policy][_eq]=${policy.id}`);
  if (!access.length) await post('/access', { role: role.id, policy: policy.id });
}

async function setPermissions(policy, perms) {
  const existing = await get(`/permissions?filter[policy][_eq]=${policy.id}&limit=-1`);
  if (existing.length) {
    await Promise.all(existing.map((p) => fetchDel(p.id)));
  }
  for (const p of perms) {
    await post('/permissions', { policy: policy.id, fields: ['*'], permissions: {}, validation: {}, presets: null, ...p });
  }
}
async function fetchDel(id) {
  const { del } = await import('./lib.mjs');
  return del(`/permissions/${id}`);
}

async function main() {
  // --- Редактор
  const editorPolicy = await ensurePolicy('Редактор: контент', {
    icon: 'edit',
    description: 'Редактирование контента сайта, файлов, чтение журнала публикаций',
    app_access: true,
    admin_access: false,
    enforce_tfa: false,
  });
  const editorPerms = [];
  for (const c of readable) editorPerms.push({ collection: c, action: 'read' });
  for (const c of editable) for (const action of ['create', 'update', 'delete']) editorPerms.push({ collection: c, action });
  editorPerms.push({ collection: 'site_settings', action: 'update' });
  editorPerms.push({ collection: 'directus_users', action: 'read', fields: ['id', 'first_name', 'last_name', 'avatar'] });
  await setPermissions(editorPolicy, editorPerms);
  const editorRole = await ensureRole('Редактор', { icon: 'edit_note', description: 'Сотрудники клиники' });
  await attachPolicy(editorRole, editorPolicy);

  // --- Builder (API only)
  const builderPolicy = await ensurePolicy('Builder: сборка сайта', {
    icon: 'build',
    description: 'Только чтение контента для сборки статики + запись журнала публикаций',
    app_access: false,
    admin_access: false,
  });
  const builderPerms = readable.map((c) => ({ collection: c, action: 'read' }));
  builderPerms.push({ collection: 'build_log', action: 'create' }, { collection: 'build_log', action: 'update' });
  await setPermissions(builderPolicy, builderPerms);
  const builderRole = await ensureRole('Builder', { icon: 'build', description: 'Технический аккаунт сборки' });
  await attachPolicy(builderRole, builderPolicy);

  let builder = (await get(`/users?filter[email][_eq]=builder@peri.local`))[0];
  if (!builder) {
    const token = 'peri_' + randomBytes(24).toString('hex');
    builder = await post('/users', {
      email: 'builder@peri.local',
      first_name: 'Builder',
      role: builderRole.id,
      status: 'active',
      token,
    });
    log('builder token (save to /srv/peri/site.env and rebuild/.env):', token);
  } else {
    log('builder user exists; token unchanged (rotate via admin if needed)');
  }
  log('roles applied');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
