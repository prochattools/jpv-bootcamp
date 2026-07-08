# PROKIT Invariants

This file captures the contracts that must stay stable while rebranding the boilerplate into **ProKit**. Behavior stays the same; wording and structure can change later phases.

## Payload CMS additions (jpv-bootcamp specific)
- `PAYLOAD_SECRET` – Payload auth token signing secret (32+ chars, required).
- `NEXT_PUBLIC_SERVER_URL` – Base URL for Payload admin links (e.g. `https://jpvbootcamp.com`).
- Node 20 is required; pnpm is required (`engines.pnpm` in `package.json`).
- `/` is the public website.
- `/login` is the shared authentication entry and may redirect only after verified identity and role resolution.
- `/admin` is the administrator-only Payload CMS back office.
- `/portal` is the member-facing Next.js application.
- Payload administrator accounts and member identities are separate security domains, even when one person holds both.
- Members must never receive Payload admin access, administrator API access, or administrator capabilities.
- Navigation visibility is not authorization. Every protected route, API operation, Local API call, and mutation must enforce server-side access and fail closed.
- Course, community, private-group, and billing access requires explicit roles, policies, and entitlements.
- Password onboarding and recovery use expiring set-password or reset links; plaintext passwords are never emailed.
- Current production flows remain unchanged until documented validation, reconciliation, rollback, and cutover gates pass.
- All Payload tables are prefixed `payload_` and live in the approved JPV Bootcamp schema.
- Payload manages its own migrations; do not include `payload_*` tables in `prisma/system.prisma`.

## Environment Contract (must exist unless marked optional)
- Core DB + runtime  
  - `APP_SLUG` – canonical tenant slug (becomes `tenant_<slug>` schema + user).  
  - `DATABASE_URL` – runtime connection for the tenant user scoped to the tenant schema.  
  - `SYSTEM_DATABASE_URL` – admin connection for provisioning/migrations/cleanup only.  
  - `TENANT_DB_PASSWORD` – tenant DB user password (required in production; defaults to `devpass` locally).
- App host + URLs  
  - `NEXT_PUBLIC_APP_URL` – base URL for links and metadata.  
  - `PORT` (Dokploy) – app listen port; default 3000 in scripts/config.
- Auth (Clerk)  
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` – turn on Clerk middleware + components.  
  - `NEXT_PUBLIC_CLERK_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL`, `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` – optional route overrides.
- Billing (Stripe, JPV Bootcamp Stripe account)  
  - `STRIPE_ENV` – selects test vs live mode.  
  - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST` / `_LIVE` – client checkout.  
  - `STRIPE_SECRET_KEY_TEST` / `_LIVE` – server Stripe client.  
  - `STRIPE_WEBHOOK_SECRET_TEST` / `_LIVE` – webhook signature verification.  
  - `STRIPE_PRICE_PRO_MONTHLY_TEST` / `_LIVE`, `STRIPE_PRICE_PRO_ANNUAL_TEST` / `_LIVE` – Pro monthly and annual price IDs.
  - `STRIPE_PRODUCT_JPV_BOOTCAMP_PRO_MEMBERSHIP_TEST` / `_LIVE` – Pro product ID used as fallback plan mapping.
  - Removed paid-tier variables are not target required config and must not power an active checkout option.
- Email (Resend)  
  - `RESEND_API_KEY` – used by `resendService` for waiting list + thank-you emails.
- Automation (Make)  
  - `MAKE_API_KEY`, `MAKE_TEAM_ID`, `MAKE_API_URL` – required for cloning/activating Make scenarios.  
  - `MAKE_ORGANIZATION_ID` – present in `.env.example`, unused by code (safe to leave blank).
- Automation (n8n)  
  - `N8N_API_KEY`, `N8N_API_URL`, `N8N_WEBHOOK_URL` – required for cloning/activating n8n workflows.
- Content (Payload)
  - Payload Local API and collections are the source for managed course, page, and member content.
