# Migration Approval Packet

## Scope

- Branch: `feature/course-branding-and-preview`
- PR / review URL: `https://github.com/prochattools/jpv-bootcamp/pull/2`
- Latest validated pre-packet commit: `50f7966 docs: add migration rehearsal safety handoff`
- No migrations have been applied.
- Canonical reviewed Payload migration inventory count: `11`
- Approval status tracker: `docs/client/MIGRATION_APPROVAL_STATUS.md`
- Rehearsal runbook: `docs/client/MIGRATION_REHEARSAL_RUNBOOK.md`

## Migration inventory

Reviewed Payload migration order:

1. `src/migrations/20260620_213328.ts`
2. `src/migrations/20260621_194424_course_system_phase1.ts`
3. `src/migrations/20260622_093852_course_private_media.ts`
4. `src/migrations/20260627_010700_structured_community_attachments.ts`
5. `src/migrations/20260630_100730_affiliate_reporting.ts`
6. `src/migrations/20260630_190000_payload_preferences_id_constraint.ts`
7. `src/migrations/20260701_201500_member_email_verification.ts`
8. `src/migrations/20260702_001500_member_account_action_purposes.ts`
9. `src/migrations/20260703_000000_partner_affiliate_operations.ts`
10. `src/migrations/20260704_090000_partner_schema_reconciliation.ts`
11. `src/migrations/20260707_130000_remove_table_plan_from_payload_enums.ts`

Related reviewed Prisma rename migration in the same release path:

- `prisma/migrations/20260707_120000_rename_account_identity_columns/migration.sql`

## Plain-English purpose summary

- `20260620_213328`: bootstrap the reviewed Payload course and admin data model.
- `20260621_194424_course_system_phase1`: extend course/member foundations.
- `20260622_093852_course_private_media`: add protected media support.
- `20260627_010700_structured_community_attachments`: normalize community attachment handling.
- `20260630_100730_affiliate_reporting`: add affiliate reporting sources.
- `20260630_190000_payload_preferences_id_constraint`: tighten preference identity constraints.
- `20260701_201500_member_email_verification`: add member email verification action records.
- `20260702_001500_member_account_action_purposes`: extend member account actions with purpose tracking.
- `20260703_000000_partner_affiliate_operations`: register partner affiliate/application/event operations.
- `20260704_090000_partner_schema_reconciliation`: reconcile partner schema drift with the current Payload model.
- `20260707_130000_remove_table_plan_from_payload_enums`: map legacy table-plan values to `free`, remove obsolete allowed-plan rows, and narrow Payload enums to `free` / `pro`.
- `20260707_120000_rename_account_identity_columns`: rename legacy `wp_*` account-reference columns and indexes to neutral `account_*` names without dropping the underlying records.

## Table-plan-to-Free decision

- Legacy table-plan subscription values map to `free`.
- Obsolete table-plan allowed-policy rows are removed.
- Payload subscription/access policy enums narrow to `free` / `pro`.

## Risk assessment

- Intent is non-destructive and record-preserving.
- Old account columns are renamed, not dropped.
- Legacy table-plan values become controlled Free access.
- No old paid entitlement is preserved as a third paid product.
- Migration execution still requires explicit target-environment authorization, backup evidence, operator assignment, and rollback review.

## Approval checklist

- [ ] Approve table-plan-to-Free mapping for the target environment.
- [ ] Approve account-column rename migration.
- [ ] Approve applying migrations only through the approved database migration path.
- [ ] Approve rollback/recovery plan review before execution.

## Hard stop

Do not apply migrations without written target-environment approval.
