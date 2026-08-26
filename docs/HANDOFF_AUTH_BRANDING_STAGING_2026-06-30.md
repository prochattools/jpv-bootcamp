# Handoff: Staging Schema Repair, Payload Branding, and Member Authentication

Date: 2026-06-30
Repository: `prochattools-jpv-bootcamp`
Locked branch: `feature/course-branding-and-preview`

## Non-negotiable guardrails

- Work only on `feature/course-branding-and-preview`.
- Never access, modify, switch, stage, commit, push, merge, reset, rebase, or deploy `main`.
- Never access or modify the sibling worktree `jpv-bootcamp-main`.
- Preserve `.graphifyignore` exactly and never stage it.
- Do not regenerate Graphify.
- Use Node 20 only through `nvm exec 20` for validation.
- Never deploy production or `latest`.
- Do not run SQL, Payload migrations, migration status, Prisma migrations, seeds, or database initialization unless a later prompt explicitly authorizes staging-only work.
- Never print `DATABASE_URL` or credentials.
- Push only `feature/course-branding-and-preview`.

## Why `/admin/account` was failing

The failure was not primarily caused by white-label branding.

The staging database schema is behind the Payload runtime configuration. Logs proved that the application expects affiliate collections and related locked-document columns that do not exist in `jpvbootcamp_staging`:

- `payload_affiliates`
- `payload_affiliate_referrals`
- `payload_affiliate_commissions`
- `payload_locked_documents_rels.payload_affiliates_id`
- `payload_locked_documents_rels.payload_affiliate_referrals_id`
- `payload_locked_documents_rels.payload_affiliate_commissions_id`

The failing Payload account view builds locked-document queries across all configured collections, so missing affiliate tables/columns crash `/admin/account`.

The logs also showed a second schema defect:

- `payload_preferences.id` lacks the unique or primary-key constraint required by Payload's `ON CONFLICT (id)` writes.

The logs also showed a separate branding/import-map issue:

- `JPVAdminIcon` was not found in the deployed Payload import map.

This import-map issue explains missing branding, but it is not the fatal `/admin/account` database error.

## Existing reviewed migration and schema repair work

The affiliate migration already exists and is registered:

- `src/migrations/20260630_100730_affiliate_reporting.ts`

A new preferences constraint repair has been added:

- `src/lib/payloadPreferencesConstraintMigrationSql.ts`
- `src/migrations/20260630_190000_payload_preferences_id_constraint.ts`
- `scripts/payload_preferences_constraint_migration.test.ts`

The new migration is imported and registered after the affiliate migration in:

- `src/migrations/index.ts`

The preferences repair:

- requires an explicit schema in `DATABASE_URL`;
- rejects malformed or invalid schema names;
- verifies `payload_preferences` exists;
- fails if any `id` is null;
- fails if duplicate IDs exist;
- preserves an existing suitable primary key or unique constraint;
- adds only `payload_preferences_id_unique` when required;
- performs no `DELETE`, `TRUNCATE`, or destructive row update;
- aligns an existing serial sequence safely;
- drops only its own named constraint in the down migration.

## Safe staging migration tooling

Added:

- `scripts/payload/run-staging-migrations.mts`
- `scripts/payload_staging_migration_boundary.test.ts`

Package commands added:

- `payload:staging:migrate:status`
- `payload:staging:migrate`
- `test:payload-staging-boundary`
- `test:payload-preferences-migration`

The migration runner:

- accepts only `schema=jpvbootcamp_staging`;
- rejects missing/malformed URLs;
- rejects production/public/other schemas;
- accepts exactly one mode: `--status` or `--apply`;
- prints only hostname, database name, schema, and mode;
- never prints credentials or the full URL.

No staging migration has been run yet.

## Deterministic Payload branding/import-map build

`Dockerfile` was changed so the builder explicitly runs:

```sh
pnpm generate:importmap
pnpm run build
```

in that order.

A static regression test was added:

- `scripts/payload_admin_branding.test.ts`

Package command:

- `test:payload-admin-branding`

The branding test verifies:

- `src/payload.config.ts` references `JPVAdminLogo` and `JPVAdminIcon`;
- `src/components/payload/JPVAdminBranding.tsx` exports both symbols;
- `/images/jpv-logo.png` is referenced;
- `public/images/jpv-logo.png` exists;
- `src/app/(payload)/admin/importMap.js` imports both symbols;
- the import map object contains both exact configured keys;
- Docker generates the import map before building;
- no default Payload graphic is intentionally restored.

This branding test already passed once, but it was run under Node 25 by the generic package action. It must be rerun explicitly under Node 20.

## Member authentication implementation

Current request sequence in `src/components/auth/MemberLoginForm.tsx`:

