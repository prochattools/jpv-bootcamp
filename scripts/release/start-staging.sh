#!/usr/bin/env bash
set -euo pipefail

# Staging-only application startup.
# Application startup only. No other mode is permitted.
#
# Validates DATABASE_URL structurally: PostgreSQL protocol, exact host, port,
# database, and schema are all required. Substring matching is insufficient —
# this validator requires a structurally parseable URL with each field verified
# by position, not by substring search.

REQUIRED_HOST="10.0.2.4"
REQUIRED_PORT="5433"
REQUIRED_DB="jpvbootcamp_staging"
REQUIRED_SCHEMA="jpvbootcamp"

PORT="${PORT:-3000}"
export PORT

if [ -z "${DATABASE_URL:-}" ]; then
  echo "FATAL: DATABASE_URL is required" >&2
  echo "  Required: postgresql://<user>:<pass>@${REQUIRED_HOST}:${REQUIRED_PORT}/${REQUIRED_DB}?schema=${REQUIRED_SCHEMA}" >&2
  exit 1
fi

# Structural URL validation via Node.js — no grep/substring tricks
node - <<'VALIDATE_EOF'
const url = process.env.DATABASE_URL
const REQUIRED = {
  host: '10.0.2.4',
  port: '5433',
  database: 'jpvbootcamp_staging',
  schema: 'jpvbootcamp',
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
if (parsed.hostname !== REQUIRED.host) {
  process.stderr.write('FATAL: DATABASE_URL hostname must be ' + REQUIRED.host + '\n')
  process.exit(1)
}
const port = parsed.port || '5432'
if (port !== REQUIRED.port) {
  process.stderr.write('FATAL: DATABASE_URL port must be ' + REQUIRED.port + '\n')
  process.exit(1)
}
const database = parsed.pathname.replace(/^\//, '')
if (database !== REQUIRED.database) {
  process.stderr.write('FATAL: DATABASE_URL database must be ' + REQUIRED.database + '\n')
  process.exit(1)
}
const schemaParams = parsed.searchParams.getAll('schema')
if (schemaParams.length !== 1) {
  process.stderr.write('FATAL: DATABASE_URL must contain exactly one schema parameter\n')
  process.exit(1)
}
if (schemaParams[0] !== REQUIRED.schema) {
  process.stderr.write('FATAL: DATABASE_URL schema must be ' + REQUIRED.schema + '\n')
  process.exit(1)
}
process.stdout.write('[start] DATABASE_URL structural validation passed\n')
VALIDATE_EOF

echo "[start] boot at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "[start] staging application startup (no other mode permitted)"
echo "[start] target: ${REQUIRED_HOST}:${REQUIRED_PORT}/${REQUIRED_DB}?schema=${REQUIRED_SCHEMA}"

PAYLOAD_SCHEMA_PREFLIGHT="${PAYLOAD_SCHEMA_PREFLIGHT:-true}"
if [ "$PAYLOAD_SCHEMA_PREFLIGHT" = "true" ]; then
  echo "[start] checking Payload migration state before application startup"
  node scripts/release/payload-migration-preflight.cjs
fi

echo "[start] starting standalone Next.js server"
exec node server.js
