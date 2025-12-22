# PROKIT Tenant Cleanup

This is the implementation reference for safely deleting a tenant (schema, DB user, registry row). It backs:
- `npm run db:cleanup -- --slug <slug> [--force]`
- Any automation (CI, Dokploy jobs, MCP tools) that removes preview tenants.

For the full database model and lifecycle, see `docs/PROKIT_DATABASE.md`.

## Purpose & scope
- Designed for **preview tenants** (`type = 'preview'` in `public.tenants`).  
- Default behavior: drop tenant schema, drop tenant DB user, delete registry entry.  
- Production tenants (`type = 'prod'`) should only be removed with explicit `--force` and never by unattended automation.

## Safety rules
1) Registry is source of truth: lookup `public.tenants`; don’t guess names.  
2) Type protection: delete only `preview` by default; require `--force` otherwise.  
3) Idempotent: missing schema/user/row should not crash.  
4) Environment separation:  
   - Dev cleanup hits local Docker Postgres via `SYSTEM_DATABASE_URL` on port 5433.  
   - Prod cleanup runs inside Dokploy against Supabase via `SYSTEM_DATABASE_URL`. Never clean prod from a laptop.

## Cleanup algorithm
Given slug `[a-z0-9_]+`:
1. Lookup  
   ```
   SELECT slug, type, schema_name, db_user
   FROM public.tenants
   WHERE slug = $1;
   ```
2. Authorize  
   - No row → exit.  
   - `type !== 'preview'` and no `--force` → abort.
3. Drop schema  
   ```
   DROP SCHEMA IF EXISTS tenant_<slug> CASCADE;
   ```
4. Drop role  
   ```
   DROP ROLE IF EXISTS tenant_<slug>_user;
   ```
5. Delete registry row  
   ```
   DELETE FROM public.tenants WHERE slug = $1;
   ```
6. Log outcome.

## npm command wiring
```
npm run db:cleanup -- --slug <slug> [--force]
```
- Uses `SYSTEM_DATABASE_URL`.  
- Enforces `type = 'preview'` unless `--force`.  
- Drops schema → drops user → deletes registry row.  
- Dev: `localhost:5433`. Prod: Supabase `10.0.2.4:5433` inside Dokploy.

## CI / PR integration
- PR open/update: `NODE_ENV=production npm run db:init -- --slug pr_42 --preview`
- PR close/merge: `NODE_ENV=production npm run db:cleanup -- --slug pr_42`

(`pr_42` = DB-safe slug derived from PR number.)

## MCP integration (optional)
- Tool example: `cleanupTenant(slug)` → `NODE_ENV=production npm run db:cleanup -- --slug <slug>`
- MCP must not issue raw DROP statements or bypass script safeguards.

## AI & automation rules
- Use `npm run db:cleanup -- --slug <slug>` (or a documented wrapper).  
- Do not run raw DROP/DML against production.  
- Refuse to delete `type != 'preview'` unless explicitly forced in a manual context.

## Summary
- Cleanup targets preview tenants by default.  
- Steps: lookup → enforce type → drop schema → drop role → delete registry row.  
- Entry point: `npm run db:cleanup -- --slug <slug> [--force]`.  
- Design goals: safe, idempotent, scriptable, PR-friendly.
