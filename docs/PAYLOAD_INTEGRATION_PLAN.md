# Payload CMS Integration Plan

This document is the canonical implementation plan for adding Payload CMS to the `jpv-bootcamp` Next.js repo. Code must follow this plan step by step. Nothing is done outside this plan without updating it first.

## Strategy

- **No migration from `jpv-bootcamp-app`** — that scaffold was reference only; it is deleted in Phase 0
- **Side-by-side with WordPress** — both systems run simultaneously; WordPress handles membership/billing/WP provisioning; Payload handles content
- **One repo** — Payload is installed inside `jpv-bootcamp`, not a separate service
- **One database** — the existing `jpvbootcamp` Supabase schema; all Payload tables prefixed with `payload_`
- **Non-destructive** — no existing tables, routes, env vars, or automations are altered
- **Database last** — all local work is completed and verified before any production DB changes
- **Always revertible** — every phase ends with a git commit; reverting means `git checkout main`

## Restore points

| Point | How to revert |
|-------|---------------|
| Before anything starts | `git checkout main` in `jpv-bootcamp` |
| After docs committed | `git checkout main` (discards feature branch) |
| After npm→pnpm | `git checkout main` (restores `package.json`, `package-lock.json`) |
| After Next.js upgrade | `git checkout main` |
| After React upgrade | `git checkout main` |
| After Payload install | `git checkout main` |

**The `main` branch is always the safe restore point. All work happens on `feature/payload-integration`.**

---

## Phase 0 — Groundwork (local only, no database changes)

### Step 0.1 — Commit existing doc changes to main

The 8 documentation files updated in the prior session must be committed to `main` before branching. This locks in the doc changes as a stable snapshot and makes `main` a clean restore point.

```bash
cd jpv-bootcamp
git add docs/PROKIT_AI_GUIDELINES.md docs/PROKIT_DATABASE.md docs/PROKIT_DEV_GUIDE.md \
        docs/PROKIT_INFRASTRUCTURE.md docs/PROKIT_INVARIANTS.md docs/PROKIT_OVERVIEW.md \
        docs/STRIPE_MEMBERSHIP_FLOW.md docs/PAYLOAD_CMS.md docs/PAYLOAD_INTEGRATION_PLAN.md
git commit -m "docs: add Payload CMS integration documentation"
```

**Restore point**: `git checkout main` will always restore to this commit.

### Step 0.2 — Create feature branch

All implementation work happens here. `main` is never touched again until the feature is complete and verified.

```bash
git checkout -b feature/payload-integration
```

**Verification**: `git branch` shows `* feature/payload-integration`.

### Step 0.3 — Delete jpv-bootcamp-app

The `jpv-bootcamp-app` repo was a reference scaffold with no live data. It is now safe to delete because:
- All architecture decisions are documented in this plan and `docs/PAYLOAD_CMS.md`
- All collection patterns from it are replicated in Steps 3–4 of Phase 1

```bash
# Verify it has no live data worth keeping
rm -rf /Users/Office/Repos/prochattools/clients/jc-citadel/jpv-bootcamp-app
```

**Verification**: Directory no longer exists. Nothing in `jpv-bootcamp` references it.

### Step 0.4 — Switch from npm to pnpm

Payload requires pnpm. The existing `jpv-bootcamp` uses npm. This step converts the project.

```bash
# Install pnpm globally if not already installed
npm install -g pnpm

# In jpv-bootcamp root:
# 1. Remove npm lockfile
rm package-lock.json

# 2. Add pnpm engine constraint to package.json
# Add: "pnpm": "^9 || ^10" under "engines"

# 3. Add .npmrc for pnpm
echo "shamefully-hoist=true" > .npmrc

# 4. Install with pnpm (generates pnpm-lock.yaml)
pnpm install
```

**Verification**: `pnpm-lock.yaml` exists; `node_modules` was installed by pnpm; `pnpm dev` starts the app on port 3000.

**Revert if broken**: `git checkout main` restores `package.json` and `package-lock.json`; `npm install` works again.

