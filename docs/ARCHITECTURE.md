# System Architecture — JPV Bootcamp

This document maps every system, integration, and data flow in the current production application. It is the required reading before any migration work.

---

## Systems in production

| System | URL | Technology | Purpose |
|--------|-----|-----------|---------|
| Next.js app | `https://jpvbootcamp.com` | Next.js 16, React 19, Node 20, Docker on Dokploy | Frontend, API, Payload CMS admin |
| WordPress | `https://portal.jpvbootcamp.com` | WordPress + FluentCommunity + FluentCRM + MU plugins | Community portal, membership pages, billing handoffs |
| Stripe | External | Stripe API | Subscription billing (Pro and VIP plans) |
| Supabase PostgreSQL | `10.0.2.4:5433` (VNet only) | PostgreSQL 15 on Azure | Single database for all app data |
| GHCR | `ghcr.io/prochattools/jpv-bootcamp` | GitHub Container Registry | Docker image registry |
| Dokploy | `https://dokploy.prochat.tools` | Docker Swarm on Hetzner | Container orchestration and deployment |
| Resend | External | Resend API | Transactional email |

---

## Database: single schema, two managers

**Host**: `10.0.2.4:5433` (Supabase PostgreSQL 15 on Azure — reachable from Dokploy VNet only)
**Database**: `postgres`
**Schema**: `jpvbootcamp`

| Manager | Tables | How changes are applied |
|---------|--------|------------------------|
| Prisma | `Audiences`, `Project`, `Subscription`, `customer_provisioning`, `email_subscribers`, `partner_clicks`, `partner_sessions`, `sponsored_applications`, `sponsored_grants`, `sponsored_seats`, `stripe_webhook_events`, `_prisma_migrations` | `npm run db:migrate:prod` in `deploy-prod.sh` |
| Payload | `payload_categories`, `payload_kv`, `payload_locked_documents`, `payload_locked_documents_rels`, `payload_media`, `payload_migrations`, `payload_pages`, `payload_posts`, `payload_posts_rels`, `payload_preferences`, `payload_preferences_rels`, `payload_users`, `payload_users_sessions` | Auto via `prodMigrations` on container startup |

WordPress has its own separate MySQL database (not Supabase). No cross-database queries.

---

## Stripe integration

**Account**: JPV Bootcamp Stripe account (every Stripe reference in this repo means this account)
**Plans**: Pro and VIP — separate Stripe products, each with one recurring GBP price

### Webhook endpoint

```
POST https://jpvbootcamp.com/api/webhook/stripe
```

Handled events (in `src/lib/stripe-webhook-handler.ts`):

| Event | What happens |
|-------|-------------|
| `checkout.session.completed` | Provisions WP user, stores `customer_provisioning` row, sends welcome email via Resend |
| `customer.subscription.created` | Updates `customer_provisioning`, syncs WP membership level and FluentCRM tags |
| `customer.subscription.updated` | Updates `customer_provisioning`, syncs WP membership level and FluentCRM tags, sends membership email on plan change |
| `customer.subscription.deleted` | Updates `customer_provisioning`, downgrades WP membership |
| `invoice.paid` | Updates subscription records |

**Idempotency**: every event is recorded in `stripe_webhook_events` before processing. Duplicate events are rejected.

**Provisioning gate**: `PROVISIONING_ENABLED=true` env var must be set for webhook events to call the WP provisioning endpoint. If unset, events are received and stored but no WP sync occurs.

**Membership email deduplication**: stored in `customer_provisioning` (`last_notified_plan`, `last_notified_event_id`, `last_notified_at`). An email is sent only on `customer.subscription.updated` when the plan actually changes to `pro` or `vip`.

### Checkout flow

```
User → /api/stripe/checkout?plan=pro|vip&token=<signed>
  → Stripe Checkout session
  → Stripe fires checkout.session.completed
  → /api/webhook/stripe handles it
```

### Billing portal flow

