# Payload CMS — JPV Bootcamp

Payload CMS is the content management layer added to `jpvbootcamp.com` alongside the existing WordPress installation. Both CMS systems run side by side during the gradual WordPress → Payload migration.

## Philosophy

WordPress continues to manage membership, FluentCRM tags, billing portal handoffs, and WP user provisioning. Payload manages structured content, pages, posts, and the editorial workflow. The two systems share the same Supabase PostgreSQL database (different tables, same schema) and are accessed via different URLs:

- `https://jpvbootcamp.com` — Next.js frontend (always)
- `https://jpvbootcamp.com/app` — Payload CMS admin panel
- `https://portal.jpvbootcamp.com` — WordPress site (unchanged)

## Architecture

### Integration approach

Payload CMS is installed **inside the `jpv-bootcamp` Next.js repo** — not a separate repo or service. It runs as a Next.js route group `(payload)` nested under `/app`, which makes the admin panel available at `/app` without affecting any other routes.

### Database

- **Schema**: `jpvbootcamp` (same schema as existing Prisma tables)
- **Table prefix**: All Payload-managed tables use `payload_` prefix via `dbName` on each collection
- **Adapter**: `@payloadcms/db-postgres` with `schemaName: 'jpvbootcamp'`
- **Migration manager**: Payload manages its own `payload_*` tables autonomously (auto-migrates on startup)
- **No conflict**: Prisma manages its tables (`customer_provisioning`, `stripe_webhook_events`, `Subscription`, `Project`, etc.); Payload manages only `payload_*` tables

### Dual migration managers

| Manager | Tables | Trigger |
|---------|--------|---------|
| Prisma | All non-`payload_*` tables | `npm run db:migrate:dev` / `db:migrate:prod` |
| Payload | All `payload_*` tables | Auto-applied on startup (Payload manages its own migrations) |

Both managers target the same `jpvbootcamp` schema via the same `DATABASE_URL`.

### Connection strings

Payload uses the existing `DATABASE_URL` (tenant-scoped runtime connection):

```
DATABASE_URL=postgresql://jpvbootcamp_user:<password>@10.0.2.4:5433/jpvbootcamp?schema=jpvbootcamp
```

`SYSTEM_DATABASE_URL` is not used by Payload — only by provisioning scripts.

## Admin route

The admin panel lives at `/app` (not the default `/admin`). This is configured via:

```ts
// payload.config.ts
admin: {
  user: 'payload_users',
  routePrefix: '/app',
}
```

The Next.js route group at `src/app/(payload)/app/[[...segments]]/page.tsx` maps the `/app` path to Payload's admin handler.

## Collections

All collections use `dbName` to prefix their PostgreSQL table names with `payload_`, preventing any collision with Prisma-managed tables.

| Collection slug | Table name | Purpose |
|-----------------|------------|---------|
| `payload_users` | `payload_users` | CMS admin users (separate from Clerk/WP users) |
| `payload_media` | `payload_media` | Uploaded files and images |
| `payload_pages` | `payload_pages` | Static CMS pages |
| `payload_posts` | `payload_posts` | Blog posts and articles |
| `payload_categories` | `payload_categories` | Post/page categories |

> Stripe note: In this repo, every Stripe reference means the JPV Bootcamp Stripe account.

## Stripe plugin

The `@payloadcms/plugin-stripe` plugin is included to:
- Add a `stripeCustomerID` field to the `payload_users` collection
- Register `/api/stripe/webhooks` (Payload's webhook endpoint — separate from existing `/api/webhook/stripe`)
- Register `/api/stripe/rest` for Stripe REST proxy operations

**Important**: The existing Stripe webhook handler at `/api/webhook/stripe` is NOT touched by the Payload Stripe plugin. They coexist at different paths. The existing webhook flow (WP provisioning, FluentCRM sync, Resend emails) continues unchanged.

## Environment variables

Add these to `.env` / Dokploy environment:

```dotenv
# Payload CMS
PAYLOAD_SECRET=<generate-random-32-char-secret>
NEXT_PUBLIC_SERVER_URL=https://jpvbootcamp.com

# DATABASE_URL is shared with existing app — no new variable needed
```

> `PAYLOAD_SECRET` must be a strong random string (32+ characters). It signs auth cookies and tokens.

## Node and package manager requirements

- **Node**: 20.x (Payload 3.x requires Node ≤ 20; `.nvmrc` contains `"20"`)
- **Package manager**: pnpm (Payload scaffold requires pnpm; `package.json` enforces `pnpm: ^9 || ^10`)
- **Next.js**: 16.2.6 (Payload 3.85.1 requires Next.js 16)

## File structure (within jpv-bootcamp)

```
src/
├── app/
│   ├── (frontend)/         # Existing frontend routes (unchanged)
│   └── (payload)/
│       └── app/
│           └── [[...segments]]/
│               └── page.tsx  # Payload admin handler
├── collections/
│   ├── PayloadUsers.ts
│   ├── PayloadMedia.ts
│   ├── PayloadPages.ts
│   ├── PayloadPosts.ts
│   └── PayloadCategories.ts
└── payload.config.ts
```

## Guardrails

- Do not rename or remove the `payload_` prefix from any collection `dbName` — changing a table name after data exists will cause data loss
- Do not modify Prisma tables from Payload hooks, and do not modify Payload tables from Prisma
- The `payload_users` collection is for CMS editorial users only — not for Stripe customers, Clerk users, or WP members
- Payload's auto-migration on startup is safe and non-destructive (creates tables if missing, applies schema changes via its own migration system)
- Keep `DATABASE_URL` and `SYSTEM_DATABASE_URL` semantics unchanged — Payload only uses `DATABASE_URL`

## References

- Integration plan: `docs/PAYLOAD_INTEGRATION_PLAN.md`
- Database model: `docs/PROKIT_DATABASE.md`
- Infrastructure: `docs/PROKIT_INFRASTRUCTURE.md`
- ProKit invariants: `docs/PROKIT_INVARIANTS.md`
- Stripe flow: `docs/STRIPE_MEMBERSHIP_FLOW.md`
- Stripe WP provisioning: `docs/STRIPE_WP_PROVISIONING.md`