Commit after verification:
```bash
git add package.json package-lock.json pnpm-lock.yaml .npmrc
git commit -m "chore: switch from npm to pnpm"
```

### Step 0.5 — Upgrade Next.js 14 → 16

Payload 3.85.1 requires Next.js 16. This is a major upgrade — Next.js 15 and 16 have breaking changes.

**Known breaking changes to check:**
- `next/headers` API changes (async in Next.js 15+)
- `next/image` defaults changed
- Route segment config types changed
- Metadata API changes

```bash
pnpm add next@16.2.6 eslint-config-next@16.2.6
```

Then run the Next.js codemod for automatic migrations:
```bash
npx @next/codemod@latest next-async-request-api .
```

**Verification**: `pnpm build` completes without errors. Manually test:
- `http://localhost:3000` (homepage loads)
- `http://localhost:3000/api/health` returns 200
- No TypeScript errors: `pnpm tsc --noEmit`

**Revert if broken**: `git checkout feature/payload-integration` at pre-upgrade state, or `git checkout main` to abandon entirely.

Commit after verification:
```bash
git add -A
git commit -m "chore: upgrade Next.js 14 to 16"
```

### Step 0.6 — Upgrade React 18 → 19

Payload 3.85.1 requires React 19.

**Known breaking changes to check:**
- Clerk components (verify `@clerk/nextjs` supports React 19)
- Radix UI components (verify all `@radix-ui/*` packages support React 19)
- `react-hot-toast` compatibility
- `formik` compatibility

```bash
pnpm add react@19 react-dom@19
pnpm add -D @types/react@19 @types/react-dom@19
```

**Verification**: `pnpm build` completes. Manually test:
- All pages render without hydration errors
- Clerk sign-in flow works
- No console errors on homepage

**Revert if broken**: `git checkout main` and report which specific dependency is incompatible.

Commit after verification:
```bash
git add -A
git commit -m "chore: upgrade React 18 to 19"
```

### Step 0.7 — Verify all existing critical routes

Before touching Payload, confirm every existing automation endpoint still works:

```bash
# Health check
curl http://localhost:3000/api/health

# Build succeeds
pnpm build

# TypeScript clean
pnpm tsc --noEmit

# Lint clean
pnpm lint
```

Also manually verify in browser:
- [ ] Homepage loads
- [ ] Clerk auth middleware works (protected routes redirect to sign-in)
- [ ] No console errors

**If anything is broken here, stop and fix before proceeding to Phase 1.**

Commit if any fixes were needed:
```bash
git add -A
git commit -m "fix: compatibility fixes for Next.js 16 / React 19"
```

---

## Phase 1 — Install Payload CMS (local only, no database changes)

All steps in Phase 1 work locally. No production database is touched. Payload's auto-migration only runs when connecting to a database — which is deferred to Phase 2.

### Step 1 — Install Payload dependencies

```bash
pnpm add payload@3.85.1 @payloadcms/next@3.85.1 @payloadcms/db-postgres@3.85.1 \
         @payloadcms/richtext-lexical@3.85.1 @payloadcms/ui@3.85.1
```

**Verification**: `node_modules/payload` exists; `pnpm tsc --noEmit` still passes.

Commit:
```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add Payload CMS dependencies"
```

### Step 2 — Add env vars

Add to `.env` (local dev):

```dotenv
PAYLOAD_SECRET=<generate-random-32-char-secret>
NEXT_PUBLIC_SERVER_URL=http://localhost:3000
```

For production (Dokploy), these will be added in Phase 2:
```dotenv
PAYLOAD_SECRET=<same-or-different-production-secret>
NEXT_PUBLIC_SERVER_URL=https://jpvbootcamp.com
```

> `PAYLOAD_SECRET` must be a strong random string (32+ characters).

Update `.env.example` with these two new keys (no values). Commit `.env.example` — never commit `.env`.

```bash
git add .env.example
git commit -m "chore: add Payload env vars to .env.example"
```

### Step 3 — Create payload.config.ts

