# Membership Support Schema Migration Plan

## Scope

This packet prepares the administrator persistence/schema migration and generated Payload type regeneration plan for the membership-support domain.

It does not apply migrations, regenerate types, call live providers, deploy, push, or touch `main`.

Repository state at inspection:

- Branch: `feature/course-branding-and-preview`
- HEAD: `8927df9`
- Dirty paths already present and protected:
  - `src/payload-types.ts`
  - `docs/client/fixtures/`

The current repo evidence shows the membership-support collections are declared in code, but there is no repository migration file yet that registers them in `src/migrations/index.ts`.

## Audit Summary

All membership-support collections are admin-only through `membershipSupportAccess`, which resolves to `adminOnlyCollectionAccess`.

All of the collections below use `timestamps: true` and store operational state in addition to content.

Sensitive data across this domain includes:

- Stripe IDs and event IDs
- member email addresses
- approval references
- operator notes
- metadata JSON

Those fields should be treated as internal-only and never exposed publicly.

### Collection inventory

| Collection | Slug | Required fields | Optional fields | Relationships | Enums / selects | Indexes / uniques | Access / hooks | Retention / auditability / sensitivity | Migration required | Generated types change |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Membership Support Record | `payload_membership_support_records` | `displayName`, `member`, `memberEmail`, `fundingSource`, `issuanceState`, `billingCadence`, `reconciliationState` | `voucherDuration`, `stripeCustomerId`, `stripeSubscriptionId`, `stripePriceId`, `stripeCouponId`, `stripePromotionCodeId`, `approvalReference`, `issuedBy`, `approvedBy`, `issuedAt`, `expiresAt`, `redeemedAt`, `deactivatedAt`, `lastWebhookAt`, `notes`, `metadata` | `member`, `membershipSupport` backrefs, `reviewQueueItem`, `operatorNotes`, `auditHistory`, `stripeShadow`, `fundingSource` | `fundingSource`, `voucherDuration`, `issuanceState`, `billingCadence`, `reconciliationState` | Indexed: `memberEmail`, Stripe IDs, `approvalReference`, `issuedBy`, `approvedBy`; no unique constraint declared | Display-name hook, email/text normalizers, value validation for source/state fields | Canonical member-facing support record; operational only; keep Stripe IDs, approval refs, notes, and metadata internal | Yes | Yes |
| Voucher | `payload_membership_vouchers` | `displayName`, `membershipSupport`, `member`, `memberEmail`, `voucherDuration`, `approvalState`, `redemptionState`, `billingCadence`, `reason` | `stripeCustomerId`, `stripeCouponId`, `stripePromotionCodeId`, `approvalReference`, `issuedBy`, `approvedBy`, `issuedAt`, `expiresAt`, `redeemedAt`, `deactivatedAt`, `operatorNotes`, `metadata` | `membershipSupport`, `member`, `operatorNotes` | `voucherDuration`, `approvalState`, `redemptionState`, `billingCadence` | Indexed: `memberEmail`, Stripe IDs, `approvalReference`, `issuedBy`, `approvedBy`, `operatorNotes`; no unique constraint declared | Display-name hook, email/text normalizers, approval-reference validation, issuance-state reference validation | Voucher lifecycle is approval/issue/redeem/deactivate audit data; Stripe references and member email are sensitive | Yes | Yes |
| Pay it Forward Funding | `payload_pay_it_forward_funding` | `displayName`, `membershipSupport`, `member`, `memberEmail`, `donorName`, `approvalState`, `billingCadence`, `allocatedAmountMinor`, `currency`, `approvalReference`, `reason` | `stripeCustomerId`, `stripeCouponId`, `stripePromotionCodeId`, `stripeSubscriptionId`, `issuedBy`, `approvedBy`, `issuedAt`, `expiresAt`, `redeemedAt`, `revokedAt`, `notes`, `operatorNotes`, `metadata` | `membershipSupport`, `member`, `operatorNotes` | `approvalState`, `billingCadence` | Indexed: `memberEmail`, Stripe IDs, `approvalReference`, `issuedBy`, `approvedBy`, `operatorNotes`; no unique constraint declared | Display-name hook, email/text normalizer, approval-reference normalizer | Funding allocation records are financial and operator-sensitive; donor name and Stripe refs are internal-only | Yes | Yes |
| Funding Source | `payload_membership_funding_sources` | `displayName`, `sourceType`, `sourceState`, `committedAmountMinor`, `availableAmountMinor`, `currency` | `support`, `voucher`, `member`, `donorName`, `approvalReference`, `issuedBy`, `approvedBy`, `issuedAt`, `depletedAt`, `notes`, `metadata` | `membershipSupport`, `voucher`, `member` | `sourceType`, `sourceState` | Indexed: `approvalReference`, `issuedBy`, `approvedBy`; no unique constraint declared | Display-name hook, text normalizer, source validation | Canonical provenance record for membership funding; internal financial metadata only | Yes | Yes |
| Reconciliation | `payload_membership_reconciliations` | `displayName`, `stripeEventType`, `reconciliationState` | `membershipSupport`, `voucher`, `fundingSource`, `member`, `stripeEventId`, `failureCode`, `lastWebhookAt`, `resolvedAt`, `notes`, `metadata` | `membershipSupport`, `voucher`, `fundingSource`, `member` | `reconciliationState` | Indexed: `stripeEventId`, `failureCode`; no unique constraint declared | Display-name hook, text normalizer, reconciliation-state validation | Webhook and Stripe reconciliation audit trail; Stripe event IDs and failure codes are sensitive | Yes | Yes |
| Administration Action | `payload_membership_administration_actions` | `displayName`, `operator`, `actionType`, `actionState` | `member`, `membershipSupport`, `voucher`, `fundingSource`, `reconciliation`, `reviewQueueItem`, `approvalReference`, `executedAt`, `completedAt`, `failureReason`, `notes`, `operatorNotes`, `metadata` | `operator`, `member`, `membershipSupport`, `voucher`, `fundingSource`, `reconciliation`, `reviewQueueItem`, `operatorNotes` | `actionType`, `actionState` | Indexed: `approvalReference`, `operatorNotes`; no unique constraint declared | Display-name hook, text normalizer | Operator action log; should remain internal and support later audit review | Yes | Yes |
| Review Queue Item | `payload_membership_review_queue_items` | `displayName`, `membershipSupport`, `voucher`, `fundingSource`, `reconciliation`, `member`, `queueState`, `queueReason`, `priority` | `assignedTo`, `dueAt`, `resolvedAt`, `notes`, `metadata` | `membershipSupport`, `voucher`, `fundingSource`, `reconciliation`, `member`, `assignedTo` | `queueState`, `queueReason` | Indexed: `assignedTo`; no declared unique constraint in code | Display-name hook, text normalizer | Review queue items are operationally sensitive; workflow metadata currently carries a dedupe hash even though the collection does not persist one yet | Yes | Yes |
| Operator Note | `payload_operator_notes` | `displayName`, `targetType`, `targetId`, `visibility`, `author`, `note` | `membershipSupport`, `voucher`, `fundingSource`, `reconciliation`, `auditHistory`, `pinned`, `metadata` | `author`, `membershipSupport`, `voucher`, `fundingSource`, `reconciliation`, `auditHistory` | `targetType`, `visibility` | Indexed: `targetId`, `author`; no unique constraint declared | Display-name hook, text normalizer | Internal notes only; note body is sensitive and must never be public | Yes | Yes |
| Stripe Shadow Projection | `payload_stripe_shadow_projections` | `displayName`, `shadowState` | `membershipSupport`, `voucher`, `fundingSource`, `member`, `stripeCustomerId`, `stripeSubscriptionId`, `stripePriceId`, `stripeCouponId`, `stripePromotionCodeId`, `stripeInvoiceId`, `stripeEventId`, `lastWebhookAt`, `shadowedAt`, `observedStatus`, `notes`, `metadata` | `membershipSupport`, `voucher`, `fundingSource`, `member` | `shadowState` | Indexed: all Stripe ID fields, `stripeEventId`; no unique constraint declared | Display-name hook, text normalizer | Repository-only shadow of Stripe membership state; all Stripe references are sensitive | Yes | Yes |
| Audit History | `payload_membership_audit_history` | `displayName`, `actorType`, `action`, `targetCollection`, `severity` | `actorId`, `targetId`, `approvalReference`, `membershipSupport`, `voucher`, `fundingSource`, `reconciliation`, `before`, `after`, `notes`, `metadata` | `membershipSupport`, `voucher`, `fundingSource`, `reconciliation` | `actorType`, `severity` | Indexed: `actorId`, `action`, `targetCollection`, `targetId`, `approvalReference`; no unique constraint declared | Display-name hook, text normalizer | Append-only audit log by policy; this collection should remain admin-only and highly audit sensitive | Yes | Yes |