```
WP menu link → /go/billing-portal (WP)
  → signs HMAC token (BILLING_PORTAL_HMAC_SECRET)
  → redirects to /api/stripe/billing-portal?token=<signed> (Next.js)
  → creates Stripe Billing Portal session
  → Stripe-hosted portal
```

Same pattern for upgrade-pro and upgrade-vip.

### Entitlements sync (WP → Next.js)

On login and community page load, WordPress calls:
```
GET https://jpvbootcamp.com/api/entitlements
Authorization: Bearer <signed billing token>
```
Response: `{ "plan": "free" | "pro" | "vip" }` — sourced live from Stripe subscriptions.
WordPress uses this to update `jpv_membership_level` user meta. FluentCRM hooks on that meta change to sync tags.

### Other Stripe API routes

| Route | Purpose |
|-------|---------|
| `POST /api/stripe/checkout` | Creates Stripe Checkout session |
| `POST /api/stripe/billing-portal` | Creates Stripe Billing Portal session |
| `POST /api/stripe/upgrade-vip` | Upgrades existing subscription to VIP via portal |
| `POST /api/stripe/sync-membership` | Admin-only: manually syncs a user's plan from Stripe |

---

## WordPress MU plugins

Five MU plugins live in `wordpress/mu-plugins/` in this repo and must be deployed to `wp-content/mu-plugins/` on the WordPress server. They load automatically — no activation step.

### `00-portal-entrypoint-and-fluentcrm-sync.php`

Handles:
- `/go/*` path routing (redirects from WP menu items to billing handoff endpoints)
- Logout redirect
- **FluentCRM tag sync**: on user register and on `jpv_membership_level` user meta change, syncs the contact in FluentCRM

Tag logic:
- `jpv_membership_level = 'free'` → FluentCRM tags: `['Free']`, detach `['Pro', 'VIP']`
- `jpv_membership_level = 'pro'` → FluentCRM tags: `['Pro', 'Free']`, detach `['VIP']`
- `jpv_membership_level = 'vip'` → FluentCRM tags: `['Pro', 'VIP']`, detach none
- Sync has retry logic with deferred scheduling via `jpv_fcrm_deferred_sync` WP cron action

### `10-jpv-billing-portal-handoff.php`

Handles:
- `GET /go/billing-portal` → signs HMAC token → `302` to `jpvbootcamp.com/api/stripe/billing-portal?token=...`
- `GET /go/upgrade-vip` → signs HMAC token → `302` to `jpvbootcamp.com/api/stripe/upgrade-vip?token=...`
- `GET /go/upgrade-pro` → signs HMAC token → `302` to `jpvbootcamp.com/api/stripe/checkout?plan=pro&token=...`
- Token payload: `{ email, iat, exp, nonce }` — signed with `BILLING_PORTAL_HMAC_SECRET`

### `20-jpv-partners-handoff.php`

Handles:
- Partner/affiliate link tracking — redirects and records clicks/sessions in Next.js via `partner_clicks` and `partner_sessions` tables

### `30-jpv-sponsored-claim.php`

Handles:
- Sponsored seat claim flow — WordPress-side of the sponsored seat application process

### `90-jpv-provisioning.php`

Exposes two WordPress REST API endpoints (authenticated with bearer token):

| Endpoint | Purpose |
|----------|---------|
| `POST /wp-json/jpv/v1/provision` | Creates or updates a WP user: sets `jpv_membership_level`, sends WP password reset email, triggers FluentCRM sync |
| `GET /wp-json/jpv/v1/user-exists` | Checks if a WP user exists by email |

Called by the Next.js webhook handler after every qualifying Stripe event (`checkout.session.completed`, subscription events).

Token configuration: **Settings → JPV Provisioning** in WP admin, or `define('JPV_PROVISION_TOKEN', '...')` in `wp-config.php`.

---

## Next.js → WordPress sync (reverse direction)

When a WordPress user is deleted, WordPress notifies Next.js:

