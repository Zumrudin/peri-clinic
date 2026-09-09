#!/usr/bin/env bash
# Builds the site from /srv/peri/site into a new release and atomically points
# /srv/peri/current at it. Called by the rebuild webhook receiver and by hand.
#
# Env (all optional):
#   PERI_ROOT      base dir (default /srv/peri)
#   GIT_REF        if set, `git fetch && git reset --hard $GIT_REF` before building
#   KEEP_RELEASES  how many releases to keep (default 5)
set -euo pipefail

PERI_ROOT=${PERI_ROOT:-/srv/peri}
SITE=$PERI_ROOT/site
RELEASES=$PERI_ROOT/releases
CURRENT=$PERI_ROOT/current
KEEP=${KEEP_RELEASES:-5}
REL=$RELEASES/$(date +%Y-%m-%dT%H-%M-%S)

export NVM_DIR=${NVM_DIR:-/root/.nvm}
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && nvm use --silent 22 >/dev/null

export ASTRO_CACHE_DIR=${ASTRO_CACHE_DIR:-$PERI_ROOT/cache/astro}
if [ -f "$PERI_ROOT/site.env" ]; then
  set -a; . "$PERI_ROOT/site.env"; set +a
fi

cd "$SITE"
if [ -n "${GIT_REF:-}" ]; then
  git fetch --quiet origin
  git reset --quiet --hard "$GIT_REF"
fi

echo "[build] npm ci"
npm ci --no-audit --no-fund --loglevel=error
echo "[build] astro build"
npm run build --silent
echo "[build] precompress"
node scripts/postbuild/precompress.mjs dist

mkdir -p "$RELEASES"
mv dist "$REL"
ln -sfn "$REL" "$CURRENT.tmp"
mv -T "$CURRENT.tmp" "$CURRENT"
echo "[build] live: $REL"

# keep last N releases
ls -1dt "$RELEASES"/*/ 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -rf
