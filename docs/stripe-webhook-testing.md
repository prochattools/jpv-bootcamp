# Stripe Webhook Testing

This guide documents how to verify Stripe webhook signature handling end-to-end.

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
- `STRIPE_SECRET_KEY`
- `APP_PUBLIC_URL` (or `NEXT_PUBLIC_APP_URL`)

To enable provisioning, also set:
- `PROVISIONING_ENABLED=true`
- `WP_BASE_URL`, `WP_PROVISION_ENDPOINT`, `WP_PROVISION_TOKEN`

### Production smoke test
```bash
scripts/stripe/webhook_prod_test.sh
```

Optional signed test (requires live destination secret):
```bash
PROD_STRIPE_WEBHOOK_SECRET=whsec_live_... \
PROD_STRIPE_SECRET_KEY=sk_live_... \
scripts/stripe/webhook_prod_test.sh
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
