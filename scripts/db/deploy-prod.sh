#!/usr/bin/env bash
set -euo pipefail

BACKUP_ROOT="/var/backups/pgdump"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-prisma/migrations}"

: "${APP_SLUG:?set APP_SLUG}"
: "${SYSTEM_DATABASE_URL:?set SYSTEM_DATABASE_URL}"
: "${DATABASE_URL:?set DATABASE_URL}"

APP_SCHEMA="tenant_${APP_SLUG}"
BACKUP_DIR="${BACKUP_ROOT}/${APP_SLUG}"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
LOG_FILE="${BACKUP_DIR}/deploy_${TS}.log"
STATUS_FILE="${BACKUP_DIR}/last_run.status"

DETECTED_MIGRATIONS="unknown"
BACKUP_PATH="none"
MIGRATION_STATUS="not_run"
SMOKE_STATUS="not_run"
RESTORE_STATUS="not_needed"
DETECT_REASON=""
BACKUP_ELIGIBLE="yes"

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "missing required command: $1" >&2
    exit 1
  }
}

write_status() {
  mkdir -p "$BACKUP_DIR"
  {
    printf 'LAST_RUN_TS=%q\n' "$TS"
    printf 'DETECTED_MIGRATIONS=%q\n' "$DETECTED_MIGRATIONS"
    printf 'DETECT_REASON=%q\n' "$DETECT_REASON"
    printf 'BACKUP_PATH=%q\n' "$BACKUP_PATH"
    printf 'MIGRATION_STATUS=%q\n' "$MIGRATION_STATUS"
    printf 'SMOKE_STATUS=%q\n' "$SMOKE_STATUS"
    printf 'RESTORE_STATUS=%q\n' "$RESTORE_STATUS"
    printf 'LOG_FILE=%q\n' "$LOG_FILE"
  } > "$STATUS_FILE"
}

on_error() {
  local exit_code=$?
  echo "deploy failed (exit $exit_code)" >&2
  write_status
  exit "$exit_code"
}
trap on_error ERR

require_cmd psql
require_cmd pg_dump
require_cmd pg_restore

get_pg_major() {
  local version_num
  version_num=$(psql "$SYSTEM_DATABASE_URL" -v ON_ERROR_STOP=1 -tA -c "SHOW server_version_num;")
  if [[ -z "$version_num" ]]; then
    echo "failed to read server_version_num" >&2
    exit 1
  fi

  echo $((version_num / 10000))
}

get_client_major() {
  local ver major
  ver=$(pg_dump --version | awk '{print $NF}')
  major=${ver%%.*}
  if [[ -z "$major" ]]; then
    echo "failed to parse pg_dump version" >&2
    exit 1
  fi
  echo "$major"
}

SERVER_PG_MAJOR="$(get_pg_major)"
CLIENT_PG_MAJOR="$(get_client_major)"

if (( CLIENT_PG_MAJOR < SERVER_PG_MAJOR )); then
  echo "pg_dump/pg_restore major (${CLIENT_PG_MAJOR}) is older than server (${SERVER_PG_MAJOR})" >&2
  echo "Install a matching client (postgresql-client-${SERVER_PG_MAJOR})." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR" || true
if ! touch "${BACKUP_DIR}/.write_test" 2>/dev/null; then
  echo "backup dir not writable: $BACKUP_DIR" >&2
  echo "If running in a Swarm service, bind-mount $BACKUP_ROOT at the service level." >&2
  exit 1
fi
rm -f "${BACKUP_DIR}/.write_test"

exec > >(tee -a "$LOG_FILE") 2>&1

write_status

echo "[deploy] app schema: $APP_SCHEMA"

detect_migrations() {
  if [[ ! -d "$MIGRATIONS_DIR" ]]; then
    echo "missing migrations dir: $MIGRATIONS_DIR" >&2
    exit 1
  fi

  local schema_exists table_exists failed_count rolled_count
  schema_exists=$(psql "$SYSTEM_DATABASE_URL" -v ON_ERROR_STOP=1 -tA \
    -c "SELECT 1 FROM information_schema.schemata WHERE schema_name='${APP_SCHEMA}';")

  if [[ "$schema_exists" != "1" ]]; then
    BACKUP_ELIGIBLE="no"
    DETECTED_MIGRATIONS="yes"
    DETECT_REASON="schema_missing"
    return 0
  fi

  table_exists=$(psql "$SYSTEM_DATABASE_URL" -v ON_ERROR_STOP=1 -tA \
    -c "SELECT 1 FROM information_schema.tables WHERE table_schema='${APP_SCHEMA}' AND table_name='_prisma_migrations';")

  if [[ "$table_exists" != "1" ]]; then
    DETECTED_MIGRATIONS="yes"
    DETECT_REASON="migrations_table_missing"
    return 0
  fi

  failed_count=$(psql "$SYSTEM_DATABASE_URL" -v ON_ERROR_STOP=1 -tA \
    -c "SELECT count(*) FROM ${APP_SCHEMA}._prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL;")
  if [[ "$failed_count" != "0" ]]; then
    echo "found unfinished migrations in ${APP_SCHEMA} (count=$failed_count)" >&2
    exit 1
  fi

  rolled_count=$(psql "$SYSTEM_DATABASE_URL" -v ON_ERROR_STOP=1 -tA \
    -c "SELECT count(*) FROM ${APP_SCHEMA}._prisma_migrations WHERE rolled_back_at IS NOT NULL;")
  if [[ "$rolled_count" != "0" ]]; then
    echo "found rolled-back migrations in ${APP_SCHEMA} (count=$rolled_count)" >&2
    exit 1
  fi

  local disk_list db_list missing_in_db extra_in_db
  disk_list=$(find "$MIGRATIONS_DIR" -mindepth 2 -maxdepth 2 -type f -name migration.sql \
    -printf '%P\n' | cut -d/ -f1 | sort -u)

  db_list=$(psql "$SYSTEM_DATABASE_URL" -v ON_ERROR_STOP=1 -tA \
    -c "SELECT migration_name FROM ${APP_SCHEMA}._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name;")

  list_to_stream() {
    if [[ -n "$1" ]]; then
      printf '%s\n' "$1"
    fi
  }

  missing_in_db=$(comm -23 <(list_to_stream "$disk_list") <(list_to_stream "$db_list"))
  extra_in_db=$(comm -13 <(list_to_stream "$disk_list") <(list_to_stream "$db_list"))

  if [[ -n "$extra_in_db" ]]; then
    echo "db has migrations not present on disk:" >&2
    echo "$extra_in_db" >&2
    exit 1
  fi

  if [[ -n "$missing_in_db" ]]; then
    DETECTED_MIGRATIONS="yes"
    DETECT_REASON="pending_on_disk"
  else
    DETECTED_MIGRATIONS="no"
    DETECT_REASON="none"
  fi
}

