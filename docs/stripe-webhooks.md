# Stripe Webhooks (Local Testing)

## Prereqs
- Stripe CLI installed and authenticated (`stripe login`)
- Local env vars set (see `.env.example`)

## Run the webhook listener
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
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
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_STRIPE_PRICE_PRO`
- `NEXT_PUBLIC_STRIPE_PRICE_VIP`
- `STRIPE_SUCCESS_URL`
- `STRIPE_CANCEL_URL`
- `WP_BASE_URL`
- `WP_ADMIN_USERNAME`
- `WP_APPLICATION_PASSWORD`
- `WP_ROLE_PRO`
- `WP_ROLE_VIP`
- `WP_ROLE_DEFAULT`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `EMAIL_REPLY_TO`
- `PORTAL_LOGIN_URL`
- `PORTAL_SET_PASSWORD_URL`
- `WEBHOOK_IDEMPOTENCY_TTL_HOURS`
