# PROKIT Database Guide

This is the authoritative reference for how ProKit talks to Postgres: the schema-per-tenant shape, required env vars, and the provisioning/migration/cleanup scripts. Everything else should defer here for database behavior.

## Objectives
- Single, consistent model for local and production.
- One app per schema (`tenant_<APP_SLUG>`) with a dedicated DB role (`tenant_<APP_SLUG>_user`).
- Registry table `public.tenants` is for infra scripts only; runtime never touches it.
- Deterministic scripts for provisioning, migrations, and cleanup.
- Safe-by-default: dev on Docker Postgres at `localhost:5444`, prod on Supabase reachable only inside the Dokploy VNet.
- AI-friendly: assistants call scripts, not ad-hoc SQL.
- Optional PR preview tenants with scripted create/cleanup.

## Platform Layout

### Postgres instances
- Each environment has one Postgres database named `postgres`.
- Per-app schema: `tenant_<slug>`.
- Per-app DB user: `tenant_<slug>_user` scoped to that schema.
- Registry lives in `public.tenants` for infra (provision/cleanup) only.

### Environment picture
- **Development**: Docker Postgres on `localhost:5444`; app + scripts connect directly.
- **Production**: Supabase Postgres on `10.0.2.4:5433`, reachable from Dokploy in the VNet; no public DB access. Dokploy runs app containers and any DB jobs.

### Tenant types
- `type = "prod"`: long-lived tenants, never auto-deleted.
- `type = "preview"`: ephemeral PR tenants, safe to delete.

Registry columns (infra-only):
- `slug`, `schema_name`, `db_user`, `db_password`, `type` (`prod` | `preview`), `external_id` (optional), `created_at`, `updated_at`.

## Connection & Env Model
- `DATABASE_URL`: tenant-scoped runtime connection (only URL the app uses).
- `SYSTEM_DATABASE_URL`: admin connection for scripts (provision/migrate/cleanup).

Examples:
```
# Development
DATABASE_URL=postgresql://tenant_demo_user:***@localhost:5444/postgres?schema=tenant_demo
SYSTEM_DATABASE_URL=postgresql://postgres:devpass@localhost:5444/postgres?schema=public

# Production
DATABASE_URL=postgresql://tenant_demo_user:***@10.0.2.4:5433/postgres?schema=tenant_demo
SYSTEM_DATABASE_URL=postgresql://postgres:prodpass@10.0.2.4:5433/postgres?schema=public
```

Responsibilities:
- Dev: scripts + runtime hit `localhost:5444`; scripts use `SYSTEM_DATABASE_URL`, runtime uses `DATABASE_URL`.
- Prod: scripts run inside Dokploy with `SYSTEM_DATABASE_URL`; runtime uses `DATABASE_URL` (tenant user).

## Provisioning & Managing Tenants

Supported entry points:
- Provision: `npm run db:init -- --slug <slug> [--preview] [--external-id <id>]`
- Cleanup: `npm run db:cleanup -- --slug <slug> [--force]`

Implemented in `scripts/db/init-tenant.js` and `scripts/db/cleanup-tenant.js`.

### Provisioning flow
1) Resolve slug  
   - `--slug <slug>` or `APP_SLUG`; defaults to `dev` in development.  
   - Must match `[a-z0-9_]+`.

2) Password  
   - `TENANT_DB_PASSWORD` required in production; defaults to `devpass` locally.

3) Create schema + user (idempotent)  
```
CREATE SCHEMA IF NOT EXISTS tenant_<slug>;
CREATE/ALTER USER tenant_<slug>_user WITH PASSWORD '<password>';
GRANT USAGE ON SCHEMA tenant_<slug> TO tenant_<slug>_user;
ALTER ROLE tenant_<slug>_user SET search_path = tenant_<slug>;
GRANT ALL PRIVILEGES ON SCHEMA tenant_<slug> TO tenant_<slug>_user;
```

4) Registry (infra only)  
   - Ensure `public.tenants` exists with canonical columns.  
   - Upsert row with slug, schema_name, db_user, db_password, type (`prod` by default, `preview` when flagged), external_id, timestamps.

5) Output connection URL  
   - Logs `postgresql://tenant_<slug>_user:<password>@<host>:<port>/postgres?schema=tenant_<slug>`.  
   - In dev, writes `APP_SLUG` + `DATABASE_URL` (and sets `SYSTEM_DATABASE_URL` if missing) into `.env`.

### Cleanup flow

Command: `npm run db:cleanup -- --slug <slug> [--force]`

1) Lookup `public.tenants` by slug.  
2) If not found → no-op.  
3) If `type != 'preview'` and no `--force` → refuse.  
4) Drop schema `schema_name` CASCADE.  
5) Drop role `db_user` if it exists.  
6) Delete registry row.  

