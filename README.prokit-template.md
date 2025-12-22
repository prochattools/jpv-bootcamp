# ProKit (Next.js + Postgres + Prisma)

ProKit is ProChat’s internal SaaS starter built by Steve Westhoek to launch micro-SaaS apps quickly while preserving the proven Next.js + Postgres + Prisma stack.

Production-ready boilerplate for building B2B SaaS apps with:

- Next.js + TypeScript
- PostgreSQL (single-tenant runtime, schema-per-app)
- Prisma for migrations
- Dokploy for deployment
- Supabase Postgres in production
- Optional MCP bridge for automation (replaceable/optional)


For rules governing how AI assistants may modify this boilerplate—including architectural invariants, database contracts, and allowed vs forbidden operations—see `docs/PROKIT_AI_GUIDELINES.md`. All AI-driven contributions must adhere to those rules before altering code, schema, or documentation.

---

## ✨ Features

- Single-tenant runtime using one schema (`tenant_<APP_SLUG>`) and one DB user (`tenant_<APP_SLUG>_user`)
- Registry table `public.tenants` used only by infra scripts (provision/cleanup), never by runtime
- Shared `postgres` database per environment (dev + prod), canonical port `5433`
- Local development using Docker Postgres on `localhost:5433`
- Production Postgres on a private Supabase instance (no public DB access)
- Prisma migrations:
  - `db:migrate:dev` → `prisma migrate deploy`
  - `db:migrate:prod` → `prisma migrate deploy`
- Deterministic scripts:
  - Provisioning: `npm run db:init -- --slug <slug> [--preview] [--external-id <id>]`
  - Cleanup (preview or forced prod): `npm run db:cleanup -- --slug <slug> [--force]`
- Dokploy integration for pre-deploy migrations and provisioning in the same VNet as Supabase
- Optional MCP bridge (`https://mcp.prochat.tools`) to trigger these scripts remotely (replaceable)
- Optional modules (trustless patterns, idea factory) that can be layered on without touching the core

For deeper details on dev workflow, stack, and automation, see `docs/PROKIT_DEV_GUIDE.md`.

---

## 🧱 Tech Stack

- Frontend / Backend: Next.js + TypeScript
- Database: PostgreSQL (schema-per-app, single-tenant runtime)
- ORM: Prisma (`prisma/system.prisma`)
- Hosting / Orchestration: Dokploy (containers, pre-deploy hooks, jobs, schedules)
- Production Database: Supabase Postgres on a private Azure VM (private IP `10.0.2.4`)
- Automation: Node scripts for provisioning/migrations/cleanup; optional MCP bridge for remote-triggered operations

For infrastructure details and network layout, see `docs/PROKIT_INFRASTRUCTURE.md`.

---

## ⚙️ Database & Migrations (Summary)

The full database model and automation behavior is documented in:

- `docs/PROKIT_DATABASE.md` – schemas, lifecycle, commands
- `docs/PROKIT_TENANT_CLEANUP.md` – cleanup logic and SQL templates

### Architecture

- Each environment (development, production) has its own Postgres instance with a database named `postgres`.
- One app → one schema (`tenant_<APP_SLUG>`) → one DB user (`tenant_<APP_SLUG>_user`).
- Runtime uses only `DATABASE_URL` (tenant user + tenant schema). Runtime must NOT read hostnames, `SYSTEM_DATABASE_URL`, or `public.tenants`.
- Registry (`public.tenants`) is infra-only (provision/cleanup). Columns: slug, schema_name, db_user, db_password, type (`prod`/`preview`), external_id, created_at, updated_at.

Example environment variables (conceptual):

```
# .env (development)
DATABASE_URL=postgresql://tenant_dev_user:devpass@localhost:5433/postgres?schema=tenant_dev
SYSTEM_DATABASE_URL=postgresql://postgres:postgres@localhost:5433/postgres?schema=public
APP_SLUG=dev

# Production (Dokploy env)
NODE_ENV=production
APP_SLUG=myapp
TENANT_DB_PASSWORD=<strong-password>
DATABASE_URL=postgresql://tenant_myapp_user:<TENANT_DB_PASSWORD>@10.0.2.4:5433/postgres?schema=tenant_myapp
SYSTEM_DATABASE_URL=postgresql://postgres:<admin-password>@10.0.2.4:5433/postgres?schema=public
```

Commands:

- Provision tenant: `npm run db:init -- --slug <slug> [--preview] [--external-id <id>]`
- Migrate schema (development): `npm run db:migrate:dev`
- Migrate schema (production, in Dokploy): `npm run db:migrate:prod`
- Cleanup preview tenant: `npm run db:cleanup -- --slug <slug> [--force]`

---

## 🚀 Getting Started

### 1. Prerequisites

- Node.js and npm installed.
- Docker Desktop running, with Postgres exposed on `localhost:5433`.
- Dokploy configured and able to pull this repo from GitHub.
- Supabase Postgres VM reachable from Dokploy over a private VNet.

### 2. Clone and install

```
git clone https://github.com/prochattools/prokit.git my-new-app
cd my-new-app
npm install
```

`.env` will be created automatically by the dev bootstrap script if missing. See `.env.example` for a reference.

### 3. Local environment and provisioning (dev)

The dev workflow is one command:

```
npm run dev
```

Under the hood:

1) `scripts/dev/bootstrap-env.js`
   - If `.env` does not exist, writes defaults with `NODE_ENV=development`, `APP_SLUG=dev`, and `SYSTEM_DATABASE_URL` pointing at `localhost:5433`.

