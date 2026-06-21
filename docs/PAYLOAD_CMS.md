# Payload CMS — JPV Bootcamp

**Status: live in production as of 2026-06-21 (commit `131e15c`, tag `restore/payload-baseline`)**

Payload CMS is the content management layer added to `jpvbootcamp.com`. It runs alongside WordPress during the gradual WordPress → Payload migration. The two systems coexist: WordPress manages membership and billing; Payload manages structured content, pages, and posts.

---

## URLs

| URL | What it serves |
|-----|---------------|
| `https://jpvbootcamp.com` | Next.js frontend — always |
| `https://jpvbootcamp.com/app` | Payload CMS admin panel |
| `https://portal.jpvbootcamp.com` | WordPress — unchanged |

---

## Tech stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Runtime | Node.js | 20.x |
| Framework | Next.js | 16.2.6 |
| UI library | React | 19.2.7 |
| CMS | Payload | 3.85.1 |
| CMS adapter | `@payloadcms/next` | 3.85.1 |
| CMS database | `@payloadcms/db-postgres` | 3.85.1 |
| CMS editor | `@payloadcms/richtext-lexical` | 3.85.1 |
| CMS UI | `@payloadcms/ui` | 3.85.1 |
| Database | PostgreSQL 15 (Supabase on Azure) | 15.8 |
| ORM (app tables) | Prisma | 6.15.0 |
| Package manager | pnpm | 10.33.0 |
| Language | TypeScript | 5.x |
| Styles | SCSS / CSS modules | sass 1.82.0 |
| Deployment | Docker → Dokploy (Docker Swarm) | — |
| Registry | GHCR (`ghcr.io/prochattools/jpv-bootcamp`) | — |

---

## Architecture

### How Payload is installed

Payload is installed **inside the `jpv-bootcamp` Next.js repo** — not as a separate service or repo. It runs as a Next.js App Router route group `(payload)` and is served from the same Node.js process, the same Docker container, and the same domain as the frontend.

This is the standard, officially supported way to install Payload into an existing Next.js app. No reverse proxy, no separate process.

### Next.js route groups

Next.js App Router uses route groups (folders in parentheses) to split the app into independent layout trees without affecting URLs:

```
src/app/
├── layout.tsx                  # Root layout — returns children only (no html/body)
├── (frontend)/                 # All original website routes
│   ├── layout.tsx              # Frontend html/body/Providers/fonts
│   ├── page.tsx                # /
│   ├── billing/                # /billing/*
│   ├── blog/                   # /blog
│   ├── builders-bootcamp/      # /builders-bootcamp
│   └── ... (all other routes)
└── (payload)/                  # Payload CMS routes — completely separate layout tree
    ├── layout.tsx              # Payload html/body (via RootLayout from @payloadcms/next)
    ├── actions.ts              # serverFunction — top-level 'use server' file
    ├── importMap.js            # Auto-populated by withPayload at build time
    └── app/
        └── [[...segments]]/
            └── page.tsx        # Renders all Payload admin pages at /app/*
```

The `(frontend)` and `(payload)` groups share zero layout — each has its own `<html>` and `<body>`. Payload's `RootLayout` component provides its own full HTML document. The frontend layout provides its own with ThemeProvider, fonts, and global styles.

URLs are **not affected** by route groups. `/builders-bootcamp` still resolves correctly even though the file is at `src/app/(frontend)/builders-bootcamp/page.tsx`.

### Payload REST API

```
src/app/api/[...slug]/route.ts   # Payload REST catch-all
```

This catch-all handles Payload's REST API endpoints (e.g., `GET /api/payload-users`, `POST /api/payload-posts`). Named routes defined in `src/app/api/` take priority over this catch-all — existing API routes are not affected.

### Key files

