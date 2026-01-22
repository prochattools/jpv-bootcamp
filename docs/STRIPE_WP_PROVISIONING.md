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
APP_WP_SYNC_TOKEN=
# or WP_TO_APP_TOKEN=

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

1) Copy these MU plugin files from this repo into `wp-content/mu-plugins/`:
   - `wordpress/mu-plugins/00-portal-entrypoint-and-fluentcrm-sync.php`
   - `wordpress/mu-plugins/10-jpv-billing-portal-handoff.php`
   - `wordpress/mu-plugins/jpv-provisioning.php`
2) Remove any old/duplicate MU plugins from the server (e.g. `11-jpv-upgrade-vip-handoff.php`).
3) MU plugins load automatically (no activation step).
4) Set the bearer token in **Settings → JPV Provisioning** (stored in wp_options).
   - Optional override: define `WP_PROVISION_TOKEN` or `JPV_PROVISION_TOKEN` in `wp-config.php`.
5) Configure WP → app deletion sync in `wp-config.php`:
   - `JPV_APP_SYNC_URL=https://<app>/api/wp/user-deleted`
   - `JPV_APP_SYNC_TOKEN=...` (or reuse `JPV_PROVISION_TOKEN`)

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

## Billing portal entrypoints (Stripe-only upgrade flow)

WordPress only signs a billing token and redirects the browser to Next.js.
Next.js creates the Stripe Billing Portal session and redirects the browser to Stripe.

- WordPress menu URLs:
  - `https://portal.jpvbootcamp.com/go/billing-portal`
  - `https://portal.jpvbootcamp.com/go/upgrade-vip`
- WordPress → Next.js redirects:
  - `https://jpvbootcamp.com/api/stripe/billing-portal?token=<signed>`
  - `https://jpvbootcamp.com/api/stripe/upgrade-vip?token=<signed>`
- Token payload includes `email`, `iat`, `exp`, `nonce` (HMAC with `BILLING_PORTAL_HMAC_SECRET`).
- Stripe Billing Portal return URLs (fixed):
  - Billing portal: `https://portal.jpvbootcamp.com/community/?jpv_billing=return`
  - Upgrade VIP: `https://portal.jpvbootcamp.com/community/?jpv_upgrade=success`

### Secret configuration

- WordPress secret source (CloudPanel PHP-FPM env):
  - `env[BILLING_PORTAL_HMAC_SECRET]=...` (preferred)
  - Optional fallback: `define('BILLING_PORTAL_HMAC_SECRET', '...')` in `wp-config.php`
- Next.js secret:
  - `BILLING_PORTAL_HMAC_SECRET=...` (server env)

### Entitlements sync (WordPress → FluentCRM tags)

On login and on community page load, WordPress calls `/api/entitlements` with a billing token
and updates `jpv_membership_level` if it differs. The existing FluentCRM hooks then sync tags.

### Secret rotation

If the secret is exposed, rotate it on both sides at the same time:

1) Update CloudPanel PHP-FPM env:
   - `env[BILLING_PORTAL_HMAC_SECRET]=<new>`
2) Update Next.js env:
   - `BILLING_PORTAL_HMAC_SECRET=<new>`
3) Reload PHP-FPM and redeploy Next.js.

## Reconciliation testing

1) Delete a WordPress user in WP admin.
2) Resend the Stripe webhook event for that user (e.g., `checkout.session.completed` or `customer.subscription.updated`).
3) Confirm the webhook reprovisions the user and `customer_provisioning.wp_user_id` is set again.

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

- Provisioned means the WP user exists, not just that a row exists in `customer_provisioning`.
- Provisioning is webhook-driven only. The success URL never provisions.
- WordPress roles remain `subscriber`.
- Membership level is stored in user meta as `jpv_membership_level`.

## Local sanity check (UUID id)

If you need a quick local check that Prisma generates a UUID for `customer_provisioning.id`,
run this against a dev database:

```bash
node -e "const {PrismaClient}=require('@prisma/client');const prisma=new PrismaClient();prisma.customerProvisioning.create({data:{email:'test+uuid@example.com',stripeCustomerId:'cus_test_uuid',status:'active',currentPlan:'pro'}}).then(r=>{console.log('ok',r.id)}).catch(e=>{console.error(e.message)}).finally(()=>prisma.$disconnect())"
```

This should print a UUID and will not require an explicit `id` in the data payload.
