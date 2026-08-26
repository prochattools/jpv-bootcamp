#!/usr/bin/env bash
set -euo pipefail

# Production-only application startup.
#
# This intentionally does not run Payload migrations. It verifies that the
# operator selected production mode, the canonical public origin, and the
# explicitly approved database target before application-only startup.

REQUIRED_PUBLIC_ORIGIN="https://jpvbootcamp.com"
REQUIRED_HOST="${PRODUCTION_DATABASE_HOST:-}"
REQUIRED_PORT="${PRODUCTION_DATABASE_PORT:-}"
REQUIRED_DB="${PRODUCTION_DATABASE_NAME:-}"
REQUIRED_SCHEMA="${PRODUCTION_DATABASE_SCHEMA:-}"

if [[ "${DEPLOYMENT_ENV:-}" != "production" ]]; then
  echo "FATAL: DEPLOYMENT_ENV must be exactly production" >&2
  exit 1
fi

if [[ -z "$REQUIRED_HOST" || -z "$REQUIRED_PORT" || -z "$REQUIRED_DB" || -z "$REQUIRED_SCHEMA" ]]; then
  echo "FATAL: PRODUCTION_DATABASE_HOST/PORT/NAME/SCHEMA are required" >&2
  exit 1
fi

for variable_name in APP_PUBLIC_URL NEXT_PUBLIC_APP_URL NEXT_PUBLIC_SERVER_URL; do
  variable_value="${!variable_name:-}"
  if [[ "$variable_value" != "$REQUIRED_PUBLIC_ORIGIN" ]]; then
    echo "FATAL: $variable_name must be exactly $REQUIRED_PUBLIC_ORIGIN" >&2
    exit 1
  fi
done

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "FATAL: DATABASE_URL is required" >&2
  exit 1
fi

node - <<'VALIDATE_EOF'
const url = process.env.DATABASE_URL
const required = {
  host: process.env.PRODUCTION_DATABASE_HOST,
  port: process.env.PRODUCTION_DATABASE_PORT,
  database: process.env.PRODUCTION_DATABASE_NAME,
  schema: process.env.PRODUCTION_DATABASE_SCHEMA,
}
let parsed
try {
  parsed = new URL(url)
} catch {
  process.stderr.write('FATAL: DATABASE_URL is not a valid URL\n')
  process.exit(1)
}
if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
  process.stderr.write('FATAL: DATABASE_URL must use postgresql:// or postgres:// protocol\n')
  process.exit(1)
}
if (parsed.hostname !== required.host) {
  process.stderr.write('FATAL: DATABASE_URL hostname does not match PRODUCTION_DATABASE_HOST\n')
  process.exit(1)
}
if ((parsed.port || '5432') !== required.port) {
  process.stderr.write('FATAL: DATABASE_URL port does not match PRODUCTION_DATABASE_PORT\n')
  process.exit(1)
}
if (parsed.pathname.replace(/^\//, '') !== required.database) {
  process.stderr.write('FATAL: DATABASE_URL database does not match PRODUCTION_DATABASE_NAME\n')
  process.exit(1)
}
const schemas = parsed.searchParams.getAll('schema')
if (schemas.length !== 1 || schemas[0] !== required.schema) {
  process.stderr.write('FATAL: DATABASE_URL schema does not match PRODUCTION_DATABASE_SCHEMA\n')
  process.exit(1)
}
process.stdout.write('[start] DATABASE_URL structural validation passed\n')
VALIDATE_EOF

echo "[start] boot at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "[start] production application startup"
echo "[start] target: ${REQUIRED_HOST}:${REQUIRED_PORT}/${REQUIRED_DB}?schema=${REQUIRED_SCHEMA}"

PAYLOAD_SCHEMA_PREFLIGHT="${PAYLOAD_SCHEMA_PREFLIGHT:-true}"
if [[ "$PAYLOAD_SCHEMA_PREFLIGHT" == "true" ]]; then
  echo "[start] checking Payload migration state before application startup"
  PAYLOAD_MIGRATION_SCHEMA="$REQUIRED_SCHEMA" node scripts/release/payload-migration-preflight.cjs
fi

echo "[start] starting standalone Next.js server"
exec node server.js
