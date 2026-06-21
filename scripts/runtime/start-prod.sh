#!/usr/bin/env bash
set -euo pipefail

echo "[start] boot at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "[start] NODE_PATH=${NODE_PATH:-unset}"
echo "[start] APP_SLUG=${APP_SLUG:-unset}"
echo "[start] NODE_ENV=${NODE_ENV:-unset}"

BACKUP_ROOT="/var/backups/pgdump"

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "missing required env var: $name" >&2
    exit 1
  fi
}

require_env APP_SLUG
require_env SYSTEM_DATABASE_URL
require_env DATABASE_URL
require_env NODE_ENV

require_cmd() {
  local name="$1"
  if ! command -v "$name" >/dev/null 2>&1; then
    echo "missing required command: $name" >&2
    echo "Install Postgres client tools (e.g. nixpacks.toml with postgresql_15)." >&2
    exit 1
  fi
}

require_cmd psql
require_cmd pg_dump
require_cmd pg_restore

PORT="${PORT:-3000}"
export PORT

echo "[start] checking backup root: $BACKUP_ROOT"
if [[ ! -d "$BACKUP_ROOT" ]]; then
  echo "[start] ERROR: backup root missing: $BACKUP_ROOT" >&2
  echo "Dokploy UI: App -> General -> Volumes/Mounts -> Bind Mount -> Host Path + Mount Path" >&2
  echo "Add bind mount: host /var/backups/pgdump -> container /var/backups/pgdump (RW)" >&2
  exit 1
fi

if ! awk -v p="$BACKUP_ROOT" '$5==p {found=1} END {exit !found}' /proc/self/mountinfo; then
  echo "[start] ERROR: bind mount missing for $BACKUP_ROOT" >&2
  echo "Dokploy UI: App -> General -> Volumes/Mounts -> Bind Mount -> Host Path + Mount Path" >&2
  echo "Add bind mount: host /var/backups/pgdump -> container /var/backups/pgdump (RW)" >&2
  exit 1
fi

if ! touch "${BACKUP_ROOT}/.write_test" 2>/dev/null; then
  echo "[start] ERROR: backup root not writable: $BACKUP_ROOT" >&2
  echo "Dokploy UI: App -> General -> Volumes/Mounts -> Bind Mount -> Host Path + Mount Path" >&2
  echo "Add bind mount: host /var/backups/pgdump -> container /var/backups/pgdump (RW)" >&2
  exit 1
fi
rm -f "${BACKUP_ROOT}/.write_test"

echo "[start] running deploy-prod.sh"
./scripts/db/deploy-prod.sh
echo "[start] deploy-prod.sh completed"

script_exists() {
  node -e "const pkg=require('./package.json');process.exit(pkg.scripts&&pkg.scripts['$1']?0:1)" >/dev/null 2>&1
}

echo "[start] starting node server.js"
exec node server.js
