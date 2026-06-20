#!/usr/bin/env bash
set -euo pipefail

APP_PORT="${PORT:-3000}"
PID_FILE="/tmp/jpv-bootcamp.pid"

if [[ -f "${PID_FILE}" ]]; then
  PID="$(cat "${PID_FILE}" || true)"
  if [[ -n "${PID}" ]] && kill -0 "${PID}" >/dev/null 2>&1; then
    kill "${PID}" >/dev/null 2>&1 || true
    sleep 2
  fi
  rm -f "${PID_FILE}"
fi

PIDS="$(lsof -ti tcp:"${APP_PORT}" 2>/dev/null || true)"
if [[ -n "${PIDS}" ]]; then
  kill ${PIDS} >/dev/null 2>&1 || true
  sleep 2
fi

PIDS="$(lsof -ti tcp:"${APP_PORT}" 2>/dev/null || true)"
if [[ -n "${PIDS}" ]]; then
  kill -9 ${PIDS} >/dev/null 2>&1 || true
fi

echo "JPV Bootcamp stopped on port ${APP_PORT}"
