/**
 * Rebuild webhook receiver. Zero dependencies, Node 22.
 *
 *   POST /rebuild   header X-Rebuild-Token: <REBUILD_TOKEN>   → schedules a build (debounced)
 *   GET  /status                                              → JSON state
 *
 * Env: REBUILD_PORT (8787), REBUILD_TOKEN (required), BUILD_SCRIPT (/srv/peri/rebuild/build.sh),
 *      DEBOUNCE_MS (20000), DIRECTUS_URL + DIRECTUS_TOKEN (optional: writes build_log rows),
 *      STATE_FILE (/srv/peri/rebuild/state.json)
 */
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Load ./.env next to this file (pm2 does not read env files itself).
try {
  process.loadEnvFile(fileURLToPath(new URL('./.env', import.meta.url)));
} catch {}

const PORT = Number(process.env.REBUILD_PORT || 8787);
const TOKEN = process.env.REBUILD_TOKEN;
const BUILD = process.env.BUILD_SCRIPT || '/srv/peri/rebuild/build.sh';
const DEBOUNCE = Number(process.env.DEBOUNCE_MS || 20000);
const STATE_FILE = process.env.STATE_FILE || '/srv/peri/rebuild/state.json';
const DIRECTUS_URL = process.env.DIRECTUS_URL;
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN;

if (!TOKEN) {
  console.error('REBUILD_TOKEN is required');
  process.exit(1);
}

const state = existsSync(STATE_FILE)
  ? JSON.parse(readFileSync(STATE_FILE, 'utf8'))
  : { status: 'idle', last_started: null, last_finished: null, last_result: null, last_message: '', queued: false };
let timer = null;
let running = false;
let pending = false;

const save = () => writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

async function log(payload, id) {
  if (!DIRECTUS_URL || !DIRECTUS_TOKEN) return null;
  try {
    const res = await fetch(`${DIRECTUS_URL}/items/build_log${id ? `/${id}` : ''}`, {
      method: id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DIRECTUS_TOKEN}` },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    return json?.data?.id ?? id ?? null;
  } catch (e) {
    console.error('[rebuild] build_log write failed:', e.message);
    return id ?? null;
  }
}

function runBuild(triggeredBy) {
  if (running) {
    pending = true;
    state.queued = true;
    save();
    return;
  }
  running = true;
  state.status = 'running';
  state.last_started = new Date().toISOString();
  state.queued = false;
  save();

  const output = [];
  const child = spawn('bash', [BUILD], { env: process.env });
  const collect = (chunk) => {
    const s = chunk.toString();
    output.push(s);
    if (output.length > 400) output.shift();
    process.stdout.write(s);
  };
  child.stdout.on('data', collect);
  child.stderr.on('data', collect);

  log({ started_at: state.last_started, status: 'running', triggered_by: triggeredBy }).then((id) => {
    child.on('close', async (code) => {
      running = false;
      state.status = 'idle';
      state.last_finished = new Date().toISOString();
      state.last_result = code === 0 ? 'ok' : 'failed';
      state.last_message = output.join('').slice(-4000);
      save();
      await log({ finished_at: state.last_finished, status: state.last_result, message: state.last_message }, id);
      console.log(`[rebuild] finished: ${state.last_result} (exit ${code})`);
      if (pending) {
        pending = false;
        runBuild('queued');
      }
    });
  });
}

function schedule(triggeredBy) {
  clearTimeout(timer);
  state.queued = true;
  save();
  timer = setTimeout(() => runBuild(triggeredBy), DEBOUNCE);
}

createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'GET' && url.pathname === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ...state, running, pending }));
  }
  if (req.method === 'POST' && url.pathname === '/rebuild') {
    if (req.headers['x-rebuild-token'] !== TOKEN) {
      res.writeHead(401);
      return res.end('unauthorized');
    }
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      let by = 'webhook';
      try {
        by = JSON.parse(body || '{}').triggered_by || by;
      } catch {}
      schedule(by);
      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ scheduled: true, in_ms: DEBOUNCE }));
    });
    return;
  }
  res.writeHead(404);
  res.end();
}).listen(PORT, '127.0.0.1', () => console.log(`[rebuild] listening on 127.0.0.1:${PORT}`));
