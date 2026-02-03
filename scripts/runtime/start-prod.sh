#!/usr/bin/env bash
set -euo pipefail

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

PORT="${PORT:-3000}"
export PORT

if [[ ! -d "$BACKUP_ROOT" ]]; then
  echo "backup root missing: $BACKUP_ROOT" >&2
  echo "Dokploy UI: App -> General -> Volumes/Mounts -> Bind Mount -> Host Path + Mount Path" >&2
  echo "Add bind mount: host /var/backups/pgdump -> container /var/backups/pgdump (RW)" >&2
  exit 1
fi

if ! awk -v p="$BACKUP_ROOT" '$5==p {found=1} END {exit !found}' /proc/self/mountinfo; then
  echo "bind mount missing for $BACKUP_ROOT" >&2
  echo "Dokploy UI: App -> General -> Volumes/Mounts -> Bind Mount -> Host Path + Mount Path" >&2
  echo "Add bind mount: host /var/backups/pgdump -> container /var/backups/pgdump (RW)" >&2
  exit 1
fi

if ! touch "${BACKUP_ROOT}/.write_test" 2>/dev/null; then
  echo "backup root not writable: $BACKUP_ROOT" >&2
  echo "Dokploy UI: App -> General -> Volumes/Mounts -> Bind Mount -> Host Path + Mount Path" >&2
  echo "Add bind mount: host /var/backups/pgdump -> container /var/backups/pgdump (RW)" >&2
  exit 1
fi
rm -f "${BACKUP_ROOT}/.write_test"

./scripts/db/deploy-prod.sh

script_exists() {
  node -e "const pkg=require('./package.json');process.exit(pkg.scripts&&pkg.scripts['$1']?0:1)" >/dev/null 2>&1
}

if script_exists start:app; then
  exec npm run start:app
fi

if script_exists start:prod; then
  exec npm run start:prod
fi

if script_exists start:production; then
  exec npm run start:production
fi

if [[ -d .next && -f .next/BUILD_ID && -x node_modules/.bin/next ]]; then
  exec node_modules/.bin/next start -p "$PORT"
fi

echo "no production start command found" >&2
echo "Define scripts.start:app (preferred) or scripts.start:prod in package.json." >&2
exit 1
