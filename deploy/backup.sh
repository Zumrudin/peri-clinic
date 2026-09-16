#!/usr/bin/env bash
# Daily backup of the Directus Postgres database (on Beget, via peri-db-tunnel) + uploads +
# schema snapshot + a git bundle of the site repo. Keeps 14 local copies; rclone-syncs to a
# Russian S3 provider if RCLONE_REMOTE is set (see deploy/systemd/peri-backup.service).
#
# Beget's managed Postgres has its own backups too — this is a second, independent copy we
# control directly, and the fast path for a local restore drill or a dev-machine clone.
set -euo pipefail

PERI_ROOT=${PERI_ROOT:-/srv/peri}
BACKUPS=$PERI_ROOT/backups
KEEP=${KEEP_BACKUPS:-14}
DATE=$(date +%Y-%m-%dT%H-%M-%S)
DEST=$BACKUPS/$DATE
mkdir -p "$DEST"

echo "[backup] $DATE"

# --- Directus Postgres (custom-format dump: compact, restorable with pg_restore) ---
if [ -f "$PERI_ROOT/directus/.env" ]; then
  set -a; . "$PERI_ROOT/directus/.env"; set +a
fi
# Stand reaches Beget through a plain SSH tunnel (DB_SSL=false); production connects to
# googugiherie.beget.app directly and Beget only accepts TLS there — mirror Directus' setting.
PGSSLMODE=$([ "${DB_SSL:-false}" = "true" ] && echo require || echo prefer) \
PGPASSWORD="${DB_PASSWORD:-}" pg_dump \
  -h "${DB_HOST:-127.0.0.1}" -p "${DB_PORT:-5434}" -U "${DB_USER:-periclinic}" -d "${DB_DATABASE:-periclinic}" \
  -Fc -f "$DEST/data.dump"

# --- Uploaded files (hardlink against the previous backup to save space) ---
PREV=$(ls -1dt "$BACKUPS"/*/ 2>/dev/null | sed -n 2p || true)
if [ -n "${PREV:-}" ] && [ -d "${PREV}uploads" ]; then
  rsync -a --link-dest="${PREV}uploads" "$PERI_ROOT/directus/uploads/" "$DEST/uploads/"
else
  rsync -a "$PERI_ROOT/directus/uploads/" "$DEST/uploads/"
fi

# --- Schema + a git bundle of the site (in case the origin remote is unreachable) ---
# The checkout is /srv/peri/site on production; the dev stand keeps the repo next door.
for snap in "$PERI_ROOT/site/directus/snapshot.yaml" "$PERI_ROOT/../peri-clinnic.ru/directus/snapshot.yaml"; do
  [ -f "$snap" ] && { cp -f "$snap" "$DEST/snapshot.yaml"; break; }
done
if [ -d "$PERI_ROOT/site/.git" ]; then
  git -C "$PERI_ROOT/site" bundle create "$DEST/site.bundle" --all
fi

du -sh "$DEST"

# --- Prune local backups ---
ls -1dt "$BACKUPS"/*/ | tail -n +$((KEEP + 1)) | xargs -r rm -rf

# --- Optional off-server copy (Russian S3, e.g. Timeweb Cloud / Selectel) ---
if [ -n "${RCLONE_REMOTE:-}" ] && command -v rclone >/dev/null; then
  rclone sync "$DEST" "$RCLONE_REMOTE/$DATE" --fast-list
  rclone_keep=$KEEP
  # Prune remote copies beyond $KEEP, oldest first.
  rclone lsf "$RCLONE_REMOTE" --dirs-only | sort | head -n -"$rclone_keep" | while read -r old; do
    [ -n "$old" ] && rclone purge "$RCLONE_REMOTE/${old%/}"
  done
fi

echo "[backup] done: $DEST"