- Local infra + optional helpers
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DBNAME` – docker-compose Postgres defaults (host port 5444 -> container 5432).
  - `MCP_API_URL`, `MCP_SECRET` – optional MCP bridge for remote script triggering.  
  - `MOCK_USER_ID` – optional dev seed/mocking aid; not consumed by current code.

## NPM Scripts (public contract)
- `npm run dev` – runs `predev`, then starts Next.js dev server on port 3000.  
  - `predev` → `scripts/dev/bootstrap-env.js` (writes `.env` if missing with dev defaults) → `db:init` → `db:migrate:dev`.
- `npm run build` – Next.js production build.  
- `npm start` – Next.js server (`next start -p 3000`).  
- `npm run db:init` – `scripts/db/init-tenant.js`; provisions schema/user/registry row for `APP_SLUG` or `--slug`; writes `.env` in dev; prints runtime `DATABASE_URL` in prod.  
- `npm run db:cleanup` – `scripts/db/cleanup-tenant.js`; drops schema/user and registry row (preview-only unless `--force`).  
- `npm run db:migrate:dev` – `prisma migrate deploy --schema=prisma/system.prisma` (applies existing migrations to dev DB).  
- `npm run db:migrate:prod` – same deploy command targeting production connection.  
- `npm run postinstall` – `prisma generate --schema=prisma/system.prisma`.

## Runtime & Infra Assumptions
- One Postgres database per environment (`postgres`), one schema per app: `tenant_<APP_SLUG>`, and one DB role: `tenant_<APP_SLUG>_user`.
- Registry `public.tenants` exists for infra scripts only (provision/cleanup). Runtime never reads or writes it.
- Runtime uses only `DATABASE_URL` (tenant user scoped to tenant schema). Scripts use `SYSTEM_DATABASE_URL`.
- Provisioning (`db:init`): validates slug, uses `TENANT_DB_PASSWORD` (prod) or `devpass` (dev), creates schema/user, ensures registry row (type `prod` unless `--preview`), and in dev writes `.env` defaults.
- Cleanup (`db:cleanup`): looks up `public.tenants`, refuses non-preview unless `--force`, drops schema/user, deletes registry row. Runs against `SYSTEM_DATABASE_URL`.
- Migrations: Prisma schema at `prisma/system.prisma`; migrations live under `prisma/migrations`; both `db:migrate:*` commands run `prisma migrate deploy` (no drift-creating behavior baked into scripts).
- CI/Dokploy: expect Postgres reachable on port 5433, and Dokploy jobs run the same scripts inside the VNet for Supabase.

## Critical Flows (behavior to preserve)
- **Signup → workspace → dashboard**  
  - Clerk handles sign-in/sign-up (`/sign-in`, `/sign-up`); `middleware.ts` guards all routes when Clerk keys are set, otherwise runs in mock mode.  
  - After auth, users hit `/dashboard`, which checks `subscription.status` via `getSubscriptionByUserId`. Inactive or missing subs redirect to `/processing-page` to complete checkout. Active subs see the automation dashboard (`Scenarios` + thank-you modal).  
  - “Workspace” is the app-level tenant created by `db:init` (one schema/user per app); no per-user multitenancy in runtime.
- **Workspace / tenant DB creation / migration**  
- Dev: `npm run dev` → `predev` writes `.env`, provisions `tenant_dev`, applies migrations to local Postgres on `localhost:5444`.  
  - Prod: Dokploy job runs `NODE_ENV=production npm run db:init -- --slug <slug>` followed by `npm run db:migrate:prod` against Supabase at `10.0.2.4:5433`.
- **Subscription flow (Stripe)**  
  - Checkout initiated client-side via `CheckoutButton` → `/api/stripe/create-checkout` (uses config price IDs) → Stripe Checkout.  
  - Webhook (`/api/webhook/stripe`) verifies with `STRIPE_WEBHOOK_SECRET_TEST` / `STRIPE_WEBHOOK_SECRET_LIVE` and dispatches:  
    - `checkout.session.completed` → `processCheckoutSuccessWebhook` upserts `subscription` row (active, links Stripe customer + optional subscription ID), then emits thank-you email via Resend.  
    - `invoice.paid` keeps subscription `active`; `customer.subscription.deleted` marks it `inactive`.  
  - Billing portal: `/api/stripe/create-portal` uses stored `stripe_customer_id` to create a customer portal session.  
  - Dashboard gating uses `subscription.status !== 'active'` to restrict access.

> Stripe note: In this repo, every Stripe reference means the JPV Bootcamp Stripe account.
- **Example feature CRUD (Projects / automation clones)**  
  - `prisma.system.prisma` models `Project` with Make/n8n metadata.  
  - Creation: `Scenarios` UI posts to either `/api/scenarios/openAIAssistant` (Make) or `/api/workflows/openAIAssistant` (n8n). Each clones a template scenario/workflow using Make or n8n APIs, stamps new credentials/webhook paths, activates the flow, and stores a `project` row with `assistant_id`, `webhookLink`, `status`, etc.  
  - Listing: `/api/projects` returns current user’s projects; `/api/tenants/projects` is a raw all-projects listing.  
  - Toggle: `/api/active` starts/stops Make scenarios and updates `project.status`.  
  - Detail usage: `/api/link` returns the project webhook URL; `/chat/[projectID]` sends messages to that webhook and displays responses.
- **Tenant cleanup**  
  - `npm run db:cleanup -- --slug <slug> [--force]` uses `SYSTEM_DATABASE_URL`, enforces preview-only deletion unless forced, drops schema/user, deletes registry row; safe no-op if slug is unknown.

Optional but existing behaviors:
- Waiting list: `/api/waiting-list` adds contacts to a Resend audience.  
- Health check: `/api/health` returns 200 for uptime checks.
