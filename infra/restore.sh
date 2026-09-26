#!/usr/bin/env bash
# Restore a pg_dump custom-format backup into the containerized Postgres.
# Usage: ./restore.sh /path/to/internatlas-2026-09-26.dump
set -euo pipefail
cd "$(dirname "$0")"

set -a
# shellcheck disable=SC1091
source .env
set +a

DUMP="${1:?Usage: ./restore.sh /path/to/backup.dump}"
[ -f "$DUMP" ] || { echo "Not found: $DUMP"; exit 1; }

echo "This will REPLACE the contents of database '$POSTGRES_DB'."
printf 'Continue? [y/N] '
read -r ans
[ "$ans" = "y" ] || { echo "Aborted."; exit 1; }

docker cp "$DUMP" internatlas-postgres:/tmp/restore.dump
docker exec internatlas-postgres \
  pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists /tmp/restore.dump
docker exec internatlas-postgres rm /tmp/restore.dump

JOBS=$(docker exec internatlas-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc 'SELECT count(*) FROM "Job";')
COMPANIES=$(docker exec internatlas-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc 'SELECT count(*) FROM "Company";')
echo "Restore complete: $COMPANIES companies, $JOBS jobs."
