# Payload-only Free/Pro Review Packet

## Branch

- Branch: `feature/course-branding-and-preview`
- PR / review URL: `https://github.com/prochattools/jpv-bootcamp/pull/2`
- Staging deployment target: this feature branch is the staging / production-staged deployment branch.
- Latest validated pre-migration-handoff commit: `587862b fix: harden checkout validation and success URL safety`
- Push status: local branch and `origin/feature/course-branding-and-preview` are in sync.
- Roadmap progress: `docs/client/ROADMAP_PROGRESS_STATUS.md`
- Migration approval packet: `docs/client/MIGRATION_APPROVAL_PACKET.md`
- Staging smoke checklist: `docs/client/STAGING_SMOKE_CHECKLIST.md`
- Provider/email readiness: `docs/client/PROVIDER_EMAIL_READINESS.md`

## Scope summary

This branch refits JPV Bootcamp to the Version 3.3 Payload-only and Free/Pro product model. It prepares the repository for human review before any approved database migration apply, preview deployment, or production cutover.

The branch removes active legacy integration paths, old public plan labels, old checkout aliases, and stale documentation that no longer matches the client truth. It keeps Payload as the administrative source, Next.js as the app/runtime surface, Stripe as the paid subscription processor, and Resend-compatible delivery for email.

## Major changed and deleted areas

- Internal architecture, Payload, Stripe, support/pay-it-forward, partner, setup, and client-alignment documentation was reduced and aligned to the current Free/Pro scope.
- Public, portal, billing, sponsored-access, partner, and operations pages were updated away from removed integration and tier language.
- Membership checkout and plan resolution now accept only `plan=pro` with optional `billing=monthly` or `billing=annual`.
- Stripe config and readiness checks now require Pro monthly and Pro annual identifiers, with no non-Pro public checkout product.
- Payload access, billing, course, and generated type surfaces now use Free and Pro labels only.
- WordPress plugin files, WordPress API routes/helpers, old sync route, VIP upgrade route/helper/test, and old smoke portal script were deleted.
- SVG assets still parse after copy/noise cleanup.
- `server-only@0.0.1` was added so server-only module imports resolve during local validation.

## Product rules

- This feature branch is Payload-only.
- Free is controlled non-paid access for support, pay-it-forward recipients, staff/test access, migration outcomes, or administrator-created access.
- Pro is the only paid subscription.
- Pro has monthly and annual billing options.
- Support and pay-it-forward grant controlled Free access; they are not product tiers.
- There must be no active WordPress, FluentCRM, FluentCommunity, old portal, VIP, or exhibitor code path, documentation path, checkout option, upgrade route, future product label, or target access state.

## Migration summary

### Prisma account-column rename

Migration:

`prisma/migrations/20260707_120000_rename_account_identity_columns/migration.sql`

This migration renames old account identity columns and indexes to neutral `account_*` names:

- `wp_user_id` to `account_id`
- `wp_email_hash` to `account_email_hash`
- `wp_name` to `account_name`
- `claimed_by_wp_user_id` to `claimed_by_account_id`
- `reviewed_by_wp_user_id` to `reviewed_by_account_id`

Each column rename is guarded by an existence check. Old indexes are dropped with `DROP INDEX IF EXISTS`, and replacement indexes are created only when the target column exists. The migration does not drop tables.

For the authorization template governing Prisma startup and migration operations (including `database-deploy` startup and Prisma production migration execution), see the Prisma startup authorization template in `docs/PREVIEW_RELEASE_READINESS.md` under Independent authorization templates.

### Payload table-plan enum cleanup

Migration:

`src/migrations/20260707_130000_remove_table_plan_from_payload_enums.ts`

This migration intentionally maps legacy table-plan subscription values to `free`, removes obsolete allowed-plan rows, and narrows Payload plan enums to `free` and `pro`.

This is data-preserving at the record/table level, but it is business-significant because legacy table-plan subscription values become controlled Free access rather than a paid product label.

### Apply boundary

No migration has been applied by this review packet. Migration application must go through the approved database migration path with the target environment, schema, operator, backup/snapshot, and maintenance window explicitly approved.

Pushing or deploying `feature/course-branding-and-preview` must not automatically apply Prisma or Payload migrations. Migration execution is a separate approval category.

## Validation summary

The following commands passed during final review:

```bash
git diff --check
./node_modules/.bin/prisma validate --schema=prisma/system.prisma
./node_modules/.bin/prisma validate --schema=prisma/schema.prisma
./node_modules/.bin/tsc --noEmit --pretty false --incremental false
./node_modules/.bin/tsx scripts/billing_readiness_report.test.ts
./node_modules/.bin/tsx scripts/preview_migration_inventory.test.ts
./node_modules/.bin/tsx scripts/migration_readiness_static.test.ts
./node_modules/.bin/tsx scripts/member_checkout.test.ts
./node_modules/.bin/tsx scripts/membership_email_copy.test.ts
./node_modules/.bin/tsx scripts/payload_course_stripe_shadow_sync.test.ts
./node_modules/.bin/tsx scripts/payload_entitlement_evaluator.test.ts
./node_modules/.bin/tsx scripts/payload_course_access_service.test.ts
./node_modules/.bin/tsx scripts/tests/sponsored_claim_helpers.ts
./node_modules/.bin/tsx scripts/tests/sponsored_decision_helpers.ts
```

Additional static checks passed:

- table-plan-to-Free migration static smoke;
- SVG XML parse check for `src/assets/images/*.svg`.

## Grep summary

Expected grep exceptions:

- Old `wp_*` strings remain only inside `prisma/migrations/20260707_120000_rename_account_identity_columns/migration.sql`, where they are required to rename old database columns and indexes.
- `STRIPE_PRICE_TABLE` remains only in a negative readiness assertion that verifies membership checkout no longer uses the old table price configuration.
- `pnpm-lock.yaml` can match `libvips` package names and integrity hashes. Those are Sharp dependency names or checksum text, not project integration references.
- This review packet mentions removed integration/product names only to state that they must not remain as active paths.

## Staging handoff

- Branch: `feature/course-branding-and-preview`
- Deployment target: staging / production-staged.
- PR / review URL: `https://github.com/prochattools/jpv-bootcamp/pull/2`
- Validation commands: see the validation summary above.
- Approval packet: `docs/client/MIGRATION_APPROVAL_PACKET.md`
- Manual smoke checklist: `docs/client/STAGING_SMOKE_CHECKLIST.md`
- Provider/email readiness: `docs/client/PROVIDER_EMAIL_READINESS.md`
- Expected grep exceptions: see the grep summary above.
- Migration warning: table-plan-to-Free mapping requires explicit target-environment approval before migration execution.
- No migrations applied: confirmed.

## Remaining business approval item

Before applying migrations, approve the Payload table-plan-to-Free mapping: legacy table-plan subscription values will become controlled Free access, and obsolete allowed-plan rows will be removed.

## Commit and migration status

This branch has been split into reviewable commits and pushed for staging review. No migrations were applied during the branch work or this handoff.