| File | Purpose |
|------|---------|
| `src/payload.config.ts` | Payload configuration: collections, DB adapter, admin route, secret |
| `src/app/(payload)/layout.tsx` | Imports `@payloadcms/next/css` and wraps children in Payload's `RootLayout` |
| `src/app/(payload)/actions.ts` | Exports `serverFunction` as a top-level `'use server'` file (required for Next.js server action serialization) |
| `src/app/(payload)/app/[[...segments]]/page.tsx` | Delegates to Payload's `RootPage` for all admin views |
| `src/app/api/[...slug]/route.ts` | Payload REST API catch-all |
| `src/migrations/20260620_213328.ts` | Initial Payload migration: creates all 13 `payload_*` tables |
| `src/migrations/index.ts` | Migration registry — imported by `prodMigrations` in the DB adapter |

---

## Database

### Connection

Payload uses the same `DATABASE_URL` environment variable as the existing Prisma-managed app. There is no separate database connection for Payload.

```dotenv
DATABASE_URL=postgresql://jpvbootcamp_user:<password>@10.0.2.4:5433/postgres?schema=jpvbootcamp
```

The `cleanDbUrl()` function in `payload.config.ts` strips the `?schema=jpvbootcamp` query parameter before passing the URL to Payload's pg pool — `pg` does not understand that Prisma-specific parameter and would reject the connection with it present. The `schemaName: 'jpvbootcamp'` option in the adapter sets the PostgreSQL `search_path` instead.

### Schema ownership split

Both Prisma and Payload manage tables in the `jpvbootcamp` schema. They are kept completely separate by naming convention:

| Manager | Table naming | Who touches them |
|---------|-------------|-----------------|
| Prisma | No prefix (e.g., `Subscription`, `customer_provisioning`) | App code + Prisma migrations only |
| Payload | `payload_` prefix on all tables | Payload CMS only — never touch from Prisma |

**Rule: Prisma never references `payload_*` tables. Payload never references app tables.**

### Full table inventory

**App tables (Prisma-managed) — 11 tables:**

| Table | Description |
|-------|-------------|
| `Audiences` | Email audience segments |
| `Project` | Tenant/project records |
| `Subscription` | Stripe subscription records |
| `_prisma_migrations` | Prisma migration history |
| `customer_provisioning` | Customer provisioning state |
| `email_subscribers` | Email subscriber list |
| `partner_clicks` | Affiliate link click tracking |
| `partner_sessions` | Affiliate session records |
| `sponsored_applications` | Sponsored seat applications |
| `sponsored_grants` | Approved sponsored grants |
| `sponsored_seats` | Available sponsored seats |
| `stripe_webhook_events` | Stripe webhook event log (idempotency) |

**Payload baseline tables (Payload-managed, `restore/payload-baseline`) — 13 tables:**

| Table | Description |
|-------|-------------|
| `payload_categories` | Post/page categories |
| `payload_kv` | Payload internal key-value store |
| `payload_locked_documents` | Document lock records (prevents concurrent edits) |
| `payload_locked_documents_rels` | Relationships for locked documents |
| `payload_media` | Uploaded media file metadata |
| `payload_migrations` | Payload migration history |
| `payload_pages` | CMS pages |
| `payload_posts` | CMS posts and articles |
| `payload_posts_rels` | Relationships for post categories |
| `payload_preferences` | Per-user admin UI preferences |
| `payload_preferences_rels` | Relationships for preferences |
| `payload_users` | CMS admin users |
| `payload_users_sessions` | CMS user session records |

**Course system feature branch state (`feature/course-branding-and-preview`):**

The branch registers the original visual prototype collections plus the first production-oriented course-system scaffolding:

| Area | Collection files | Purpose |
|------|------------------|---------|
| Visual course prototype | `src/collections/PayloadCoursePrototype.ts` | Demo course/module/lesson/access-label records. Still not authoritative access control. |
| Members | `src/collections/members/` | Student/client auth collection, member profile, member security events. |
| Course runtime | `src/collections/courses/` | Lesson resources, enrollments, lesson progress. |
| Access control | `src/collections/access/` | Access groups, policies, grants, entitlement events. |
| Billing mirror | `src/collections/billing/` | Stripe customer/subscription/payment/event/action records for admin visibility. |
| CRM/email | `src/collections/crm/` | Contacts, tags, notes, email templates/events, admin notifications. |
| Community | `src/collections/community/` | Member groups, spaces, memberships, posts, comments, files, chat threads/messages. |
| Audit | `src/collections/audit/` | Admin/member/system audit events. |

