# PROKIT AI Guidelines

These rules define how AI assistants and automation may interact with ProKit. ProKit is a reusable single-tenant SaaS foundation, not a finished app. The goal is to let AI help while protecting the architecture.

## 1) Purpose & scope
ProKit provides a repeatable starting point for new SaaS apps, including infra contracts for provisioning, migrations, and env setup. These guidelines apply to code, docs, database schema/migrations, and infra scripts.

## 2) Core architectural invariants (do not break)
### Single-tenant runtime
- One schema: `tenant_<APP_SLUG>`  
- One DB user: `tenant_<APP_SLUG>_user`  
- Runtime uses `DATABASE_URL` only.

Forbidden: multi-tenant per-request routing, using `SYSTEM_DATABASE_URL` in runtime, auto-detecting tenants from hostnames.

### Registry is infra-only
`public.tenants` exists solely for provisioning/cleanup scripts with columns:
```
slug text primary key,
schema_name text,
db_user text,
db_password text,
type text,            -- 'prod' | 'preview'
external_id text null,
created_at timestamptz,
updated_at timestamptz
```
Forbidden: runtime access to registry or changing meaning of `type`.

### Environment contract
- `APP_SLUG` – canonical tenant slug  
- `DATABASE_URL` – tenant runtime DB  
- `SYSTEM_DATABASE_URL` – admin DB for scripts only  
- `TENANT_DB_PASSWORD` – password used when provisioning tenant user

Forbidden: change semantics of these vars or use `SYSTEM_DATABASE_URL` during app runtime.

## 3) Database scripts & commands (public contract)
- `db:init` provisions schema + role + registry row using `SYSTEM_DATABASE_URL` (`TENANT_DB_PASSWORD` in prod; `devpass` in dev).  
- `db:migrate:dev` / `db:migrate:prod` apply Prisma migrations (`prisma migrate deploy`).  
- `db:cleanup` deletes preview tenants unless `--force`; uses `SYSTEM_DATABASE_URL`; must not silently delete prod tenants.

## 4) Prisma rules
Datasource:
```
datasource db {
  provider          = "postgresql"
  url               = env("DATABASE_URL")
  shadowDatabaseUrl = env("SYSTEM_DATABASE_URL")
}
```
Allowed: add models/fields useful for future SaaS apps; generate migrations when asked.  
Forbidden: remove core models, change IDs/PKs without explicit instruction.

## 5) Boilerplate vs app-specific logic
ProKit must remain generic.
- Allowed: reusable dashboards, billing scaffolding, onboarding patterns, generic APIs.  
- Not allowed: niche-specific branding/flows tightly coupled to one vertical.

## 6) AI behavior rules
- Confirm intent before touching migrations, tenant model, provisioning scripts, or env contracts.  
- Keep diffs minimal; do not rewrite entire files unless requested.  
- Infra changes must be reflected in `README.md`, `docs/PROKIT_DATABASE.md`, `docs/PROKIT_INFRASTRUCTURE.md`, `docs/PROKIT_TENANT_CLEANUP.md`.
- If anything conflicts with this file, this file wins unless a human explicitly approves the change.

## 7) Payload CMS rules (jpv-bootcamp specific)
- All Payload collections must use `dbName` prefixed with `payload_` to avoid collisions with Prisma tables.
- Do not add `payload_*` tables to `prisma/system.prisma` — Payload manages them.
- Do not query Prisma tables from Payload hooks, and do not query Payload tables from Prisma clients.
- The `payload_users` collection is for CMS editorial users only — not Clerk users, or Stripe customers.
- The existing Stripe webhook handler at `/api/webhook/stripe` must not be altered. It is independent of Payload.
- When adding Payload collections or plugins, always run `pnpm payload generate:types` and `pnpm payload generate:importmap`.
- Payload environment changes must be reflected in `docs/PAYLOAD_CMS.md` and `docs/PAYLOAD_INTEGRATION_PLAN.md`.

## 7) Summary
ProKit is a stable SaaS starter. AI may improve features, fix bugs, and enhance DX, but must not:
- break single-tenant architecture  
- change env contracts  
- alter provisioning semantics  
- introduce multi-tenancy
