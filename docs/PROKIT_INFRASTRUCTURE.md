# PROKIT Infrastructure Guide

ProKit ships with a scripted, environment-safe way to provision databases, run migrations, and manage single-tenant deployments. This keeps humans and automation on the same rails: call the documented commands instead of inventing SQL.

## Architecture snapshot
- One Postgres per environment (`postgres` DB).  
- One app → one schema (`tenant_<slug>`) → one DB user (`tenant_<slug>_user`).  
- Registry table `public.tenants` is infra-only (provision/cleanup), never read by runtime.  
- Prisma manages schema + migrations (`prisma/system.prisma`).  
- Dev runtime + provisioning hit Docker Postgres on `localhost:5433`.  
- Prod provisioning/migrations run inside Dokploy to Supabase `10.0.2.4:5433` via `SYSTEM_DATABASE_URL`.  
- Prod runtime uses `DATABASE_URL` (tenant user) only.  
- Optional MCP bridge (`https://mcp.prochat.tools`) wraps the same commands.

Environment split:
- **Dev**: scripts → `SYSTEM_DATABASE_URL` @ `localhost:5433`; runtime → `DATABASE_URL` @ `localhost:5433`; env file `.env`.  
- **Prod**: scripts inside Dokploy → `SYSTEM_DATABASE_URL` @ `10.0.2.4:5433`; runtime → `DATABASE_URL` (tenant user); env via Dokploy or `.env.production`.

For database behavior details, see `docs/PROKIT_DATABASE.md`. Cleanup specifics live in `docs/PROKIT_TENANT_CLEANUP.md`.

## Automation commands
- Provision: `npm run db:init -- --slug <slug> [--preview] [--external-id <id>]`  
  - Creates schema + user, grants, search_path, and upserts registry row with type (`prod` or `preview`).  
- Migrations:  
  - Dev: `npm run db:migrate:dev` → `prisma migrate deploy --schema=prisma/system.prisma`  
  - Prod: `npm run db:migrate:prod` → same command in Dokploy  
- Cleanup (preview by default): `npm run db:cleanup -- --slug <slug> [--force]`  
  - Looks up `public.tenants`, refuses non-preview unless `--force`, drops schema/user, deletes registry row.

AI/agents must use these commands (or MCP wrappers), not raw SQL.

## Prerequisites
- Docker Desktop with Postgres exposed on host `5433` (mapped to container `5432`).  
- Dokploy with network access to Supabase Postgres `10.0.2.4:5433`.  
- Optional MCP bridge available for remote-triggered operations.  
- `.env` / `.env.production` include tenant/runtime and system URLs:
  - `DATABASE_URL=postgresql://tenant_<slug>_user:<password>@localhost:5433/postgres?schema=tenant_<slug>`
  - `SYSTEM_DATABASE_URL=postgresql://postgres:<admin>@localhost:5433/postgres?schema=public`

## Starting a new project
1) Clone + install  
```
git clone https://github.com/prochattools/prokit.git my-new-app
cd my-new-app
npm install
```
2) Provision  
```
npm run db:init -- --slug <slug>
```
   - Dev: hits `localhost:5433` via `SYSTEM_DATABASE_URL`.  
   - Prod: run inside Dokploy against `10.0.2.4:5433`.  
   - Creates schema/user + registry; in dev writes `DATABASE_URL`/`APP_SLUG` (and sets `SYSTEM_DATABASE_URL` if missing) into `.env`.

3) Run (dev)  
```
npm run dev
```

4) Access  
```
http://localhost:3000
```
Runtime always uses `DATABASE_URL`; no host-based tenant routing.

## PR preview tenants (optional)
- Provision: `NODE_ENV=production npm run db:init -- --slug pr_42 --preview`  
- Cleanup: `NODE_ENV=production npm run db:cleanup -- --slug pr_42`  
- Registry updated; cleanup refuses prod rows unless `--force`.

## Keep schemas aligned
- Dev: edit `prisma/system.prisma` → `npm run db:migrate:dev` (generates/applies migrations locally).  
- Prod: deploy code + migrations; Dokploy runs `NODE_ENV=production npm run db:migrate:prod` against `10.0.2.4:5433`.  
- MCP (optional) may trigger the same commands; must not bypass scripts.