Create `src/payload.config.ts`:

```ts
import path from 'path'
import { fileURLToPath } from 'url'
import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { PayloadUsers } from './collections/PayloadUsers'
import { PayloadMedia } from './collections/PayloadMedia'
import { PayloadPages } from './collections/PayloadPages'
import { PayloadPosts } from './collections/PayloadPosts'
import { PayloadCategories } from './collections/PayloadCategories'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: 'payload_users',
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  routes: {
    admin: '/app',
  },
  collections: [
    PayloadUsers,
    PayloadMedia,
    PayloadPages,
    PayloadPosts,
    PayloadCategories,
  ],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL,
    },
    schemaName: 'jpvbootcamp',
  }),
  serverURL: process.env.NEXT_PUBLIC_SERVER_URL,
})
```

**Verification**: `pnpm tsc --noEmit` passes.

### Step 4 — Create collections

Create `src/collections/PayloadUsers.ts`:
```ts
import type { CollectionConfig } from 'payload'

export const PayloadUsers: CollectionConfig = {
  slug: 'payload_users',
  dbName: 'payload_users',
  auth: true,
  admin: { useAsTitle: 'email' },
  fields: [],
}
```

Create `src/collections/PayloadMedia.ts`:
```ts
import type { CollectionConfig } from 'payload'
import path from 'path'
import { fileURLToPath } from 'url'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export const PayloadMedia: CollectionConfig = {
  slug: 'payload_media',
  dbName: 'payload_media',
  upload: {
    staticDir: path.resolve(dirname, '../../public/media'),
  },
  fields: [
    { name: 'alt', type: 'text', required: true },
  ],
}
```

Create `src/collections/PayloadCategories.ts`:
```ts
import type { CollectionConfig } from 'payload'

export const PayloadCategories: CollectionConfig = {
  slug: 'payload_categories',
  dbName: 'payload_categories',
  admin: { useAsTitle: 'title' },
  fields: [
    { name: 'title', type: 'text', required: true },
  ],
}
```

Create `src/collections/PayloadPosts.ts`:
```ts
import type { CollectionConfig } from 'payload'

export const PayloadPosts: CollectionConfig = {
  slug: 'payload_posts',
  dbName: 'payload_posts',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'createdAt'],
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', unique: true, index: true },
    { name: 'content', type: 'richText' },
    {
      name: 'status',
      type: 'select',
      options: ['draft', 'published'],
      defaultValue: 'draft',
    },
    {
      name: 'categories',
      type: 'relationship',
      relationTo: 'payload_categories',
      hasMany: true,
    },
  ],
  timestamps: true,
}
```

Create `src/collections/PayloadPages.ts`:
```ts
import type { CollectionConfig } from 'payload'

export const PayloadPages: CollectionConfig = {
  slug: 'payload_pages',
  dbName: 'payload_pages',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'createdAt'],
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', unique: true, index: true },
    { name: 'content', type: 'richText' },
  ],
  timestamps: true,
}
```

**Verification**: `pnpm tsc --noEmit` passes.

### Step 5 — Wire Payload into Next.js

Add `@payload-config` path alias to `tsconfig.json`:
```json
{
  "compilerOptions": {
    "paths": {
      "@payload-config": ["./src/payload.config.ts"]
    }
  }
}
```

Create `src/app/(payload)/layout.tsx`:
```tsx
import React from 'react'
export default function PayloadLayout({ children }: { children: React.ReactNode }) {
  return children
}
```

Create `src/app/(payload)/app/[[...segments]]/page.tsx`:
```tsx
import type { Metadata } from 'next'
import { RootPage, generatePageMetadata } from '@payloadcms/next/views'
import config from '@payload-config'

export const generateMetadata = ({ params }: { params: { segments: string[] } }): Promise<Metadata> =>
  generatePageMetadata({ config, params })

export default function Page({ params }: { params: { segments: string[] } }) {
  return RootPage({ config, params })
}
```

