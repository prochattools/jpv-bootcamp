#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://jpvbootcamp.com}"
WEBHOOK_PATH="${WEBHOOK_PATH:-/api/webhook/stripe}"
WEBHOOK_URL="${BASE_URL%/}${WEBHOOK_PATH}"

echo "[webhook-live] Testing endpoint: $WEBHOOK_URL"

get_status() {
  curl -s -o /dev/null -w "%{http_code}" "$@"
}

echo "[webhook-live] GET should be 405..."
status_get="$(get_status "$WEBHOOK_URL")"
echo "[webhook-live] GET status: $status_get"

echo "[webhook-live] POST without signature should be 400..."
status_post="$(get_status -X POST -H "Content-Type: application/json" --data '{"x":1}' "$WEBHOOK_URL")"
echo "[webhook-live] POST status: $status_post"

if [[ -n "${STRIPE_WEBHOOK_SECRET_LIVE:-}" ]]; then
  echo "[webhook-live] Sending signed test payload..."
  export STRIPE_ENV="live"
  export APP_PUBLIC_URL="$BASE_URL"
  export STRIPE_WEBHOOK_SECRET_LIVE="$STRIPE_WEBHOOK_SECRET_LIVE"
  if [[ -n "${STRIPE_SECRET_KEY_LIVE:-}" ]]; then
    export STRIPE_SECRET_KEY_LIVE="$STRIPE_SECRET_KEY_LIVE"
  fi
  if [[ -z "${STRIPE_SECRET_KEY_LIVE:-}" ]]; then
    echo "[webhook-live] STRIPE_SECRET_KEY_LIVE missing; set STRIPE_SECRET_KEY_LIVE."
    exit 1
  fi
  WEBHOOK_PATH="$WEBHOOK_PATH" node scripts/dev/webhook-smoke.js
else
  echo "[webhook-live] STRIPE_WEBHOOK_SECRET_LIVE not set; skipping signed test."
fi
