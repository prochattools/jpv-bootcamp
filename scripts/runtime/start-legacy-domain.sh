#!/usr/bin/env bash
set -euo pipefail

# Legacy-domain application-only startup.
# Domain relocation must not run migrations or alter the legacy database.

REQUIRED_ORIGIN="https://legacy.jpvbootcamp.com"

if [[ "${DEPLOYMENT_ENV:-}" != "production" ]]; then
  echo "FATAL: DEPLOYMENT_ENV must be exactly production" >&2
  exit 1
fi

for variable_name in APP_BASE_URL NEXT_PUBLIC_APP_URL NEXT_PUBLIC_SERVER_URL; do
  variable_value="${!variable_name:-}"
  if [[ "$variable_value" != "$REQUIRED_ORIGIN" ]]; then
    echo "FATAL: $variable_name must be exactly $REQUIRED_ORIGIN" >&2
    exit 1
  fi
done

if [[ "${NEXT_PUBLIC_APP_DOMAIN:-}" != "legacy.jpvbootcamp.com" ]]; then
  echo "FATAL: NEXT_PUBLIC_APP_DOMAIN must be legacy.jpvbootcamp.com" >&2
  exit 1
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "FATAL: DATABASE_URL is required" >&2
  exit 1
fi

echo "[start] legacy-domain application startup"
echo "[start] database migrations are not run by this relocation image"
echo "[start] starting standalone Next.js server"
exec node server.js
