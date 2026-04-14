# PROKIT Development Guide

This is the working agreement for building SaaS products with ProKit. It keeps the same intent as the prior boilerplate guide, but with ProKit naming and ProChat context.

## Who/what we’re building for
- Solo indie workflow.
- B2B micro-SaaS that copies proven products, fills gaps, and stays small/sane.
- Default stack: Next.js (App Router preferred), TypeScript, React + Tailwind/shadcn/ui, Clerk, Postgres/Prisma, Resend, Stripe (JPV Bootcamp Stripe account), n8n.

> Stripe note: In this repo, every Stripe reference means the JPV Bootcamp Stripe account.

## Base expectations for ProKit projects
- Layout: `app/` routes, `components/` shared UI, `lib/` utilities, `styles/` for global styling, typed env access.  
- Pattern bias: server components for data/layout; client components only for interactivity.  
- Forms: zod/typed validation + clear errors.  
- State: minimal global state; prefer server actions/URL params/component state.

If the boilerplate isn’t shown, propose a minimal structure and label it “boilerplate proposal.”

## Constraints to honor
- Time: ship fast, use existing libraries, avoid reinvention.  
- Money: keep infra cheap; free/low-cost tiers preferred.  
- Complexity: monolith over microservices; avoid over-engineering.

## Product & feature approach
- Start from proven paid tools and public complaints; ship narrower, sharper versions.  
- Prioritize painkillers over “nice-to-have.”  
- Ideas must be quick to validate; MVP in 1–2 days.

When asked for ideas, give one primary and 1–2 lighter options with ICP, value, monetization, and differentiators.

## Architecture rules
- Monolith Next.js app handles UI + basic APIs/webhooks.  
- Prisma (or similar) with migrations from day one.  
- Logging simple; add Sentry/etc. only when justified.  
- Avoid early microservices/distributed complexity.

## Code quality & tests
- TS strict where reasonable; type APIs/DB/entities.  
- Testing focus: critical units (billing, permissions, core transforms); light integration tests when possible. No 100% coverage goals.

## How to use AI on ProKit work
- Use AI for scaffolding (components/pages/API routes), refactor suggestions, docs, and debugging.  
- Do not swap stack choices casually or introduce experimental patterns without strong justification.

### Workflow expectations when implementing
1) Restate task + assumptions (single-tenant, etc.).  
2) Offer a small plan (3–7 steps).  
3) Ship in small diffs: create file, add function, wire route.  
4) Include env vars, schema changes, and dependencies when needed.

Large refactors should be phased and highlight risk areas (auth, billing, data migrations).

## Business/ethics overlay
- Favor honest UX and clear pricing; avoid dark patterns.  
- Respect `theology.md`; call out conflicts.  
- Prefer recurring revenue from practical B2B niches (e.g., real estate, finance, legal, trades).

## How to respond in this workspace
1) Assume the ProKit stack.  
2) Read `profile.md`, `style.md`, `theology.md`, and any project-specific docs.  
3) Give concise recommendations with concrete steps aligned to stack, constraints, and ethics.  
4) If a request conflicts with this guide or `theology.md`, say so and suggest a compliant alternative.