- Dev: runs against `localhost:5444` via `SYSTEM_DATABASE_URL`.  
- Prod: runs inside Dokploy against Supabase via `SYSTEM_DATABASE_URL`.

### Preview tenants (optional)
- Slug must be DB-safe (e.g., `pr_42`).  
- Type: `preview`.  
- Provision: `NODE_ENV=production npm run db:init -- --slug pr_42 --preview`  
- Cleanup: `NODE_ENV=production npm run db:cleanup -- --slug pr_42`

## Migrations & Schema Sync

### Prisma migrations (existing tables)
- Prisma schema: `prisma/system.prisma`.  
- Dev: `npm run db:migrate:dev` → `prisma migrate deploy --schema=prisma/system.prisma` against `localhost:5444`, applying existing migrations.  
- Prod: `NODE_ENV=production npm run db:migrate:prod` → `prisma migrate deploy --schema=prisma/system.prisma` inside Dokploy.  
- Contract: new app versions must not boot without successful `db:migrate:prod`; no raw SQL migrations outside Prisma; `prisma/system.prisma` and `prisma/migrations` stay aligned.

### Payload CMS migrations (payload_* tables)
- Payload manages its own tables autonomously (all prefixed `payload_`).
- Payload migrations are registered via the `prodMigrations` option in `postgresAdapter`, but Dokploy standalone deployments must apply reviewed Payload migrations explicitly with `pnpm payload migrate`.
- Payload tables live in the active tenant schema from `DATABASE_URL?schema=...`; the `payload_` prefix prevents naming conflicts.
- Do not add `payload_*` tables to `prisma/system.prisma` — Payload owns them exclusively.
- Do not touch Payload tables from Prisma, and do not touch Prisma tables from Payload hooks.
- Course/community collections are created by `src/migrations/20260621_194424_course_system_phase1.ts`; private course media is added by `src/migrations/20260622_093852_course_private_media.ts`. Staging `jpvbootcamp_staging` currently has 57 `payload_*` tables after these migrations.
- `deploy-prod.sh` normalizes schema object ownership to the tenant user after admin-run Prisma migrations. This is required because explicit Payload migrations run through the tenant `DATABASE_URL`.

| Manager | Owns | Command |
|---------|------|---------|
| Prisma | `Audiences`, `Project`, `Subscription`, `customer_provisioning`, `email_subscribers`, `partner_clicks`, `partner_sessions`, `sponsored_applications`, `sponsored_grants`, `sponsored_seats`, `stripe_webhook_events` | `npm run db:migrate:dev` / `db:migrate:prod` |
| Payload | All `payload_*` tables, including admin CMS, media/pages/posts, member/course/access/billing/CRM/community/audit collections | `pnpm payload migrate` after review and deploy ownership normalization |

## Optional MCP / Automation Bridge
- RPC layer at `https://mcp.prochat.tools` (replaceable).  
- Triggers the same scripts inside Dokploy:  
  - `provisionTenant(slug)` → `npm run db:init -- --slug <slug>`  
  - `deployMigrations()` → `NODE_ENV=production npm run db:migrate:prod`  
  - `cleanupTenant(slug)` → `NODE_ENV=production npm run db:cleanup -- --slug <slug>`  
- Must not run arbitrary SQL or bypass scripts.

## Rules for AI Assistants
- May propose Prisma schema changes and request `db:init`, `db:migrate:dev`, `db:migrate:prod`, `db:cleanup`.  
- Must not execute raw SQL against production, change the `DATABASE_URL` vs `SYSTEM_DATABASE_URL` split, or create/drop schemas/users outside scripts.  
- Must not connect to production DB from outside the VNet.

## Guardrails & Good Practice
- No direct dev → prod DB access; production only inside the VNet.  
- All schema changes go through Prisma migrations.  
- `db:init -- --slug <slug>` is idempotent and safe to rerun.  
- `db:cleanup -- --slug <slug>` deletes preview tenants; `--force` required for prod tenants.  
- Validate slugs; never interpolate untrusted input into SQL.  
- Runtime uses tenant user via `DATABASE_URL`; scripts use `SYSTEM_DATABASE_URL`.

## Pointers
- Infra/network layout: `docs/PROKIT_INFRASTRUCTURE.md`  
- Dev workflow: `docs/PROKIT_DEV_GUIDE.md`  
- Cleanup details: `docs/PROKIT_TENANT_CLEANUP.md`
- Payload CMS architecture and table inventory: `docs/PAYLOAD_CMS.md`
- WordPress → Payload migration guide: `docs/PAYLOAD_MIGRATION.md`
- Shared local app and OrbStack database inventory: `/Users/Office/Repos/stevewesthoek/brain/operations/infrastructure/local-apps.md`
- Standalone OrbStack Postgres map: `/Users/Office/Repos/stevewesthoek/brain/operations/database/standalone/README.md`
