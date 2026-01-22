#!/usr/bin/env bash
set -euo pipefail

echo "[webhook-checks] Diagnostics"
node scripts/stripe/print_webhook_diagnostics.js

echo
echo "[webhook-checks] Local webhook test"
scripts/stripe/webhook_local_test.sh

if [[ "${RUN_PROD:-0}" == "1" ]]; then
  echo
  echo "[webhook-checks] Live webhook test"
  scripts/stripe/webhook_live_test.sh
else
  echo
  echo "[webhook-checks] Live test skipped (set RUN_PROD=1 to enable)."
fi
