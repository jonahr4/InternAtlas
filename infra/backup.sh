#!/usr/bin/env bash
# Nightly logical backup of the InternAtlas Postgres database.
# Usage: ./backup.sh            (reads connection settings from infra/.env)
# Suggested cron on the VM: 0 4 * * * /home/ubuntu/internatlas/infra/backup.sh
set -euo pipefail
cd "$(dirname "$0")"

set -a
# shellcheck disable=SC1091
source .env
set +a

BACKUP_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$BACKUP_DIR"
STAMP=$(date +%F_%H%M)
FILE="$BACKUP_DIR/internatlas-$STAMP.dump"

docker exec internatlas-postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "$FILE"

# Keep the last 14 backups, delete older ones.
ls -t "$BACKUP_DIR"/internatlas-*.dump 2>/dev/null | tail -n +15 | xargs -r rm --

echo "Backup written to $FILE ($(du -h "$FILE" | cut -f1))"
