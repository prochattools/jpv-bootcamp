# Support Requests Migration Runbook

Repository-owned apply-path contract for the additive `support_requests.phone` migration on the production `main` line.

This runbook documents the operator sequence. It does not authorize execution by itself.

## Scope

- Migration file: `prisma/migrations/20260826_100000_add_support_request_phone/migration.sql`
- Safety test: `prisma/migrations/20260826_100000_add_support_request_phone.test.ts`
- Schema contract: `scripts/support_request_schema_contract.test.ts`
- Inventory and rehearsal checks:
  - `scripts/preview_migration_inventory.test.ts`
  - `scripts/migration_readiness_static.test.ts`
  - `scripts/migration_rehearsal_safety.test.ts`
  - `scripts/staging_migration_rehearsal.test.ts`
  - `scripts/migration_rehearsal_evidence.test.ts`
- Branch: `main`
- Target: production database/schema used by `jpvbootcamp.com`

## Preconditions

- Exact branch is `main`.
- Exact commit is approved and verified with `git log --oneline -1`.
- Relevant worktree is clean for `prisma` and `prisma/migrations`.
- Target environment is explicitly identified before any execution.
- Target database backup or snapshot exists and has a recorded reference.
- Migration approval is recorded in `docs/client/MIGRATION_APPROVAL_STATUS.md`.
- Rollback owner is assigned before execution.
- Required maintenance window is approved for the target environment if that environment has live operator traffic.
- The production target is identified independently from the staging/preview target.
- Both Prisma schema validations pass:
  - `./node_modules/.bin/prisma validate --schema=prisma/system.prisma`
  - `./node_modules/.bin/prisma validate --schema=prisma/schema.prisma`
- Operator confirms the migration has not already been applied in the target database.

## Approved working directory

Run the apply command only from a clean checkout of the approved `main` commit (the repository's dedicated main worktree is preferred):

```text
/Users/Office/Repos/prochattools/clients/jc-citadel/jpv-bootcamp
```

## Approved apply sequence

Run the migration rehearsal before the target apply. This is a local/static
check and does not connect to or modify the production database:

```bash
pnpm staging:migration-rehearsal
```

Capture the rehearsal evidence before applying:

```bash
pnpm staging:migration-rehearsal:evidence
```

Run the repository migration preflight before the apply command:

```bash
pnpm staging:migration-preflight
```

1. Verify the exact commit with `git log --oneline -1`.
2. Confirm the target environment variables are already loaded through the approved production environment-management path.
3. Confirm backup evidence and migration approval reference.
4. Run the exact apply command:

```bash
./node_modules/.bin/prisma migrate deploy --schema=prisma/system.prisma
```

Rules:

- Do not wrap the command in shell interpolation.
- Do not echo secret values.
- Do not bundle deployment, provider checks, or application startup into the migration command.
- Do not call Stripe, Resend, or any provider from this sequence.

Migration safety: this migration only adds a nullable `phone` column with `IF NOT EXISTS`. It does not update, delete, duplicate, or reinterpret existing rows.

## Post-apply verification

After the command finishes, verify:

1. The migration is recorded by Prisma for the target database.
2. The `support_requests` table exists.
3. `support_requests.phone` exists and is nullable.
4. Required indexes exist:
   - `support_requests_dedupe_key_key`
   - `support_requests_normalized_email_idx`
   - `support_requests_review_status_idx`
   - `support_requests_notification_status_idx`
   - `support_requests_created_at_idx`
5. Required defaults and constraints remain present:
   - `review_status` defaults to `pending`
   - `notification_status` defaults to `pending`
   - `notification_attempt_count` defaults to `0`
   - `dedupe_key` remains unique
6. No unrelated schema drift is introduced.
7. Repository schema validation still passes:

```bash
./node_modules/.bin/prisma validate --schema=prisma/system.prisma
./node_modules/.bin/prisma validate --schema=prisma/schema.prisma
./node_modules/.bin/tsx scripts/support_request_schema_contract.test.ts
```

8. The support route remains operationally bounded:
   - persistence-first
   - dedupe preserved
   - queued-notification state preserved
   - no access grant side effect
9. Rollback trigger criteria are re-evaluated before leaving the maintenance window.

## Rollback strategy

Primary rollback strategy: restore-based rollback from the approved pre-migration backup or snapshot.

Classification:

- Primary rollback type: restore-based
- Secondary rollback type: forward-fix only when restore is not appropriate
- Manual SQL rollback: allowed only after explicit operator approval and only when the table contains no accepted production data that must be preserved

Important warning:

- `support_requests` is additive. If real support data has been written after apply, dropping the table is data-destructive.
- The commented `DROP INDEX` and `DROP TABLE` notes inside the migration file are manual recovery notes, not the default rollback plan.

Post-rollback verification:

1. Confirm the database is back on the approved pre-migration state.
2. Re-run both Prisma schema validations.
3. Confirm the application is still on the approved code version for that restored state.
4. Record the exact recovery evidence and owner decision.

Repository-owned rollback evidence checklist:

- `docs/release/ROLLBACK_EVIDENCE_CHECKLIST.md`

## Rollback trigger criteria

Trigger rollback or restore review if any of the following occur:

- migration command fails partially or returns an unexpected error;
- table or index verification fails;
- unrelated schema drift appears;
- support route or schema contract fails after apply;
- backup evidence is found invalid after execution;
- operator cannot prove the target database matches the approved environment.

## Abort conditions

Abort before execution if any of the following are true:

- branch is not `main`;
- commit does not match the approved candidate;
- `prisma` or `prisma/migrations` paths are dirty;
- backup or snapshot evidence is missing;
- approval record is missing;
- rollback owner is missing;
- schema validation fails;
- target environment cannot be identified confidently;
- execution would be bundled with deployment or provider activity;
- the target database is not the production database/schema for `jpvbootcamp.com`.

## Evidence to capture

- operator name
- date and timestamp
- approved branch and commit
- target environment label
- backup or snapshot reference
- migration approval reference
- command result
- post-apply verification notes
- rollback trigger evaluation

Do not paste secrets, database URLs, or provider credentials into evidence.
