# ProKit Getting Started

Follow these steps to run ProKit locally and complete the first sign-in/checkout flow.

## Prerequisites
- Node.js + npm
- Docker running Postgres on host port `5433` (maps to container `5432`)
- Stripe + Clerk test keys

## 1) Clone & install
```bash
git clone https://github.com/prochattools/prokit.git prokit
cd prokit
npm install
```

## 2) Environment variables
Create `.env` (or let `npm run dev` generate it) and set:
- `APP_SLUG` – app slug (becomes `tenant_<slug>` schema/user)
- `DATABASE_URL` – tenant runtime DB URL
- `SYSTEM_DATABASE_URL` – admin DB URL for scripts
- `TENANT_DB_PASSWORD` – tenant DB password (required in prod; defaults to `devpass` locally)
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` – Clerk keys
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` – Stripe keys
- `NEXT_PUBLIC_APP_URL` – app base URL (e.g., http://localhost:3000)
- Optional: MAKE_*, N8N_*, RESEND_API_KEY, WP_REST_ENDPOINT, MCP_* as needed

Reference: `.env.example`.

## 3) Provision the database
`npm run dev` will auto-bootstrap `.env`, provision `tenant_dev`, and apply migrations. To run manually:
```bash
npm run db:init -- --slug dev       # creates schema/user + registry row
npm run db:migrate:dev              # applies existing Prisma migrations
```

## 4) Start the app
```bash
npm run dev
# app: http://localhost:3000
```

## 5) First login & subscription
1. Ensure Clerk test keys are set.  
2. Visit `/sign-up` or click “Get started” → complete Clerk sign-up.  
3. After auth you’ll hit `/dashboard`; without an active subscription you’ll be redirected to `/processing-page`.  
4. Choose a plan (Stripe test price IDs in `src/config.ts`) and complete checkout.  
5. Stripe webhook (`/api/webhook/stripe`) marks your subscription `active` and triggers a thank-you email via Resend.  
6. Refresh `/dashboard` to access the Scenarios UI (Make/n8n project cloning).

## 6) Common commands
- Provision: `npm run db:init -- --slug <slug> [--preview] [--external-id <id>]`
- Migrate (dev): `npm run db:migrate:dev`
- Migrate (prod): `npm run db:migrate:prod`
- Cleanup preview: `npm run db:cleanup -- --slug <slug> [--force]`

If you hit issues, see `docs/PROKIT_INFRASTRUCTURE.md` and `instructions/troubleshooting.md`.
