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
npx prisma migrate deploy --schema=prisma/system.prisma
