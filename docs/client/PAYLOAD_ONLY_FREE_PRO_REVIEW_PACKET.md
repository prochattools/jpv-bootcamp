# Payload-only Free/Pro Review Packet

## Branch

- Branch: `feature/course-branding-and-preview`
- Last commit before review changes: `93a0159 fix: preserve password reset success after cleanup failure`
- Commit status: no commit has been made for this review packet or the Free/Pro cleanup.

## Scope summary

This branch refits JPV Bootcamp to the Version 3.3 Payload-only and Free/Pro product model. It prepares the worktree for human review before any commit, database migration apply, preview deployment, or production cutover.

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

### Payload table-plan enum cleanup

Migration:

`src/migrations/20260707_130000_remove_table_plan_from_payload_enums.ts`

This migration intentionally maps legacy table-plan subscription values to `free`, removes obsolete allowed-plan rows, and narrows Payload plan enums to `free` and `pro`.

This is data-preserving at the record/table level, but it is business-significant because legacy table-plan subscription values become controlled Free access rather than a paid product label.

### Apply boundary

No migration has been applied by this review packet. Migration application must go through the approved database migration path with the target environment, schema, operator, backup/snapshot, and maintenance window explicitly approved.

## Validation summary

The following commands passed during final review:

```bash
git diff --check
./node_modules/.bin/prisma validate --schema=prisma/system.prisma
./node_modules/.bin/prisma validate --schema=prisma/schema.prisma
./node_modules/.bin/tsc --noEmit --pretty false --incremental false
./node_modules/.bin/tsx scripts/billing_readiness_report.test.ts
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

## Remaining business approval item

Before applying migrations, approve the Payload table-plan-to-Free mapping: legacy table-plan subscription values will become controlled Free access, and obsolete allowed-plan rows will be removed.

## Commit status

No commit was made.