2) `npm run db:init`
   - Parses `--slug <slug>` (preferred) or `APP_SLUG`.
   - Defaults to `dev` in development if nothing is provided.
   - Creates `tenant_<slug>` schema, `tenant_<slug>_user`, grants, and `public.tenants` row with metadata (type `prod` by default, `preview` if `--preview` is passed).
   - Updates `.env` with `APP_SLUG` and `DATABASE_URL`; only sets `SYSTEM_DATABASE_URL` if missing.

3) `npm run db:migrate:dev`
   - Runs `prisma migrate deploy --schema=prisma/system.prisma` against your local Postgres on `localhost:5433`.

4) `next dev`
   - Starts the Next.js dev server on http://localhost:3000.

If Prisma detects drift and asks to reset the DB, you can run:

```
npx prisma migrate reset --schema=prisma/system.prisma
```

### 4. Manual dev commands (optional)

- Provision: `npm run db:init -- --slug myapp`
- Migrate: `npm run db:migrate:dev`
- Start dev server: `npm run dev`

---

## 🧬 New SaaS from this boilerplate

- `APP_SLUG` defines your app identity: it becomes `tenant_<APP_SLUG>` and `tenant_<APP_SLUG>_user`.
- Runtime uses only `DATABASE_URL` scoped to that tenant.
- Registry (`public.tenants`) is kept for infra scripts and preview cleanup; runtime ignores it.

### Local development workflow (summary)

1) Clone + install.
2) Ensure Postgres on `localhost:5433`.
3) Optionally set `APP_SLUG` in `.env`.
4) `npm run dev`.

Result:
- `tenant_<APP_SLUG>` schema and user exist.
- Prisma migrations applied.
- Next.js running with `DATABASE_URL`.

### Production deployment (Dokploy + Supabase)

1) Configure Dokploy env:
   - `NODE_ENV=production`
   - `APP_SLUG=myapp`
   - `TENANT_DB_PASSWORD=<strong-password>`
   - `DATABASE_URL=postgresql://tenant_myapp_user:<TENANT_DB_PASSWORD>@10.0.2.4:5433/postgres?schema=tenant_myapp`
   - `SYSTEM_DATABASE_URL=postgresql://postgres:<admin-password>@10.0.2.4:5433/postgres?schema=public`
   - `NEXT_PUBLIC_APP_URL=https://myapp.example.com`
   - `PORT=3000`

2) Dokploy run command (example):

```
npm run db:init -- --slug $APP_SLUG && npm run db:migrate:prod && npm start
```

Notes:
- `npm run db:init` is idempotent; it reconciles schema, user, and registry row.
- Runtime must only use `DATABASE_URL` (tenant user). `SYSTEM_DATABASE_URL` is for scripts.

### Preview tenants and cleanup (optional)

- Provision preview: `NODE_ENV=production npm run db:init -- --slug pr_42 --preview`
- Deploy preview app with `APP_SLUG=pr_42` and matching `DATABASE_URL`.
- Cleanup preview: `NODE_ENV=production npm run db:cleanup -- --slug pr_42`
- Cleanup refuses `type='prod'` unless `--force` is passed.

### CI (GitHub Actions)

`.github/workflows/ci.yml`:
- Postgres 16 mapped to host port 5433.
- Provision tenant (`npm run db:init -- --slug ci`).
- Run `npm run db:migrate:dev` (uses `prisma migrate deploy`).
- Build the app.

---

## 🤖 AI / MCP Usage

This boilerplate is AI-friendly and provider-agnostic.

AI assistants or developers may:
- Propose Prisma schema changes.
- Request running:
  - `npm run db:init -- --slug <slug> [--preview]`
  - `npm run db:migrate:dev`
  - `npm run db:migrate:prod`
  - `npm run db:cleanup -- --slug <slug> [--force]`
- Use the information in `docs/PROKIT_DATABASE.md`, `docs/PROKIT_INFRASTRUCTURE.md`, `docs/PROKIT_DEV_GUIDE.md`, `docs/PROKIT_TENANT_CLEANUP.md`, and this README.

They must not:
- Connect directly to production DB from outside the VNet.
- Run arbitrary SQL against production.
- Bypass Prisma migrations.
- Create/drop schemas or users outside the scripts.

Optional MCP tools (replaceable):
- `provisionTenant(slug)` → `npm run db:init -- --slug <slug>`
- `deployMigrations()` → `NODE_ENV=production npm run db:migrate:prod`
- `cleanupTenant(slug)` → `NODE_ENV=production npm run db:cleanup -- --slug <slug>`

---

## 🧩 Optional Modules

- Trustless / passwordless patterns: see `docs/PROKIT_README_TRUSTLESS.md` (optional).
- AI SaaS Idea Factory: see `docs/PROKIT_REFERENCE.md` (optional ideation).

---

## 📚 Related Docs

- `docs/PROKIT_DEV_GUIDE.md` — development philosophy and guardrails.
- `docs/PROKIT_INFRASTRUCTURE.md` — Azure VNet, Supabase VM, Dokploy VM, MCP bridge, previews.
- `docs/PROKIT_DATABASE.md` — database architecture, scripts, env contracts.
- `docs/PROKIT_TENANT_CLEANUP.md` — cleanup rules and SQL patterns.
- `docs/PROKIT_README_TRUSTLESS.md` — optional trustless features.
- `docs/PROKIT_REFERENCE.md` — ideation framework (optional).
- `docs/PROKIT_GETTING_STARTED.md` — step-by-step local setup.

This README is the entry point; treat the other files as the spec for how to extend and operate this boilerplate safely.
