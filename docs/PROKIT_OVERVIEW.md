# ProKit Overview

ProKit is ProChat’s internal SaaS starter (built by Steve Westhoek) for launching micro-SaaS apps quickly. It preserves the existing Next.js + TypeScript + Tailwind/shadcn + Clerk + Postgres/Prisma + Stripe (JPV Bootcamp Stripe account) + Resend + n8n stack while standardizing infra and workflows.

The `jpv-bootcamp` app also includes **Payload CMS** as a content layer alongside WordPress. Both CMS systems run side by side: WordPress handles membership, billing, and WP user provisioning; Payload handles structured content and editorial workflows. The Payload admin panel is accessible at `/app`.

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
- **Payload CMS**: `docs/PAYLOAD_CMS.md`
- **Payload integration plan**: `docs/PAYLOAD_INTEGRATION_PLAN.md`

## Tenant model (what never changes)
- Single-tenant runtime: one schema per app (`tenant_<APP_SLUG>`) and one DB role (`tenant_<APP_SLUG>_user`).  
- Runtime uses only `DATABASE_URL`; scripts use `SYSTEM_DATABASE_URL`.  
- Registry `public.tenants` is infra-only (provision/cleanup).
- Provision with `npm run db:init -- --slug <slug> [--preview]`; cleanup with `npm run db:cleanup -- --slug <slug> [--force]`; migrations via `npm run db:migrate:dev|prod`.

## Infra expectations
- Dev: Docker Postgres on `localhost:5444`; `npm run dev` bootstraps `.env`, provisions default tenant, runs migrations, and starts Next.js dev server.  
- Prod: Dokploy containers inside a VNet with Supabase Postgres at `10.0.2.4:5433`; Dokploy jobs run the same scripts for provisioning/migrations. Optional MCP bridge can trigger those scripts remotely.

## Day-to-day dev workflow
1. `nvm use 20` (Payload requires Node 20; `.nvmrc` is set)
2. `pnpm install` (pnpm is required for Payload)
3. `pnpm dev` (auto-writes `.env`, provisions `tenant_dev`, applies Prisma migrations, starts Next.js on 3000; Payload auto-migrates its own tables on first run)
4. Build: `pnpm build`; Prod start: `pnpm start`
5. Database tasks: `npm run db:init`, `npm run db:migrate:dev`, `npm run db:migrate:prod`, `npm run db:cleanup`
6. Payload tasks: `pnpm payload generate:types`, `pnpm payload generate:importmap`

> **Note**: The project uses pnpm (enforced by `engines.pnpm` in `package.json`). `npm run` commands for DB scripts still work; use pnpm for Next.js / Payload commands.

## AI usage notes
- Follow `docs/PROKIT_AI_GUIDELINES.md` and `docs/PROKIT_INVARIANTS.md`.  
- Do not change the tenant model, env contracts, or provisioning semantics without explicit approval.  
- Keep diffs minimal and reflect infra changes in the docs above.
