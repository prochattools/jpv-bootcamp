#!/usr/bin/env bash
set -euo pipefail

# JPV Bootcamp Stripe Membership Setup Script
# This script sets up and verifies the JPV Bootcamp Membership product in Stripe test mode

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Load environment variables
if [[ ! -f "${PROJECT_ROOT}/.env" ]]; then
  echo "❌ ERROR: .env file not found at ${PROJECT_ROOT}/.env"
  echo "Please create .env with Stripe test mode credentials"
  exit 1
fi

# Source .env but don't fail on unset variables
set +u
source "${PROJECT_ROOT}/.env" || true
set -u

# Validate required environment variables
if [[ -z "${STRIPE_SECRET_KEY:-}" ]]; then
  echo "❌ ERROR: STRIPE_SECRET_KEY not set in .env"
  exit 1
fi

if [[ ! "${STRIPE_SECRET_KEY}" =~ ^sk_test_ ]]; then
  echo "❌ ERROR: STRIPE_SECRET_KEY must start with 'sk_test_' (test mode only)"
  echo "Current key prefix: ${STRIPE_SECRET_KEY:0:8}"
  exit 1
fi

if [[ -z "${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:-}" ]]; then
  echo "❌ ERROR: NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY not set in .env"
  exit 1
fi

if [[ -z "${STRIPE_WEBHOOK_SECRET:-}" ]]; then
  echo "❌ ERROR: STRIPE_WEBHOOK_SECRET not set in .env"
  exit 1
fi

# Run setup
echo "🚀 Starting JPV Bootcamp Stripe Membership Setup..."
echo

npx tsx "${SCRIPT_DIR}/setup-jpv-membership.ts"
