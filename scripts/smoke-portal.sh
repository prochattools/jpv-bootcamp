#!/usr/bin/env bash
set -euo pipefail

BASE_URL=${BASE_URL:-https://portal.jpvbootcamp.com}
WP_COOKIE=${WP_COOKIE:-}
NGINX_VHOST_PATH=${NGINX_VHOST_PATH:-}

echo "== Portal Smoke Test =="
echo "Base URL: ${BASE_URL}"

cat <<'SNIP'
Expected nginx try_files for portal host:
  try_files $uri $uri/ /index.php?$args;
SNIP

if [[ -n "${NGINX_VHOST_PATH}" && -r "${NGINX_VHOST_PATH}" ]]; then
  echo "\nDetected nginx vhost config (${NGINX_VHOST_PATH}):"
  rg -n "try_files" "${NGINX_VHOST_PATH}" || true
  rg -n "location /go" "${NGINX_VHOST_PATH}" || true
else
  echo "\nSet NGINX_VHOST_PATH to a readable nginx vhost file to inspect try_files." 
fi

cookie_header=()
if [[ -n "${WP_COOKIE}" ]]; then
  cookie_header=( -H "Cookie: ${WP_COOKIE}" )
  echo "\nUsing WP_COOKIE for logged-in checks."
fi

request() {
  local path="$1"
  local label="$2"
  local url="${BASE_URL}${path}"
  echo "\n-- ${label}: ${url}"
  curl -s -I "${url}?cb=$(date +%s)" "${cookie_header[@]}" | sed -n '1,20p'
}

request "/go/billing-portal" "Billing portal"
request "/go/upgrade-vip" "Upgrade VIP"
request "/" "Root lock"

echo "\nIf /go/upgrade-vip returns 404 without X-JPV headers, fix nginx try_files so /go/* routes reach index.php."