1. `POST /api/payload_members/login`
2. `GET /api/member-session?next=<safe encoded portal path>`
3. If allowed, redirect only to `/portal` or `/portal/*`
4. If denied or malformed, `POST /api/payload_members/logout`
5. Show a safe user-facing message

All auth requests use `credentials: 'include'`.

The login body contains only:

- `email`
- `password`

Unsafe destinations fail closed:

- `/admin`
- external URLs
- protocol-relative URLs
- backslash paths
- malformed percent encoding

Pure helper added:

- `src/lib/auth/memberLoginFlow.ts`

It exports:

- `resolveMemberDestination`
- `parseMemberSessionResponse`
- `getMemberLoginErrorMessage`
- `shouldClearDeniedMemberSession`

Focused test added:

- `scripts/payload_member_auth_flow.test.ts`

Package command:

- `test:payload-member-auth`

## Current validation failure to fix first

`test:payload-member-auth` failed at the assertion for a member requesting `/admin`.

The test incorrectly expected a fallback destination of `/portal`.

Actual and correct security behavior from `decideSharedLogin` is:

- `allowed === false`
- `destination === null`

The next step is to repair only that test assertion. Do not change production auth behavior.

Relevant files:

- `scripts/payload_member_auth_flow.test.ts`
- `src/lib/auth/sharedLoginDecision.ts`
- `src/lib/auth/identityDestination.ts`

## Other current authentication files

- `src/components/auth/MemberLogoutButton.tsx`
- `src/app/(frontend)/login/page.tsx`
- `src/app/(frontend)/portal/layout.tsx`
- `src/app/api/member-session/route.ts`

The visible member logout flow posts to `/api/payload_members/logout` and redirects to `/login` only after success.

## Expected current uncommitted files

At minimum, expect these modified/untracked files:

- `Dockerfile`
- `package.json`
- `scripts/payload/run-staging-migrations.mts`
- `scripts/payload_staging_migration_boundary.test.ts`
- `scripts/payload_preferences_constraint_migration.test.ts`
- `scripts/payload_admin_branding.test.ts`
- `scripts/payload_member_auth_flow.test.ts`
- `src/lib/payloadPreferencesConstraintMigrationSql.ts`
- `src/lib/auth/memberLoginFlow.ts`
- `src/migrations/20260630_190000_payload_preferences_id_constraint.ts`
- `src/migrations/index.ts`
- `src/components/auth/MemberLoginForm.tsx`
- `src/components/auth/MemberLogoutButton.tsx`
- `src/app/(frontend)/login/page.tsx`
- `src/app/(frontend)/portal/layout.tsx`
- `src/app/api/member-session/route.ts`

`.graphifyignore` is an unrelated pre-existing modification and must remain untouched and unstaged.

## Immediate next steps

1. Verify branch and status:

```sh
git branch --show-current
git status --short
git diff --name-only
git log -1 --oneline
```

2. Fix the failing member-auth test assertion so a member requesting `/admin` expects:

```ts
allowed === false
destination === null
```

3. Run all validation explicitly under Node 20:

```sh
nvm exec 20 pnpm generate:importmap
nvm exec 20 pnpm type-check:payload
nvm exec 20 pnpm test:payload-identity
nvm exec 20 pnpm test:payload-member-auth
nvm exec 20 pnpm test:payload-staging-boundary
nvm exec 20 pnpm test:payload-preferences-migration
nvm exec 20 pnpm test:payload-admin-branding
```

4. Locate and run the existing affiliate migration SQL-generation test under Node 20.

5. Run the production build under Node 20:

```sh
nvm exec 20 pnpm run build
```

6. Inspect final diffs and ensure `.graphifyignore` is unstaged.

7. If and only if every database-free validation passes, stage only the exact implementation/test files, commit, and push:

```sh
git commit -m "fix: repair staging migration path and member authentication"
git push origin feature/course-branding-and-preview
```

Do not deploy in that validation/commit task unless a later prompt explicitly requests preview deployment.

## Staging migration operator commands for a later authorized task

Status must run before apply:

```sh
DATABASE_URL='<preview URL with schema=jpvbootcamp_staging>' nvm exec 20 pnpm payload:staging:migrate:status
```

Apply only after read-only review confirms no partial affiliate objects, null preference IDs, or duplicate preference IDs:

```sh
DATABASE_URL='<preview URL with schema=jpvbootcamp_staging>' nvm exec 20 pnpm payload:staging:migrate
```

Never run those commands against `jpvbootcamp`, `public`, a missing schema, or production credentials.

## Final goals after commit/push

A later task should:

- run staging migration status and safe inspection;
- apply only reviewed migrations to `jpvbootcamp_staging`;
- verify affiliate tables/locked-document columns/preferences constraint;
- deploy preview only;
- verify `/admin/account` works;
- verify JPV branding appears on administrator login;
- verify member login/logout and denied-state behavior;
- then proceed to Phase 5 and Phase 6 account security and FreeResend work.
