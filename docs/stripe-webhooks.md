# Stripe Webhooks (Local Testing)

## Prereqs
- Stripe CLI installed and authenticated (`stripe login`)
- Local env vars set (see `.env.example`)

## Run the webhook listener
```bash
stripe listen --forward-to localhost:3000/api/webhook/stripe
```

Copy the `whsec_...` value into `STRIPE_WEBHOOK_SECRET`.

## Trigger test events
```bash
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted
stripe trigger invoice.payment_failed
```

## Required env vars (minimum)
- `APP_PUBLIC_URL` (or `NEXT_PUBLIC_APP_URL`)
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_PRO` (or `NEXT_PUBLIC_STRIPE_PRICE_PRO`)
- `STRIPE_PRICE_VIP` (or `NEXT_PUBLIC_STRIPE_PRICE_VIP`)
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