Create `src/app/(payload)/app/[[...segments]]/not-found.tsx`:
```tsx
export default function NotFound() {
  return <div>404 — Not Found</div>
}
```

**Verification**: `pnpm build` completes without errors.

### Step 6 — Generate types and import map

```bash
# These commands require DATABASE_URL to be set but will fail gracefully if DB unreachable
pnpm payload generate:types
pnpm payload generate:importmap
```

> If the local database is not available, `generate:types` can be skipped until Phase 2. The build and admin UI still work; only the generated `payload-types.ts` will be missing.

Commit all Phase 1 work:
```bash
git add -A
git commit -m "feat: add Payload CMS to jpv-bootcamp (local, pre-DB)"
```

### Step 7 — Local smoke test (no production DB)

Build and run locally:
```bash
pnpm build
pnpm start
```

Verify:
- [ ] `http://localhost:3000` — existing frontend loads
- [ ] `http://localhost:3000/app` — Payload admin login screen appears (will show DB error until Phase 2)
- [ ] `http://localhost:3000/api/health` — returns 200
- [ ] No existing routes are broken

---

## Phase 2 — Database (production only, Dokploy)

**Only proceed to Phase 2 after Phase 1 is fully verified locally.**

Phase 2 is the only point where the production Supabase database is touched. Because Payload's `payload_*` tables are entirely separate from all Prisma tables, there is zero risk of data loss or interference with existing tables.

### Step 8 — Add env vars to Dokploy

In Dokploy environment settings, add:
```
PAYLOAD_SECRET=<strong-random-32-char-string>
NEXT_PUBLIC_SERVER_URL=https://jpvbootcamp.com
```

`DATABASE_URL` is already set. No other changes.

### Step 9 — Deploy to Dokploy

The feature branch is merged to `main` and pushed. Dokploy deploys.

On first startup, Payload auto-creates its tables:
- `payload_users`
- `payload_posts`
- `payload_pages`
- `payload_media`
- `payload_categories`
- `payload_migrations`
- `payload_preferences`
- `payload_sessions`

These are created non-destructively alongside existing Prisma tables.

**Verification via psql** (inside Dokploy VNet or MCP bridge):
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'jpvbootcamp'
  AND table_name LIKE 'payload_%'
ORDER BY table_name;
```

### Step 10 — Smoke test production

- [ ] `https://jpvbootcamp.com` loads (frontend unaffected)
- [ ] `https://jpvbootcamp.com/app` shows Payload admin login
- [ ] Create first admin user in Payload
- [ ] `https://jpvbootcamp.com/api/health` returns 200
- [ ] `https://jpvbootcamp.com/api/webhook/stripe` still responds correctly
- [ ] Run: `stripe trigger checkout.session.completed` — verify WP provisioning flow fires

### Step 11 — Verify all existing automations

Run through critical existing flows:
- [ ] Stripe checkout → WP provisioning → Resend email
- [ ] Billing portal redirect works
- [ ] Entitlements sync works
- [ ] FluentCRM tag sync works

---

## Rollback plan (any phase)

### Phase 0 / Phase 1 rollback (local only)
```bash
git checkout main
npm install   # restores npm + Next.js 14 + React 18
```
No database was touched. Full revert in under a minute.

### Phase 2 rollback (if production deploy breaks something)
1. Revert deploy in Dokploy to the previous `main` commit
2. `payload_*` tables in the database can remain — they are completely inert to the existing app
3. Remove `PAYLOAD_SECRET` and `NEXT_PUBLIC_SERVER_URL` from Dokploy env (optional cleanup)

The existing `customer_provisioning`, `stripe_webhook_events`, `Subscription`, `Project` tables and all Stripe/WP automations are **never touched by any step in this plan**.

---

## What is NOT in this plan

- No migration of content from WordPress to Payload (future phase)
- No Clerk/Payload user sync (Payload users are editorial users only)
- No Payload Stripe plugin (existing Stripe webhook handler is sufficient; plugin can be added later)
- No changes to `prisma/system.prisma`
- No changes to existing API routes
- No changes to existing env vars
