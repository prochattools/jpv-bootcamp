# Stripe Webhooks (JPV Bootcamp Stripe Account, Local Testing)

> Stripe note: In this repo, every Stripe reference means the JPV Bootcamp Stripe account.

## Prereqs
- Stripe CLI installed and authenticated (`stripe login`)
- Local env vars set (see `.env.example`)

## Run the webhook listener
```bash
stripe listen --forward-to localhost:3000/api/webhook/stripe
```

Copy the webhook secret value into `STRIPE_WEBHOOK_SECRET_TEST` (or `_LIVE`) and set `STRIPE_ENV`.

## Trigger test events
```bash
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted
stripe trigger invoice.payment_failed
```

## Required env vars (minimum)
- `APP_PUBLIC_URL` (or `NEXT_PUBLIC_APP_URL`)
- `STRIPE_ENV`
- `STRIPE_SECRET_KEY_TEST` / `STRIPE_SECRET_KEY_LIVE`
- `STRIPE_WEBHOOK_SECRET_TEST` / `STRIPE_WEBHOOK_SECRET_LIVE` (comma-separated allowed for rotation)
- `STRIPE_PRICE_PRO_TEST` / `STRIPE_PRICE_PRO_LIVE`
- `STRIPE_PRICE_VIP_TEST` / `STRIPE_PRICE_VIP_LIVE`
- `WEBHOOK_IDEMPOTENCY_TTL_HOURS`

## Provisioning env vars (required to provision in production)
- `PROVISIONING_ENABLED=true` (default false)
- `WP_BASE_URL`
- `WP_PROVISION_ENDPOINT`
- `WP_PROVISION_TOKEN`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `EMAIL_REPLY_TO`
- `SUPPORT_TO_EMAIL`
- `PORTAL_URL` (or `PORTAL_LOGIN_URL`)

Note: In development, missing provisioning env vars will skip WordPress provisioning but still return 2xx to Stripe after idempotency is recorded.

Recommendation: keep only one webhook destination per mode. During secret rotation,
you can provide multiple secrets in the same `STRIPE_WEBHOOK_SECRET_TEST`/`_LIVE` value.

Verification uses raw bytes via `arrayBuffer()`. If intermittent signature failures occur,
suspect multiple running containers with mismatched webhook secret values—deploy
to a single replica or ensure all instances share the same secret(s).
