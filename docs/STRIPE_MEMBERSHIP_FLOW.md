# Stripe Membership Flow (JPV Bootcamp)

> Stripe note: In this repo, every Stripe reference means the JPV Bootcamp Stripe account.

> **Payload CMS note**: The Payload admin panel (`/app`) is a future editorial surface. It does NOT handle Stripe webhooks, WP provisioning, or billing portal flows. Those remain exclusively in the existing Next.js routes. Do not route Stripe events through Payload's webhook endpoint.

## Contract (Email + Provisioning)
- Exactly **2 emails** on a successful PRO or VIP purchase:
  1) **Membership email** from Resend (support@jpvbootcamp.com or configured sender) – sent **only** from the Stripe webhook provisioning path and **only once** per plan change.
  2) **WordPress account email** (from enquiries@jpvbootcamp.com) with set/reset password link – sent **only** when a WP user is created (or re-provisioned because the WP user is missing).
- **No “Free/newsletter” email** is sent on Stripe purchase/upgrade flows. Newsletter email is only sent via `/api/subscribe` and can be disabled globally with `DISABLE_NON_WEBHOOK_EMAILS=1`.

## JPV Bootcamp Stripe Env + Portal Configuration
- Stripe environment is selected by `STRIPE_ENV=test|live`.
- Two-product model is required for Portal upgrades:
  - Pro and VIP are **separate Stripe products**, each with one recurring GBP price.
- Portal sessions must include an explicit configuration id:
  - `STRIPE_PORTAL_CONFIGURATION_ID_TEST`
  - `STRIPE_PORTAL_CONFIGURATION_ID_LIVE`
- Env vars used for plan resolution + provisioning:
  - `STRIPE_PRICE_PRO_TEST` / `STRIPE_PRICE_PRO_LIVE`
  - `STRIPE_PRICE_VIP_TEST` / `STRIPE_PRICE_VIP_LIVE`
  - `STRIPE_PRODUCT_JPV_BOOTCAMP_PRO_MEMBERSHIP_TEST` / `_LIVE`
  - `STRIPE_PRODUCT_JPV_BOOTCAMP_VIP_MEMBERSHIP_TEST` / `_LIVE`
- Portal session creation routes use `configuration=<id>` to ensure Stripe-hosted upgrades + proration are enabled.

## Canonical Event for Membership Emails
- Membership emails are sent **only** on `customer.subscription.updated`.
- All other Stripe events (checkout.session.completed, subscription.created, invoice.paid, etc.) **do not** send membership emails.
- Manual sync (`/api/stripe/sync-membership`) can send email **only** with explicit admin override header.

## Dedupe Strategy (Persistent)
- Dedupe fields stored in `tenant_jpvbootcamp.customer_provisioning`:
  - `last_notified_plan`
  - `last_notified_event_id`
  - `last_notified_at`
- Email send is allowed only if:
  - `newPlan` is `pro|vip`
  - `oldPlan != newPlan`
  - `last_notified_plan != newPlan`
  - `last_notified_event_id != eventId`
  - `last_notified_at` is older than 2 minutes

## Provisioning + Tag Sync
- Webhook provisioning updates:
  - WP `jpv_membership_level`
  - FluentCRM tags: **add** VIP/Pro, **remove** opposite
- On upgrade (Pro→VIP), the subscription update event is authoritative.

## Plan Resolution (JPV Bootcamp Stripe → JPV Plan)
- **Primary:** Price id match (Pro/VIP).
- **Secondary:** Product id match (Pro/VIP).
- **Fallback:** Subscription metadata `plan` if present.
- Any mismatch or unknown ids resolve to `none` and will not provision a plan.

## Upgrade Test (Pro → VIP)
1) Create a Pro subscription via Checkout.
2) Use the billing portal upgrade flow (VIP) from the portal endpoint.
3) Confirm the **same subscription** is updated (no new subscription created).
4) Confirm `customer.subscription.updated` webhook resolves to `vip` by price id.
5) Verify WP membership level + FluentCRM tags updated (VIP added, Pro removed).

## Verification Commands
### Verify Pro/VIP prices map to different products
```
npm run stripe:check-products
```

### Replay a stored webhook event (dry run)
```
DRY_RUN_WP_SYNC=1 tsx scripts/stripe/simulate_sync_from_event.ts evt_123
```

### Dump recent webhook events from DB
```
tsx scripts/stripe/dump_recent_webhook_events.ts
```

### SQL checks (Supabase / Postgres)
```
select email,
       stripe_customer_id,
       stripe_subscription_id,
       current_plan,
       last_notified_plan,
       last_notified_event_id,
       last_notified_at
from tenant_jpvbootcamp.customer_provisioning
where email = 'user@example.com';
```

### Expected logs
- Membership email sent:
```
Membership email sent { email, templateKey, plan, eventId, source, dedupeReason }
```
- Non-webhook email blocked:
```
Non-webhook email skipped { email, templateKey, source }
```

## Stripe Portal Settings to Verify
- Customer Portal configuration allows:
  - Subscription management
  - Price switch from PRO to VIP
  - **Both products included** (Pro product + VIP product)
  - Proration enabled (Stripe-managed)

## URLs
- WP entrypoints:
  - `https://portal.jpvbootcamp.com/go/billing-portal`
  - `https://portal.jpvbootcamp.com/go/upgrade-pro`
  - `https://portal.jpvbootcamp.com/go/upgrade-vip`
- Next.js portal endpoints:
  - `https://jpvbootcamp.com/api/stripe/billing-portal?token=...`
  - `https://jpvbootcamp.com/api/stripe/checkout?plan=pro&token=...`
  - `https://jpvbootcamp.com/api/stripe/upgrade-vip?token=...`
