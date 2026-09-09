// pm2 processes for the Peri site on one server (stand or production).
// Usage: pm2 start deploy/pm2/ecosystem.config.cjs && pm2 save
const ROOT = process.env.PERI_ROOT || '/srv/peri';

module.exports = {
  apps: [
    {
      name: 'peri-directus',
      cwd: `${ROOT}/directus`,
      script: 'node_modules/.bin/directus',
      args: 'start',
      interpreter: 'node',
      env: { NODE_ENV: 'production' }, // the rest comes from ${ROOT}/directus/.env
      max_memory_restart: '600M',
      autorestart: true,
      time: true,
    },
    {
      name: 'peri-rebuild',
      cwd: `${ROOT}/rebuild`,
      script: `${ROOT}/rebuild/server.mjs`,
      interpreter: 'node',
      env_file: `${ROOT}/rebuild/.env`,
      autorestart: true,
      time: true,
    },
  ],
};
