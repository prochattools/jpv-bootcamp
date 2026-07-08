#!/usr/bin/env bash
set -euo pipefail

load_env_file() {
  local file="$1"
  [[ -f "$file" ]] || return 0
  while IFS= read -r line || [[ -n "$line" ]]; do
    local trimmed="${line#"${line%%[![:space:]]*}"}"
    [[ -z "$trimmed" || "$trimmed" == \#* ]] && continue
    local key="${trimmed%%=*}"
    local value="${trimmed#*=}"
    value="${value%\"}"
    value="${value#\"}"
    if [[ -z "${!key:-}" ]]; then
      export "${key}=${value}"
    fi
  done < "$file"
  return 0
}

load_env_file ".env"
load_env_file ".env.local"

find_free_port() {
  local port="${1:-3000}"
  if command -v lsof >/dev/null 2>&1; then
    while lsof -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; do
      port=$((port + 1))
    done
  else
    while nc -z localhost "$port" >/dev/null 2>&1; do
      port=$((port + 1))
    done
  fi
  echo "$port"
}

if [[ -z "${BASE_URL:-}" ]]; then
  port="$(find_free_port "${PORT:-3000}")"
  BASE_URL="http://localhost:${port}"
  export PORT="$port"
fi
WEBHOOK_PATH="${WEBHOOK_PATH:-/api/webhook/stripe}"
DEBUG_STRIPE_WEBHOOKS="${DEBUG_STRIPE_WEBHOOKS:-1}"
STRIPE_ENV="${STRIPE_ENV:-test}"
SKIP_PREDEV=1

env_suffix="TEST"
if [[ "$STRIPE_ENV" == "live" ]]; then
  env_suffix="LIVE"
fi

secret_key_var="STRIPE_SECRET_KEY_${env_suffix}"
publishable_key_var="NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_${env_suffix}"
plan_pro_var="STRIPE_PRICE_PRO_${env_suffix}"
plan_pro_annual_var="STRIPE_PRICE_PRO_ANNUAL_${env_suffix}"
webhook_secret_var="STRIPE_WEBHOOK_SECRET_${env_suffix}"

secret_key_value="${!secret_key_var:-}"
publishable_key_value="${!publishable_key_var:-}"
plan_pro_value="${!plan_pro_var:-}"
plan_pro_annual_value="${!plan_pro_annual_var:-}"

if [[ -z "$secret_key_value" ]]; then
  echo "[webhook-local] ${secret_key_var} is required (set in env or .env)."
  exit 1
fi
if [[ -z "$publishable_key_value" ]]; then
  echo "[webhook-local] ${publishable_key_var} is required (set in env or .env)."
  exit 1
fi
if [[ -z "$plan_pro_value" ]]; then
  echo "[webhook-local] ${plan_pro_var} is required (set in env or .env)."
  exit 1
fi
if [[ -z "$plan_pro_annual_value" ]]; then
  echo "[webhook-local] ${plan_pro_annual_var} is required (set in env or .env)."
  exit 1
fi

if ! command -v stripe >/dev/null 2>&1; then
  echo "[webhook-local] Stripe CLI not found. Install with: https://stripe.com/docs/stripe-cli"
  exit 1
fi

tmp_dir="$(mktemp -d)"
listen_log="$tmp_dir/stripe-listen.log"
dev_log="$tmp_dir/next-dev.log"
trigger_log="$tmp_dir/stripe-trigger.log"

cleanup() {
  if [[ -n "${dev_pid:-}" ]] && kill -0 "$dev_pid" >/dev/null 2>&1; then
    kill "$dev_pid" >/dev/null 2>&1 || true
  fi
  if [[ -n "${listen_pid:-}" ]] && kill -0 "$listen_pid" >/dev/null 2>&1; then
    kill "$listen_pid" >/dev/null 2>&1 || true
  fi
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

echo "[webhook-local] Starting Stripe listen..."
stripe listen --forward-to "${BASE_URL%/}${WEBHOOK_PATH}" >"$listen_log" 2>&1 &
listen_pid=$!

echo "[webhook-local] Waiting for webhook signing secret..."
secret=""
extract_secret() {
  local prefix="wh""sec_"
  local regex="${prefix}[A-Za-z0-9]+"
  if command -v rg >/dev/null 2>&1; then
    rg -o "$regex" "$listen_log" | tail -n 1
  else
    grep -E -o "$regex" "$listen_log" | tail -n 1
  fi
}

for _ in $(seq 1 30); do
  secret="$(extract_secret || true)"
  if [[ -n "$secret" ]]; then
    break
  fi
  sleep 1
done

if [[ -z "$secret" ]]; then
  echo "[webhook-local] Failed to capture webhook secret from Stripe CLI."
  tail -n 50 "$listen_log" || true
  exit 1
fi

echo "[webhook-local] Captured webhook secret prefix: ${secret:0:6}"

webhook_secret_test_value="${STRIPE_WEBHOOK_SECRET_TEST:-}"
webhook_secret_live_value="${STRIPE_WEBHOOK_SECRET_LIVE:-}"
if [[ "$STRIPE_ENV" == "live" ]]; then
  webhook_secret_live_value="$secret"
else
  webhook_secret_test_value="$secret"
fi

echo "[webhook-local] Starting Next.js dev server..."
SKIP_PREDEV="$SKIP_PREDEV" \
DEBUG_STRIPE_WEBHOOKS="$DEBUG_STRIPE_WEBHOOKS" \
STRIPE_ENV="$STRIPE_ENV" \
STRIPE_SECRET_KEY_TEST="${STRIPE_SECRET_KEY_TEST:-}" \
STRIPE_SECRET_KEY_LIVE="${STRIPE_SECRET_KEY_LIVE:-}" \
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST="${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST:-}" \
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_LIVE="${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_LIVE:-}" \
STRIPE_PRICE_PRO_TEST="${STRIPE_PRICE_PRO_TEST:-}" \
STRIPE_PRICE_PRO_ANNUAL_TEST="${STRIPE_PRICE_PRO_ANNUAL_TEST:-}" \
STRIPE_PRICE_PRO_LIVE="${STRIPE_PRICE_PRO_LIVE:-}" \
STRIPE_PRICE_PRO_ANNUAL_LIVE="${STRIPE_PRICE_PRO_ANNUAL_LIVE:-}" \
STRIPE_WEBHOOK_SECRET_TEST="$webhook_secret_test_value" \
STRIPE_WEBHOOK_SECRET_LIVE="$webhook_secret_live_value" \
APP_PUBLIC_URL="$BASE_URL" \
NEXT_PUBLIC_APP_URL="$BASE_URL" \
npm run dev >"$dev_log" 2>&1 &
dev_pid=$!

echo "[webhook-local] Waiting for dev server readiness..."
ready="false"
for _ in $(seq 1 30); do
  status="$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL%/}${WEBHOOK_PATH}" || true)"
  if [[ "$status" == "405" || "$status" == "400" || "$status" == "200" ]]; then
    ready="true"
    break
  fi
  sleep 1
done

if [[ "$ready" != "true" ]]; then
  echo "[webhook-local] Dev server did not become ready."
  tail -n 80 "$dev_log" || true
  exit 1
fi

if ! grep -i "SKIP_PREDEV=1 set; skipping predev database steps" "$dev_log" >/dev/null 2>&1; then
  echo "[webhook-local] Predev skip marker not found."
  tail -n 80 "$dev_log" || true
  exit 1
fi

echo "[webhook-local] Triggering Stripe test event..."
stripe trigger checkout.session.completed >"$trigger_log" 2>&1

sleep 3

if ! grep -E "\[[2][0-9]{2}\].*${WEBHOOK_PATH}" "$listen_log" >/dev/null 2>&1; then
  echo "[webhook-local] Stripe CLI did not log a 2xx response."
  tail -n 80 "$listen_log" || true
  exit 1
fi

if ! grep -i "Stripe webhook signature verified" "$dev_log" >/dev/null 2>&1; then
  echo "[webhook-local] Signature verification log not found."
  tail -n 120 "$dev_log" || true
  exit 1
fi

if ! grep -i "Stripe webhook received" "$dev_log" >/dev/null 2>&1; then
  echo "[webhook-local] Server did not log 'Stripe webhook received'."
  tail -n 120 "$dev_log" || true
  exit 1
fi

if grep -i "Missing Stripe signature" "$dev_log" >/dev/null 2>&1; then
  echo "[webhook-local] Missing signature error detected."
  tail -n 120 "$dev_log" || true
  exit 1
fi

if grep -i "Invalid Stripe signature" "$dev_log" >/dev/null 2>&1; then
  echo "[webhook-local] Invalid signature error detected."
  tail -n 120 "$dev_log" || true
  exit 1
fi

echo "[webhook-local] Success: webhook verified end-to-end."