## Schema Delta

This table treats the current repository state as code declarations only and the required state as the first applied Payload schema that materializes those declarations in the tenant schema.

| Collection | Field / index / relationship | Current state | Required state | Migration required | Risk | Rollback |
| --- | --- | --- | --- | --- | --- | --- |
| Membership Support Record | Table + core columns | Declared in code only; no repo migration exists | Create `payload_membership_support_records` with all declared fields, timestamps, and relation columns | Yes | High, because the admin cockpit and webhook projection depend on the table existing | Drop table in a down migration or restore pre-apply snapshot |
| Membership Support Record | `memberEmail`, Stripe IDs, `approvalReference`, `issuedBy`, `approvedBy`, `lastWebhookAt` indexes | Declared in code only | Create the declared indexes | Yes | Medium; index omissions degrade admin lookups and reconciliation joins | Drop the added indexes |
| Membership Support Record | `membershipSupport`, `reviewQueueItem`, `operatorNotes`, `auditHistory`, `stripeShadow`, `fundingSource` relationships | Declared in code only | Create the relation storage that Payload generates for the listed `hasMany` relationships | Yes | Medium; missing relation storage breaks cockpit links and historical navigation | Drop relation storage and downstream dependent data |
| Voucher | Voucher lifecycle columns and relation fields | Declared in code only | Create voucher lifecycle columns, Stripe reference fields, and `operatorNotes` relationship storage | Yes | High; voucher issuance and redemption flows depend on it | Drop table / restore snapshot |
| Voucher | `memberEmail`, Stripe IDs, `approvalReference`, `issuedBy`, `approvedBy`, `operatorNotes` indexes | Declared in code only | Create the declared indexes | Yes | Medium | Drop the added indexes |
| Pay it Forward Funding | Funding and amount columns | Declared in code only | Create `allocatedAmountMinor`, `currency`, approval, Stripe reference, and lifecycle columns | Yes | High; sponsorship accounting and issuance depend on it | Drop table / restore snapshot |
| Pay it Forward Funding | `memberEmail`, Stripe IDs, `approvalReference`, `issuedBy`, `approvedBy`, `operatorNotes` indexes | Declared in code only | Create the declared indexes | Yes | Medium | Drop the added indexes |
| Funding Source | Funding provenance columns and relationships | Declared in code only | Create `sourceType`, `sourceState`, amount, currency, donor, approval, and relationship columns | Yes | Medium | Drop table / restore snapshot |
| Reconciliation | Stripe event and reconciliation columns | Declared in code only | Create `stripeEventType`, `reconciliationState`, `failureCode`, `lastWebhookAt`, `resolvedAt`, and relation columns | Yes | High; webhook classification and recovery paths use this table | Drop table / restore snapshot |
| Reconciliation | `stripeEventId`, `failureCode` indexes | Declared in code only | Create the declared indexes | Yes | Medium | Drop the added indexes |
| Administration Action | Operator action columns and relations | Declared in code only | Create `operator`, action state/type, approval reference, timestamps, notes, metadata, and relation columns | Yes | Medium | Drop table / restore snapshot |
| Review Queue Item | Review queue columns | Declared in code only | Create queue state/reason, priority, assignment, due/resolved timestamps, notes, metadata, and relation columns | Yes | High; manual-review handling depends on it | Drop table / restore snapshot |
| Review Queue Item | `dedupeKey` persistence | Workflow metadata already carries a deterministic dedupe hash, but the collection does not persist it | Add a persisted `dedupeKey` text field and a unique index, then backfill from workflow metadata if approved | Yes | High; duplicates can be created if dedupe is not persisted | Drop the field/index and fall back to metadata-only dedupe |
| Review Queue Item | `assignedTo` index | Declared in code only | Create the declared index | Yes | Low to medium | Drop the added index |
| Operator Note | Note target and author columns | Declared in code only | Create `targetType`, `targetId`, `visibility`, `author`, `note`, `pinned`, metadata, and relation columns | Yes | Medium | Drop table / restore snapshot |
| Operator Note | `targetId`, `author` indexes | Declared in code only | Create the declared indexes | Yes | Low to medium | Drop the added indexes |
| Stripe Shadow Projection | Stripe shadow columns | Declared in code only | Create Stripe reference columns, state, timestamps, observed status, notes, and metadata | Yes | High; reconciliation and shadow-sync visibility depend on it | Drop table / restore snapshot |
| Stripe Shadow Projection | Stripe reference indexes | Declared in code only | Create the declared indexes | Yes | Medium | Drop the added indexes |
| Audit History | Audit columns | Declared in code only | Create audit actor, target, severity, approval reference, JSON snapshots, notes, metadata, and relation columns | Yes | High; audit trail and operator accountability depend on it | Drop table / restore snapshot |
| Audit History | `actorId`, `action`, `targetCollection`, `targetId`, `approvalReference` indexes | Declared in code only | Create the declared indexes | Yes | Medium | Drop the added indexes |