`src/migrations/20260621_194424_course_system_phase1.ts` creates these additional Payload-managed tables and updates Payload internal relationship tables. In staging, this brings `jpvbootcamp_staging` to 56 `payload_*` tables.

`src/lib/payloadCourse/accessService.ts` is the first runtime service boundary for course and lesson access. It reads Payload collections through the server-side Local API and then delegates the actual allow/deny decision to `src/lib/entitlements/evaluateAccess.ts`; user-facing routes must use this service boundary or an equivalent fail-closed check before fetching private content.

`src/lib/payloadCourse/adminGrants.ts` and `src/lib/members/accountStatus.ts` are the first admin mutation service boundaries. They write access grants/revokes, member block/restores, audit events, entitlement/security events, and queued email-event records. They do not send Resend email directly.

`pnpm payload:course:reconcile` runs the read-only entitlement reconciliation dry-run. It compares members, published courses, policies, subscriptions, active grants, and effective course access decisions. On the current staging seed state it reports 0 members, 3 courses, 6 policies, and 0 issues.

`pnpm payload:course:seed` dry-runs the course-system admin seed plan. `pnpm payload:course:seed -- --apply` writes the seed records. The current staging seed is 3 courses, 5 lessons, 4 access groups, 3 spaces, 7 email templates, and 6 access policies. These records are scaffolding/admin demo data until Stripe shadow sync, member login, and migration reconciliation are complete.

`src/lib/payloadCourse/stripeShadowSync.ts` mirrors verified Stripe events into the Payload billing/member/contact projection only when `PAYLOAD_BILLING_SHADOW_SYNC_ENABLED=1|true|yes|on`. It writes by Payload Local API, keeps the existing WordPress/FluentCRM webhook behavior unchanged, and catches mirror failures so Stripe webhook processing can continue. Keep the flag disabled until staging replay and reconciliation are approved.

`src/lib/payloadCourse/emailSender.ts` sends queued `payload_email_events` through active `payload_email_templates` using Resend's SDK idempotency key option. `pnpm payload:email:send` dry-runs queued sends without updating delivery state; `pnpm payload:email:send -- --apply` is required to send or mark send failures. There is no scheduler/cron enabled yet.

### Migrations

Payload manages its own migrations via the `prodMigrations` option in `postgresAdapter`:

```ts
db: postgresAdapter({
  pool: { connectionString: cleanDbUrl(process.env.DATABASE_URL) },
  schemaName: getDbSchema(process.env.DATABASE_URL),
  prodMigrations: migrations,  // auto-applies on startup in production
}),
```

Payload migrations run automatically when the container starts. They are idempotent — already-applied migrations (tracked in `payload_migrations`) are skipped. New Payload collections are not production-safe until their migration exists and has been reviewed.

Prisma migrations continue to run via `deploy-prod.sh` → `npm run db:migrate:prod` as before.

`deploy-prod.sh` also normalizes schema object ownership to the tenant user after admin-run Prisma migrations. This is required because Payload startup migrations use the tenant `DATABASE_URL`; the tenant role must own existing `payload_*` tables it needs to alter.

---

## Collections

Collections are Payload's equivalent of database tables / content types. Each collection maps to one or more database tables.

| Collection slug | DB table | Purpose |
|-----------------|----------|---------|
| `payload_users` | `payload_users` + `payload_users_sessions` | CMS admin users — not Clerk/WP users |
| `payload_media` | `payload_media` | Uploaded files and images |
| `payload_pages` | `payload_pages` | Static CMS pages (landing pages, etc.) |
| `payload_posts` | `payload_posts` + `payload_posts_rels` | Blog posts and articles |
| `payload_categories` | `payload_categories` | Taxonomy for posts and pages |

Collection definitions live in `src/collections/`. The `slug` is the API identifier; `dbName` sets the actual PostgreSQL table name.

