#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${APP_SLUG:-}" ]]; then
  echo "APP_SLUG is required." >&2
  exit 1
fi

if [[ -z "${TENANT_DB_PASSWORD:-}" ]]; then
  echo "TENANT_DB_PASSWORD not set; db:init will generate a new tenant password." >&2
fi

if [[ -z "${SYSTEM_DATABASE_URL:-}" ]]; then
  echo "SYSTEM_DATABASE_URL is required." >&2
  exit 1
fi

node scripts/db/init-tenant.js --slug "${APP_SLUG}"

if [[ -z "${DATABASE_URL:-}" && -f ".env.production" ]]; then
  exported_database_url="$(sed -n 's/^DATABASE_URL=//p' .env.production | tail -n 1)"
  if [[ -n "${exported_database_url:-}" ]]; then
    export DATABASE_URL="${exported_database_url}"
  fi

  if [[ -z "${TENANT_DB_PASSWORD:-}" ]]; then
    exported_password="$(sed -n 's/^TENANT_DB_PASSWORD=//p' .env.production | tail -n 1)"
    if [[ -n "${exported_password:-}" ]]; then
      export TENANT_DB_PASSWORD="${exported_password}"
    fi
  fi
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  if [[ -z "${TENANT_DB_PASSWORD:-}" ]]; then
    echo "DATABASE_URL or TENANT_DB_PASSWORD is required to run migrations." >&2
    exit 1
  fi

  derived_database_url="$(node -e "const { URL } = require('url'); const u = new URL(process.env.SYSTEM_DATABASE_URL); const schema = process.env.APP_SLUG; const user = schema + '_user'; const port = u.port || '5433'; const dbName = u.pathname.replace(/^\\//, '') || 'postgres'; process.stdout.write('postgresql://' + user + ':' + process.env.TENANT_DB_PASSWORD + '@' + u.hostname + ':' + port + '/' + dbName + '?schema=' + schema);")"
  export DATABASE_URL="${derived_database_url}"
fi

NODE_ENV=production npm run db:migrate:prod
