#!/usr/bin/env bash
set -euo pipefail

# Staging-only execution boundary
if [ -z "${DATABASE_URL:-}" ]; then
  echo "FATAL: DATABASE_URL is required (staging-only: schema must be jpvbootcamp_staging)" >&2
  exit 1
fi
if ! echo "$DATABASE_URL" | grep -q 'schema=jpvbootcamp_staging'; then
  echo "FATAL: DATABASE_URL must use schema=jpvbootcamp_staging (production schema rejected)" >&2
  exit 1
fi

BACKUP_ROOT="/var/backups/pgdump"
STARTUP_MODE="${STARTUP_MODE:-application-only}"
PAYLOAD_SCHEMA_PREFLIGHT="${PAYLOAD_SCHEMA_PREFLIGHT:-true}"
PORT="${PORT:-3000}"
export PORT

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "missing required env var: $name" >&2
    exit 1
  fi
}

require_cmd() {
  local name="$1"
  if ! command -v "$name" >/dev/null 2>&1; then
    echo "missing required command: $name" >&2
    echo "Install matching PostgreSQL client tools before database-deploy startup." >&2
    exit 1
  fi
}

prepare_database_deploy() {
  require_env DEPLOYMENT_ENV
  case "$DEPLOYMENT_ENV" in
    preview|staging|production)
      ;;
    *)
      echo "invalid DEPLOYMENT_ENV; expected preview, staging, or production" >&2
      exit 1
      ;;
  esac

  require_env APP_SLUG
  require_env SYSTEM_DATABASE_URL
  require_env DATABASE_URL
  require_env NODE_ENV

  require_cmd psql
  require_cmd pg_dump
  require_cmd pg_restore

  echo "[start] database-deploy mode selected for $DEPLOYMENT_ENV"
  echo "[start] checking backup root"
  if [[ ! -d "$BACKUP_ROOT" ]]; then
    echo "[start] WARNING: backup root missing; deploy-prod.sh will enforce its own backup requirements"
  elif ! awk -v p="$BACKUP_ROOT" '$5==p {found=1} END {exit !found}' /proc/self/mountinfo; then
    echo "[start] WARNING: backup bind mount is not detected"
  elif ! touch "${BACKUP_ROOT}/.write_test" 2>/dev/null; then
    echo "[start] WARNING: backup root is not writable"
  else
    rm -f "${BACKUP_ROOT}/.write_test"
    echo "[start] backup root is ready"
  fi

  echo "[start] running reviewed database deployment"
  ./scripts/db/deploy-prod.sh
  echo "[start] reviewed database deployment completed"
}

echo "[start] boot at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "[start] startup mode: $STARTUP_MODE"

case "$STARTUP_MODE" in
  application-only)
    echo "[start] application-only mode: schema initialization and migrations are skipped"
    if [[ "$PAYLOAD_SCHEMA_PREFLIGHT" == "true" ]]; then
      require_env DATABASE_URL
      echo "[start] checking Payload migration state before application startup"
      node scripts/runtime/payload-migration-preflight.cjs
    fi
    ;;
  database-deploy)
    prepare_database_deploy
    ;;
  *)
    echo "invalid STARTUP_MODE; expected application-only or database-deploy" >&2
    exit 1
    ;;
esac

echo "[start] starting standalone Next.js server"
exec node server.js
