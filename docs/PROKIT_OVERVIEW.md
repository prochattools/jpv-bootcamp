# ProKit Overview

ProKit is ProChat’s internal SaaS starter (built by Steve Westhoek) for launching micro-SaaS apps quickly. It preserves the existing Next.js + TypeScript + Tailwind/shadcn + Clerk + Postgres/Prisma + Stripe (JPV Bootcamp Stripe account) + Resend + n8n stack while standardizing infra and workflows.

> Stripe note: In this repo, every Stripe reference means the JPV Bootcamp Stripe account.

## Quick links
- Invariants: `docs/PROKIT_INVARIANTS.md`
- Database: `docs/PROKIT_DATABASE.md`
- Dev guide: `docs/PROKIT_DEV_GUIDE.md`
- Infrastructure: `docs/PROKIT_INFRASTRUCTURE.md`
- Tenant cleanup: `docs/PROKIT_TENANT_CLEANUP.md`
- AI rules: `docs/PROKIT_AI_GUIDELINES.md`
- Templates/Reference: `docs/PROKIT_README_TEMPLATE.md`, `docs/PROKIT_README_TRUSTLESS.md`, `docs/PROKIT_REFERENCE.md`
- Getting started: `docs/PROKIT_GETTING_STARTED.md`

## Tenant model (what never changes)
- Single-tenant runtime: one schema per app (`tenant_<APP_SLUG>`) and one DB role (`tenant_<APP_SLUG>_user`).  
- Runtime uses only `DATABASE_URL`; scripts use `SYSTEM_DATABASE_URL`.  
- Registry `public.tenants` is infra-only (provision/cleanup).
- Provision with `npm run db:init -- --slug <slug> [--preview]`; cleanup with `npm run db:cleanup -- --slug <slug> [--force]`; migrations via `npm run db:migrate:dev|prod`.

## Infra expectations
- Dev: Docker Postgres on `localhost:5433`; `npm run dev` bootstraps `.env`, provisions default tenant, runs migrations, and starts Next.js dev server.  
- Prod: Dokploy containers inside a VNet with Supabase Postgres at `10.0.2.4:5433`; Dokploy jobs run the same scripts for provisioning/migrations. Optional MCP bridge can trigger those scripts remotely.

## Day-to-day dev workflow
1. `npm install`  
2. `npm run dev` (auto-writes `.env`, provisions `tenant_dev`, applies migrations, starts Next.js on 3000)  
3. Build: `npm run build`; Prod start: `npm start`  
4. Database tasks: `npm run db:init`, `npm run db:migrate:dev`, `npm run db:migrate:prod`, `npm run db:cleanup`

## AI usage notes
- Follow `docs/PROKIT_AI_GUIDELINES.md` and `docs/PROKIT_INVARIANTS.md`.  
- Do not change the tenant model, env contracts, or provisioning semantics without explicit approval.  
- Keep diffs minimal and reflect infra changes in the docs above.
