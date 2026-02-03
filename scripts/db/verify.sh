#!/usr/bin/env bash
set -euo pipefail

BACKUP_ROOT="/var/backups/pgdump"

: "${APP_SLUG:?set APP_SLUG}"

STATUS_FILE="${BACKUP_ROOT}/${APP_SLUG}/last_run.status"

if [[ ! -f "$STATUS_FILE" ]]; then
  echo "status file not found: $STATUS_FILE" >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$STATUS_FILE"

echo "detected migrations: ${DETECTED_MIGRATIONS:-unknown}"
echo "backup path created: ${BACKUP_PATH:-unknown}"
echo "migration status: ${MIGRATION_STATUS:-unknown}"
echo "smoke status: ${SMOKE_STATUS:-unknown}"
echo "restore status: ${RESTORE_STATUS:-unknown}"
