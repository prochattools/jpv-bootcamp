#!/usr/bin/env bash
set -euo pipefail

# Staging-only application startup — no other target is permitted.
# Required: DATABASE_URL with exact staging coordinates.
# Application startup only. No other mode is permitted.

REQUIRED_HOST="10.0.2.4"
REQUIRED_PORT="5433"
REQUIRED_DB="jpvbootcamp"
REQUIRED_SCHEMA="jpvbootcamp_staging"

PORT="${PORT:-3000}"
export PORT

if [ -z "${DATABASE_URL:-}" ]; then
  echo "FATAL: DATABASE_URL is required" >&2
  echo "  Required: host=$REQUIRED_HOST port=$REQUIRED_PORT db=$REQUIRED_DB schema=$REQUIRED_SCHEMA" >&2
  exit 1
fi

if ! echo "$DATABASE_URL" | grep -q "schema=${REQUIRED_SCHEMA}"; then
  echo "FATAL: DATABASE_URL must use schema=${REQUIRED_SCHEMA}" >&2
  exit 1
fi

if ! echo "$DATABASE_URL" | grep -q "${REQUIRED_HOST}"; then
  echo "FATAL: DATABASE_URL must target host ${REQUIRED_HOST}" >&2
  exit 1
fi

if ! echo "$DATABASE_URL" | grep -q ":${REQUIRED_PORT}/"; then
  echo "FATAL: DATABASE_URL must target port ${REQUIRED_PORT}" >&2
  exit 1
fi

if ! echo "$DATABASE_URL" | grep -q "/${REQUIRED_DB}?"; then
  echo "FATAL: DATABASE_URL must target database ${REQUIRED_DB}" >&2
  exit 1
fi

echo "[start] boot at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "[start] staging application startup (no other mode permitted)"
echo "[start] target: ${REQUIRED_HOST}:${REQUIRED_PORT}/${REQUIRED_DB}?schema=${REQUIRED_SCHEMA}"

PAYLOAD_SCHEMA_PREFLIGHT="${PAYLOAD_SCHEMA_PREFLIGHT:-true}"
if [ "$PAYLOAD_SCHEMA_PREFLIGHT" = "true" ]; then
  echo "[start] checking Payload migration state before application startup"
  node scripts/runtime/payload-migration-preflight.cjs
fi

echo "[start] starting standalone Next.js server"
exec node server.js
