# Migration Rehearsal Runbook

Operator-facing runbook for target-environment migration rehearsal preparation on `feature/course-branding-and-preview`.

## Hard safety rules

- Do not apply migrations unless the target-environment approval checklist is signed off.
- Do not touch `main`.
- Use only `feature/course-branding-and-preview`.
- Confirm backup or snapshot evidence before rehearsal.
- Confirm rollback or recovery plan before rehearsal.
- Confirm operator identity and timestamp before rehearsal.
- Confirm no automatic migration execution is tied to branch push or deploy.

## Preflight checklist

- [ ] Branch confirmed: `feature/course-branding-and-preview`
- [ ] Deployed commit confirmed
- [ ] Database snapshot or backup confirmed
- [ ] Approval packet signed
- [ ] Table-plan-to-Free mapping approved
- [ ] Account-column rename approved
- [ ] Rollback plan reviewed
- [ ] Provider and email readiness checked
- [ ] No secrets pasted into logs or docs

## Dry-run and static-only rehearsal steps

1. Inspect the reviewed migration inventory in `src/lib/previewMigrationInventory.ts`.
2. Inspect `prisma/migrations/20260707_120000_rename_account_identity_columns/migration.sql`.
3. Inspect `src/migrations/20260707_130000_remove_table_plan_from_payload_enums.ts`.
4. Verify the inventory count remains `11`.
5. Verify `docs/client/STAGING_SMOKE_CHECKLIST.md` is current and ready for manual operator use.
6. Verify `docs/client/PROVIDER_EMAIL_READINESS.md` is current and ready for manual operator use.
7. Run validation commands:

```bash
git diff --check
./node_modules/.bin/tsc --noEmit --pretty false --incremental false
./node_modules/.bin/prisma validate --schema=prisma/system.prisma
./node_modules/.bin/prisma validate --schema=prisma/schema.prisma
./node_modules/.bin/tsx scripts/preview_migration_inventory.test.ts
./node_modules/.bin/tsx scripts/migration_readiness_static.test.ts
./node_modules/.bin/tsx scripts/migration_rehearsal_safety.test.ts
```

8. Do not execute any database-mutating command during this dry-run pass.

## Actual migration rehearsal

This section is intentionally a gated placeholder.

Actual target-environment migration rehearsal is not authorized by this runbook alone. It requires separate written approval for the environment, operator, backup or snapshot, rollback owner, and execution window.

## Rollback and recovery

- Backup or snapshot reference:
- Rollback owner:
- Recovery decision point:
- Post-rehearsal verification status:

## Evidence capture

Capture and record:

- validation command outputs
- timestamps
- operator identity
- target environment
- commit hash
- pass or fail notes

## Hard stop

This runbook does not authorize migration execution.