backup_schema() {
  BACKUP_PATH="${BACKUP_DIR}/${APP_SCHEMA}_${TS}.dump"
  pg_dump --dbname="$SYSTEM_DATABASE_URL" \
    --format=custom --no-owner --no-acl \
    --schema="$APP_SCHEMA" \
    --file="$BACKUP_PATH"

  write_status

  # retention: keep last 3, delete older than 14 days
  ls -1t "${BACKUP_DIR}"/*.dump 2>/dev/null | tail -n +4 | xargs -r rm -f
  find "$BACKUP_DIR" -type f -name '*.dump' -mtime +14 -delete
}

smoke_check() {
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v app_schema="$APP_SCHEMA" <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.schemata
    WHERE schema_name = :'app_schema'
  ) THEN
    RAISE EXCEPTION 'missing tenant schema';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = :'app_schema'
      AND table_name = '_prisma_migrations'
  ) THEN
    RAISE EXCEPTION 'missing _prisma_migrations table';
  END IF;
END $$;
SQL
}

restore_schema() {
  local dump_path="$1"
  if [[ ! -f "$dump_path" ]]; then
    echo "restore dump not found: $dump_path" >&2
    return 1
  fi

  if ! pg_restore -l "$dump_path" | grep -q "$APP_SCHEMA"; then
    echo "refusing restore: dump does not reference $APP_SCHEMA" >&2
    return 1
  fi

  pg_restore --dbname="$SYSTEM_DATABASE_URL" \
    --clean --if-exists --no-owner --no-acl \
    --schema="$APP_SCHEMA" \
    --single-transaction --exit-on-error \
    "$dump_path"
}

detect_migrations
write_status

echo "[deploy] detected migrations: $DETECTED_MIGRATIONS ($DETECT_REASON)"

if [[ "$DETECTED_MIGRATIONS" == "yes" && "$BACKUP_ELIGIBLE" == "yes" ]]; then
  echo "[deploy] creating backup"
  backup_schema
elif [[ "$DETECTED_MIGRATIONS" == "yes" && "$BACKUP_ELIGIBLE" != "yes" ]]; then
  echo "[deploy] skipping backup (schema missing)"
else
  echo "[deploy] no pending migrations; backup skipped"
fi

MIGRATION_STATUS="running"
write_status

echo "[deploy] running db:init"
npm run db:init -- --slug "$APP_SLUG"

echo "[deploy] running db:migrate:prod"
NODE_ENV=production npm run db:migrate:prod

MIGRATION_STATUS="success"
write_status

SMOKE_STATUS="running"
write_status

if smoke_check; then
  SMOKE_STATUS="success"
  write_status
  echo "[deploy] smoke check passed"
else
  SMOKE_STATUS="failed"
  write_status
  echo "[deploy] smoke check failed"

  if [[ "$DETECTED_MIGRATIONS" == "yes" && "$BACKUP_PATH" != "none" ]]; then
    echo "[deploy] attempting auto-restore"
    if restore_schema "$BACKUP_PATH"; then
      RESTORE_STATUS="success"
      write_status
      echo "[deploy] restore complete, re-running smoke check"
      if smoke_check; then
        SMOKE_STATUS="success"
        write_status
        echo "[deploy] smoke check passed after restore"
      else
        SMOKE_STATUS="failed"
        RESTORE_STATUS="failed"
        write_status
        echo "[deploy] smoke check failed after restore" >&2
        exit 1
      fi
    else
      RESTORE_STATUS="failed"
      write_status
      echo "[deploy] auto-restore failed" >&2
      exit 1
    fi
  else
    RESTORE_STATUS="skipped_no_backup"
    write_status
    echo "[deploy] no backup available; cannot auto-restore" >&2
    exit 1
  fi
fi

write_status

echo "[deploy] done"
