# Stripe → WordPress Provisioning

This document describes the paid subscription provisioning flow and how to test it locally.

## Overview

1) The checkout page calls `/api/stripe/checkout?plan=pro|vip`.
2) Stripe fires `checkout.session.completed` after payment.
3) The webhook (`/api/webhook/stripe`) verifies the signature, de-dupes the event, and provisions the WordPress user.
4) The app stores the Stripe ↔ WordPress mapping and sends a welcome email with a reset link.

## Environment variables

```dotenv
# App
APP_PUBLIC_URL=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_PRO=
STRIPE_PRICE_VIP=
STRIPE_SUCCESS_URL=https://jpvbootcamp.com/thank-you?session_id={CHECKOUT_SESSION_ID}
STRIPE_CANCEL_URL=https://jpvbootcamp.com/

# WordPress provisioning
PROVISIONING_ENABLED=true
WP_BASE_URL=https://portal.jpvbootcamp.com
WP_PROVISION_ENDPOINT=/wp-json/jpv/v1/provision
WP_PROVISION_TOKEN=

# Email (Resend)
RESEND_API_KEY=
RESEND_FROM=support@jpvbootcamp.com
EMAIL_FROM=support@jpvbootcamp.com
EMAIL_REPLY_TO=support@jpvbootcamp.com
SUPPORT_TO_EMAIL=support@jpvbootcamp.com
PORTAL_URL=https://portal.jpvbootcamp.com/community/

# Ops
WEBHOOK_IDEMPOTENCY_TTL_HOURS=168
```

## Database setup (ProKit rules)

Follow the ProKit database rules in `_brain/ProKit/README.md`.

Typical commands:

```bash
npm run db:init -- --slug <slug>
npm run db:migrate:dev
```

Production uses the same scripts inside Dokploy with `NODE_ENV=production`.

## Production DB alignment (Supabase SQL scripts)

The webhook expects the tenant schema `tenant_jpvbootcamp` with these columns:

- `stripe_webhook_events`: `event_id`, `type`, `livemode`, `received_at`, `processed_at`, `payload`
- `customer_provisioning`: `email`, `stripe_customer_id`, `stripe_subscription_id`, `wp_user_id`,
  `status`, `plan` (legacy), `current_plan` (canonical), `last_event_id`, `created_at`, `updated_at`

If production is missing any of these columns, apply the alignment scripts:

- `docs/sql/001_align_stripe_webhook_events.sql`
- `docs/sql/002_align_customer_provisioning.sql`

These scripts only add missing columns/indexes and do not drop existing data.

## WordPress plugin install

1) Copy `wordpress-plugin/jpv-provisioning` into `wp-content/plugins/`.
2) Activate **JPV Provisioning** in the WordPress admin.
3) Set the bearer token:
   - Preferred: define `JPV_PROVISION_TOKEN` in `wp-config.php`.
   - Or set it in **Settings → JPV Provisioning**.

## Example provisioning request

```bash
curl -X POST "https://portal.jpvbootcamp.com/wp-json/jpv/v1/provision" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","plan":"pro","name":"Example User"}'
```

## Stripe CLI testing

1) Listen for webhooks:

```bash
stripe listen --forward-to localhost:3000/api/webhook/stripe
```

2) Trigger a checkout session completion:

```bash
stripe trigger checkout.session.completed
```

For full end-to-end testing, run a real Checkout session and confirm the event is delivered.

## Lifecycle diagram

```text
User → /api/stripe/checkout?plan=pro|vip
  → Stripe Checkout Session (metadata: plan, source)
  → Stripe webhook `/api/webhook/stripe` (checkout.session.completed)
    → Verify signature + idempotency
    → POST WP provisioning endpoint
    → Persist CustomerProvisioning + StripeWebhookEvent
    → Send welcome email with portal + reset link
```

## Notes

- Provisioning is webhook-driven only. The success URL never provisions.
- WordPress roles remain `subscriber`.
- Membership level is stored in user meta as `jpv_membership_level`.