## Generated-Type Regeneration Isolation Strategy

The current `src/payload-types.ts` dirty file is unrelated to this packet and must be preserved exactly.

The safe sequence for a future type regeneration is:

1. Capture the exact current diff before any generation work.
   - Run `git diff -- src/payload-types.ts > /tmp/jpv-bootcamp.payload-types.unrelated.patch`
   - Keep the patch outside the repo and do not edit `src/payload-types.ts` in place.
2. Create a clean sibling worktree or throwaway branch from the same approved commit.
   - The clean worktree must not inherit the protected dirty file.
3. Apply only the approved schema/migration changes in the clean worktree.
4. Run the Payload generators in the clean worktree only.
   - `pnpm payload generate:importmap`
   - `pnpm payload generate:types`
5. Compare the generated type file in the clean worktree against the protected local file in the original worktree.
   - Use `git diff --no-index -- src/payload-types.ts <clean-worktree>/src/payload-types.ts`
   - Inspect only the membership-support additions and any incidental differences.
6. Reapply only the approved generated delta after separate approval.
   - Do not overwrite the protected local file.
   - Do not stage the original `src/payload-types.ts` until explicit approval exists.
7. Restore or abort safely.
   - If the generated output contains unrelated drift, delete the clean worktree and discard the branch.
   - The original worktree remains untouched.
