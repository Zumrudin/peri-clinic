#!/usr/bin/env bash
# Daily backup of the Directus SQLite database + uploads + schema snapshot + a git bundle
# of the site repo. Keeps 14 local copies; rclone-syncs to a Russian S3 provider if
# RCLONE_REMOTE is set (see deploy/systemd/peri-backup.service).
set -euo pipefail

PERI_ROOT=${PERI_ROOT:-/srv/peri}
BACKUPS=$PERI_ROOT/backups
KEEP=${KEEP_BACKUPS:-14}
DATE=$(date +%Y-%m-%dT%H-%M-%S)
DEST=$BACKUPS/$DATE
mkdir -p "$DEST"

echo "[backup] $DATE"

# --- Directus SQLite (online-safe .backup, not a plain file copy) ---
sqlite3 "$PERI_ROOT/directus/database/data.db" ".backup '$DEST/data.db'"

# --- Uploaded files (hardlink against the previous backup to save space) ---
PREV=$(ls -1dt "$BACKUPS"/*/ 2>/dev/null | sed -n 2p || true)
if [ -n "${PREV:-}" ] && [ -d "${PREV}uploads" ]; then
  rsync -a --link-dest="${PREV}uploads" "$PERI_ROOT/directus/uploads/" "$DEST/uploads/"
else
  rsync -a "$PERI_ROOT/directus/uploads/" "$DEST/uploads/"
fi

# --- Schema + a git bundle of the site (in case the origin remote is unreachable) ---
cp -f "$PERI_ROOT/../peri-clinnic.ru/directus/snapshot.yaml" "$DEST/snapshot.yaml" 2>/dev/null || true
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