### Course prototype collections

The course prototype collections are visual proof-of-concept structures only:

| Collection slug | Purpose | Production caveat |
|-----------------|---------|-------------------|
| `payload_courses` | Prototype course details, labels, and mock progress | Must be redesigned before becoming the authoritative course collection |
| `payload_course_modules` | Prototype ordered course sections | Safe only as demo data until migration and access model are approved |
| `payload_lessons` | Prototype lesson content, media labels, mock completion, visual lock state | Visual lock state is not authorization |
| `payload_course_access_preview` | Static access labels such as Free, Pro, VIP, Manual, Private | Never use this collection for real access decisions |

For the full course, billing, CRM, group, and migration plan, use `docs/PAYLOAD_COURSE_VISUAL_IMPLEMENTATION_PLAN.md`.

### PayloadPosts fields

| Field | Type | Notes |
|-------|------|-------|
| `title` | text | Required |
| `slug` | text | Unique, indexed |
| `content` | richText (Lexical) | Full rich text editor |
| `status` | select | `draft` \| `published` |
| `categories` | relationship (hasMany) | Links to `payload_categories` |

### PayloadPages fields

| Field | Type | Notes |
|-------|------|-------|
| `title` | text | Required |
| `slug` | text | Unique, indexed |
| `content` | richText (Lexical) | Full rich text editor |

---

## Admin panel

**URL**: `https://jpvbootcamp.com/app`

The admin route is `/app` because `/admin` is already used by the existing application (Clerk-authenticated admin pages). Configured in `payload.config.ts`:

```ts
routes: {
  admin: '/app',
},
```

**Admin users** (`payload_users`) are independent from all other user systems (Clerk auth, WordPress users, Stripe customers). A user in `payload_users` has access only to the Payload admin panel and has no connection to any subscription or billing record.

---

## Environment variables

```dotenv
# Required for Payload — must be set in Dokploy environment
PAYLOAD_SECRET=<random 32+ character string>
NEXT_PUBLIC_SERVER_URL=https://jpvbootcamp.com

# Shared with existing app — already set, no change needed
DATABASE_URL=postgresql://...
```

`PAYLOAD_SECRET` signs authentication cookies and JWT tokens. It must be a strong, stable random string. Changing it invalidates all active Payload sessions.

---

## Restore points

| Tag | State | How to restore |
|-----|-------|----------------|
| `restore/pre-payload` | Application WITHOUT Payload | `git checkout restore/pre-payload` + redeploy |
| `restore/payload-baseline` | First clean working Payload install (= current `main`) | `git checkout restore/payload-baseline` + redeploy |

---

## Guardrails

- Do not rename or remove the `payload_` prefix from any collection `dbName` — changing a table name after data exists will cause data loss without a migration
- Do not modify Prisma tables from Payload hooks; do not modify Payload tables from Prisma
- `payload_users` is for CMS editorial users only — not Stripe customers, Clerk users, or WordPress members
- Payload's auto-migration on startup is safe and idempotent
- Keep `DATABASE_URL` and `SYSTEM_DATABASE_URL` semantics unchanged — Payload only reads `DATABASE_URL`
- Do not add `payload_*` tables to `prisma/system.prisma` — Payload owns them exclusively
- The Payload Stripe plugin is not installed — do not confuse Payload's `/api/*` REST routes with the existing `/api/webhook/stripe` handler
- Do not treat visual course prototype labels or badges as access control
- Do not deploy registered Payload collections without a corresponding reviewed Payload migration

---

## References

- Database details: `docs/PROKIT_DATABASE.md`
- Infrastructure: `docs/PROKIT_INFRASTRUCTURE.md`
- WordPress → Payload migration: `docs/PAYLOAD_MIGRATION.md`
- Payload course system plan: `docs/PAYLOAD_COURSE_VISUAL_IMPLEMENTATION_PLAN.md`
- Stripe flow: `docs/STRIPE_MEMBERSHIP_FLOW.md`
- ProKit invariants: `docs/PROKIT_INVARIANTS.md`
