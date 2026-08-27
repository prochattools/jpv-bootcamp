#!/usr/bin/env bash
set -euo pipefail

# One-off production Prisma migration runner. It is invoked only by the
# guarded Dokploy job after the root production image serves the expected SHA.

REQUIRED_HOST="${PRODUCTION_DATABASE_HOST:-}"
REQUIRED_PORT="${PRODUCTION_DATABASE_PORT:-}"
REQUIRED_DB="${PRODUCTION_DATABASE_NAME:-}"
REQUIRED_SCHEMA="${PRODUCTION_DATABASE_SCHEMA:-}"

if [[ "${DEPLOYMENT_ENV:-}" != "production" ]]; then
	echo "JPV_PRISMA_MIGRATION_FAILED DEPLOYMENT_ENV must be exactly production" >&2
	exit 1
fi

if [[ -z "$REQUIRED_HOST" || -z "$REQUIRED_PORT" || -z "$REQUIRED_DB" || -z "$REQUIRED_SCHEMA" || -z "${DATABASE_URL:-}" ]]; then
	echo "JPV_PRISMA_MIGRATION_FAILED production database boundary variables are required" >&2
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
  process.stderr.write('JPV_PRISMA_MIGRATION_FAILED DATABASE_URL is not a valid URL\n')
  process.exit(1)
}
if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
  process.stderr.write('JPV_PRISMA_MIGRATION_FAILED DATABASE_URL protocol is invalid\n')
  process.exit(1)
}
if (parsed.hostname !== required.host || (parsed.port || '5432') !== required.port) {
  process.stderr.write('JPV_PRISMA_MIGRATION_FAILED DATABASE_URL host or port does not match the production boundary\n')
  process.exit(1)
}
if (parsed.pathname.replace(/^\//, '') !== required.database) {
  process.stderr.write('JPV_PRISMA_MIGRATION_FAILED DATABASE_URL database does not match the production boundary\n')
  process.exit(1)
}
const schemas = parsed.searchParams.getAll('schema')
if (schemas.length !== 1 || schemas[0] !== required.schema) {
  process.stderr.write('JPV_PRISMA_MIGRATION_FAILED DATABASE_URL schema does not match the production boundary\n')
  process.exit(1)
}
VALIDATE_EOF

echo "[migration] production database boundary validated"
if prisma migrate deploy --schema=prisma/system.prisma; then
	echo "JPV_PRISMA_MIGRATION_APPLIED Prisma migrations applied successfully"
else
	echo "JPV_PRISMA_MIGRATION_FAILED Prisma migration command failed" >&2
	exit 1
fi
