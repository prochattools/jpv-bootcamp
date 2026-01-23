# Stripe Membership Flow (JPV Bootcamp)

## Contract (Email + Provisioning)
- Exactly **2 emails** on a successful PRO or VIP purchase:
  1) **Membership email** from Resend (support@jpvbootcamp.com or configured sender) – sent **only** from the Stripe webhook provisioning path and **only once** per plan change.
  2) **WordPress account email** (from enquiries@jpvbootcamp.com) with set/reset password link – sent **only** when a WP user is created (or re-provisioned because the WP user is missing).
- **No “Free/newsletter” email** is sent on Stripe purchase/upgrade flows. Newsletter email is only sent via `/api/subscribe` and can be disabled globally with `DISABLE_NON_WEBHOOK_EMAILS=1`.

## Stripe Env + Portal Configuration
- Stripe environment is selected by `STRIPE_ENV=test|live`.
- Portal sessions must include an explicit configuration id:
  - `STRIPE_PORTAL_CONFIGURATION_ID_TEST`
  - `STRIPE_PORTAL_CONFIGURATION_ID_LIVE`
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

## Verification Commands
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
  - Proration enabled (Stripe-managed)

## URLs
- WP entrypoints:
  - `https://portal.jpvbootcamp.com/go/billing-portal`
  - `https://portal.jpvbootcamp.com/go/upgrade-vip`
- Next.js portal endpoints:
  - `https://jpvbootcamp.com/api/stripe/billing-portal?token=...`
  - `https://jpvbootcamp.com/api/stripe/upgrade-vip?token=...`
