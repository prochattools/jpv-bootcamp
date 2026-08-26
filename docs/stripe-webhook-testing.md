# Stripe Webhook Testing (JPV Bootcamp Stripe Account)

This guide documents how to verify Stripe webhook signature handling end-to-end.

> Stripe note: In this repo, every Stripe reference means the JPV Bootcamp Stripe account.

## Primary endpoint

- Primary: `/api/webhook/stripe`

## Debug mode

Set `DEBUG_STRIPE_WEBHOOKS=1` to include safe diagnostics in 400 responses and logs:
- Signature header presence + prefix
- Raw body length
- Method + path
- `NODE_ENV`
- Webhook secret prefix

## SKIP_PREDEV

Set `SKIP_PREDEV=1` to skip tenant provisioning and Prisma migrations when running `npm run dev`.
This allows webhook verification to run without a database.

## Scripts

### Diagnostics
```bash
node scripts/stripe/print_webhook_diagnostics.js
PING_WEBHOOK=1 node scripts/stripe/print_webhook_diagnostics.js
```

### Local end-to-end test (Stripe CLI + Next dev)
```bash
scripts/stripe/webhook_local_test.sh
```

Required env vars for local test:
- `STRIPE_ENV`
- `STRIPE_SECRET_KEY_TEST` / `STRIPE_SECRET_KEY_LIVE`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST` / `_LIVE`
- `STRIPE_PRICE_PRO_MONTHLY_TEST` / `_LIVE`
- `STRIPE_PRICE_PRO_ANNUAL_TEST` / `_LIVE`
- `STRIPE_WEBHOOK_SECRET_TEST` / `_LIVE`
- `APP_PUBLIC_URL` (or `NEXT_PUBLIC_APP_URL`)

Removed paid-tier price variables are not required for the target Free/Pro webhook test setup.

To enable membership emails, also set Resend sender and support mailbox env vars.

Recommendation: keep one webhook destination per mode. If you need rotation,
set multiple secrets in `STRIPE_WEBHOOK_SECRET_TEST` or `STRIPE_WEBHOOK_SECRET_LIVE`.

### Live smoke test
```bash
scripts/stripe/webhook_live_test.sh
```

Optional signed test (requires live destination secret):
```bash
STRIPE_WEBHOOK_SECRET_LIVE=webhookSecretValue \
STRIPE_SECRET_KEY_LIVE=sk_livekey \
scripts/stripe/webhook_live_test.sh
```

### Run everything
```bash
scripts/stripe/run_all_webhook_checks.sh
RUN_PROD=1 scripts/stripe/run_all_webhook_checks.sh
```

## Stripe CLI (manual)
```bash
stripe listen --forward-to http://localhost:3000/api/webhook/stripe
stripe trigger checkout.session.completed
```

## Expected outcomes
- GET `/api/webhook/stripe` returns `405`.
- POST without `Stripe-Signature` returns `400`.
- Valid signed events return `2xx` and log `Stripe webhook received`.
