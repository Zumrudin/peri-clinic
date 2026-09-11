/**
 * Creates a static-token service account for Claude Code (this coding agent) attached to
 * the existing "Редактор" role, so future sessions can read/write content collections via
 * REST without a human logging in each time. Same idiom as the Builder account in roles.mjs,
 * but Editor-level CRUD instead of read-only (needed for content fixes like flipping
 * needs_review flags, not just builds).
 * Run once: DIRECTUS_URL=... DIRECTUS_ADMIN_EMAIL=... DIRECTUS_ADMIN_PASSWORD=... node directus/setup/agent-token.mjs
 */
import { randomBytes } from 'node:crypto';
import { get, post, log } from './lib.mjs';

async function main() {
  const editorRole = (await get(`/roles?filter[name][_eq]=${encodeURIComponent('Редактор')}`))[0];
  if (!editorRole) throw new Error('Редактор role not found — run roles.mjs first');

  let agent = (await get(`/users?filter[email][_eq]=claude-agent@peri-clinic.ru`))[0];
  if (!agent) {
    const token = 'peri_agent_' + randomBytes(24).toString('hex');
    agent = await post('/users', {
      email: 'claude-agent@peri-clinic.ru',
      first_name: 'Claude Code',
      role: editorRole.id,
      status: 'active',
      token,
    });
    log('agent token (save to .env.claude, DIRECTUS_TOKEN=):', token);
  } else {
    log('claude-agent user already exists; token unchanged (rotate via admin if needed)');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
