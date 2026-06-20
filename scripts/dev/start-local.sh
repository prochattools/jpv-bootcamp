#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LOG_FILE="${JPV_BOOTCAMP_LOG_FILE:-/tmp/jpv-bootcamp.log}"

cd "$REPO_ROOT"
npm run dev > "$LOG_FILE" 2>&1 &
echo $! > /tmp/jpv-bootcamp.pid