8. Validate the generated output before any staging.
   - `pnpm exec tsc --noEmit --pretty false --incremental false`
   - `pnpm exec tsx scripts/membership_support_collections.test.ts`
   - `pnpm payload:branding:check`
9. Prove no unrelated output was included.
   - Keep the saved pre-generation diff.
   - Keep the clean-worktree diff.
   - Stage only the approved files after a separate approval step.

This strategy is intentionally conservative because the protected file already contains unrelated generated-type drift, including subscription/payment additions and locked-document relation removals.

## Exact Commands And Paths

### Payload CLI commands

- Create a Payload migration: `pnpm payload migrate:create`
- Check Payload migration status: `pnpm payload:staging:migrate:status`
- Apply Payload migrations in the guarded staging wrapper: `pnpm payload:staging:migrate`
- Underlying CLI invoked by the staging wrapper for apply/status: `pnpm payload migrate` and `pnpm payload migrate:status`
- Generate Payload import map: `pnpm payload generate:importmap`
- Generate Payload types: `pnpm payload generate:types`

### Repository validation commands

- Root TypeScript validation: `pnpm exec tsc --noEmit --pretty false --incremental false`
- Collection registration validation: `pnpm exec tsx scripts/membership_support_collections.test.ts`
- Membership-support workflow validation: `pnpm exec tsx src/lib/membership-support/membershipSupport.test.ts`
- Payload config and import-map check: `pnpm payload:branding:check`
- Staging migration boundary check: `pnpm exec tsx scripts/payload_staging_migration_boundary.test.ts`
- Migration-wiring sanity: `pnpm exec tsx scripts/payload_staging_migration_boundary.test.ts && pnpm exec tsx scripts/membership_support_collections.test.ts`

### Review commands for migration code

- Review the generated Payload migration source: `sed -n '1,220p' src/migrations/<timestamp>_<name>.ts`
- Review registry wiring: `sed -n '1,220p' src/migrations/index.ts`
- Review the staged diff for the migration file: `git diff -- src/migrations/index.ts src/migrations/<timestamp>_<name>.ts`
- Review the protected generated types diff without editing it: `git diff -- src/payload-types.ts`

### Where generated files would appear

- Payload migration code: `src/migrations/<timestamp>_<kebab-name>.ts`
- Payload migration registry: `src/migrations/index.ts`
- Payload generated types: `src/payload-types.ts`
- Existing Prisma migration SQL remains under `prisma/migrations/<timestamp>_<name>/migration.sql`, but that layer is not the owner of `payload_*` tables.

## Approval Gates

Do not execute any of the following without separate explicit approval:

- applying Payload migrations
- regenerating `src/payload-types.ts` in the original worktree
- staging the protected generated-type file
- any live provider action
- deployment
- push
- main-branch work

Required approvals for the eventual migration packet:

- schema migration approval
- rollback approval
- explicit operator ownership
- explicit target-environment identification
- generated-type regeneration approval

## Rollback Position

No repository command exposes a Payload rollback shortcut in the current tree.

If a future Payload migration is generated, rollback must be handled by the generated migration `down()` implementation and/or the approved restore/backout path documented elsewhere in the repository.

For this packet, the safe rollback action is to leave the current worktree unchanged and discard any isolated regeneration worktree if the output is not approved.
