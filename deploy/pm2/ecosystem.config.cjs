// pm2 processes for the Peri site on one server (stand or production).
// Usage: pm2 start deploy/pm2/ecosystem.config.cjs && pm2 save
const { existsSync } = require('node:fs');
const ROOT = process.env.PERI_ROOT || '/srv/peri';
// The pm2 daemon may run on an older Node; Directus needs Node 22 — pin the binary.
const NODE =
  process.env.PERI_NODE ||
  ['/root/.nvm/versions/node/v22.23.2/bin/node', '/usr/local/bin/node', '/usr/bin/node'].find((p) => existsSync(p)) ||
  'node';

module.exports = {
  apps: [
    {
      name: 'peri-directus',
      cwd: `${ROOT}/directus`,
      script: 'node_modules/.bin/directus',
      args: 'start',
      interpreter: NODE,
      env: { NODE_ENV: 'production' }, // the rest comes from ${ROOT}/directus/.env
      max_memory_restart: '600M',
      autorestart: true,
      time: true,
    },
    {
      name: 'peri-rebuild',
      cwd: `${ROOT}/rebuild`,
      script: `${ROOT}/rebuild/server.mjs`,
      interpreter: NODE, // reads ${ROOT}/rebuild/.env itself
      autorestart: true,
      time: true,
    },
  ],
};
