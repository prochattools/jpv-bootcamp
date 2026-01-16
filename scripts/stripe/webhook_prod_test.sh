#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://jpvbootcamp.com}"
WEBHOOK_PATH="${WEBHOOK_PATH:-/api/webhook/stripe}"
WEBHOOK_URL="${BASE_URL%/}${WEBHOOK_PATH}"

echo "[webhook-prod] Testing endpoint: $WEBHOOK_URL"

get_status() {
  curl -s -o /dev/null -w "%{http_code}" "$@"
}

echo "[webhook-prod] GET should be 405..."
status_get="$(get_status "$WEBHOOK_URL")"
echo "[webhook-prod] GET status: $status_get"

echo "[webhook-prod] POST without signature should be 400..."
status_post="$(get_status -X POST -H "Content-Type: application/json" --data '{"x":1}' "$WEBHOOK_URL")"
echo "[webhook-prod] POST status: $status_post"

if [[ -n "${PROD_STRIPE_WEBHOOK_SECRET:-}" ]]; then
  echo "[webhook-prod] Sending signed test payload..."
  export APP_PUBLIC_URL="$BASE_URL"
  export STRIPE_WEBHOOK_SECRET="$PROD_STRIPE_WEBHOOK_SECRET"
  if [[ -n "${PROD_STRIPE_SECRET_KEY:-}" ]]; then
    export STRIPE_SECRET_KEY="$PROD_STRIPE_SECRET_KEY"
  fi
  if [[ -z "${STRIPE_SECRET_KEY:-}" ]]; then
    echo "[webhook-prod] STRIPE_SECRET_KEY missing; set PROD_STRIPE_SECRET_KEY or STRIPE_SECRET_KEY."
    exit 1
  fi
  WEBHOOK_PATH="$WEBHOOK_PATH" node scripts/dev/webhook-smoke.js
else
  echo "[webhook-prod] PROD_STRIPE_WEBHOOK_SECRET not set; skipping signed test."
fi