```
POST https://jpvbootcamp.com/api/wp/user-deleted
X-JPV-WP-Signature: <token>
```

Handler (`src/app/api/wp/user-deleted/route.ts`) updates `customer_provisioning` to reflect the deletion. Token is `APP_WP_SYNC_TOKEN` / `WP_TO_APP_TOKEN`.

---

## Email: Resend

| Trigger | Sender | Template |
|---------|--------|---------|
| `checkout.session.completed` (new purchase) | `RESEND_FROM` | Welcome + WP portal link |
| `customer.subscription.updated` (plan change) | `RESEND_FROM` | Membership upgrade confirmation |
| WordPress WP user created | WordPress (`enquiries@jpvbootcamp.com`) | WP account password set/reset |

**Only 2 emails per successful purchase** — one from Resend, one from WordPress. Enforced by deduplication in `customer_provisioning`.

`/api/subscribe` sends a newsletter-only email (no Stripe, no WP). Disabled globally with `DISABLE_NON_WEBHOOK_EMAILS=1`.

---

## Sponsored seats flow

A separate self-contained flow with no Stripe involvement:

```
/api/sponsored-seats   → reads available seats from sponsored_seats table
/api/sponsored-applications → records applications in sponsored_applications table
```

WordPress plugin `30-jpv-sponsored-claim.php` handles the WP-side of the claim UI.

---

## Partners / affiliates flow

```
/out/[partnerSlug]  → tracks click → records in partner_clicks
/partners/session   → records session in partner_sessions
```

WordPress plugin `20-jpv-partners-handoff.php` handles partner link routing on the WP side.

---

## What WordPress owns (must not be broken by migration)

| Capability | WordPress component | Migration impact |
|------------|-------------------|-----------------|
| Community portal pages | FluentCommunity plugin | Not migrated until Payload has equivalent |
| Member login/session | WordPress auth | Not replaced — Payload users are editorial only |
| `jpv_membership_level` user meta | WordPress user meta | Authoritative source of member plan in WP; FluentCRM reads it |
| FluentCRM contact + tags | FluentCRM plugin | Driven by WP meta changes; not stored in Next.js DB |
| `/go/*` redirect routes | MU plugin 10 | Must remain working during migration |
| WP user provisioning endpoint | MU plugin 90 `/wp-json/jpv/v1/provision` | Called by Next.js webhook handler; must remain working |
| Password reset emails | WordPress `wp_new_user_notification` | Sent by WP, not Next.js |
| Billing token signing | MU plugin 10 (`BILLING_PORTAL_HMAC_SECRET`) | Shared secret with Next.js |

---

## What the migration changes (and what it does not)

**Does not change** (during content migration phase):
- Any Stripe integration or webhook handling
- WordPress provisioning endpoint or MU plugins
- FluentCRM tag sync
- Billing portal flows
- `customer_provisioning` table or Prisma schema
- Any existing Next.js API routes

**Changes during content migration**:
- Content (posts, pages, categories, media) moves from WordPress to Payload `payload_*` tables
- Frontend pages are updated to read from Payload Local API instead of WordPress REST API, one content type at a time

**The migration is purely additive content work.** All billing, membership, and provisioning infrastructure remains unchanged throughout.

---

## References

| Topic | Document |
|-------|---------|
| Stripe events, plans, deduplication | `docs/STRIPE_MEMBERSHIP_FLOW.md` |
| Stripe checkout + portal flows, MU plugin setup, env vars | `docs/STRIPE_WP_PROVISIONING.md` |
| Payload CMS architecture and tables | `docs/PAYLOAD_CMS.md` |
| WordPress → Payload migration guide | `docs/PAYLOAD_MIGRATION.md` |
| Database schema, connections, migration commands | `docs/PROKIT_DATABASE.md` |
| Infrastructure, VNet, Dokploy | `docs/PROKIT_INFRASTRUCTURE.md` |
