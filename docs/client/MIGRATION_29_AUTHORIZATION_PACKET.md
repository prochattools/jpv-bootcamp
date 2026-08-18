# Migration 29 Authorization Packet

**FINAL PRE-MIGRATION CLOSURE — 2026-08-08**

## Exact commit

Verify with `git log --oneline -1` before operator action:

```
43d569211acde5ae80f6e33524d40d432b417ce8 fix: align Payload package family from 3.86.0 to 3.87.1 to resolve peer-dependency mismatch
```

Push CI run: `31278379259` (status: success)

## Migration 29 inventory

Single Payload migration pending:

- Migration name: `20260804_050000_member_account_action_reservations`
- Purpose: Durable member account action reservation/finalization hardening
- Adds columns to `members_email_verification_records`:
  - `reservation_nonce` (unique, binary)
  - `reserved_at` (timestamp)
  - `lease_expires_at` (timestamp)
  - `result_fingerprint` (bytea)
- Enables:
  - Reservation lease locking (prevents concurrent mutations)
  - Result finalization tracking (proves completion before release)
  - Atomic nonce invalidation (prevents replay)

## Pre-apply verification (READ-ONLY)

Operator must run:

```bash
pnpm staging:payload-migration-plan \
  --expected-commit=43d569211acde5ae80f6e33524d40d432b417ce8 \
  --environment=staging \
  --target-id=jpvbootcamp-staging \
  --expected-schema=jpvbootcamp_staging \
  --expected-hostname=<db-host> \
  --expected-database=jpvbootcamp
```

Expected result: `plan_ok` with:
- `appliedCount: 28`
- `pendingMigrations: ['20260804_050000_member_account_action_reservations']`
- `blockerCodes: []`
- `prismaHealthy: true`

## Authorization requirements

Operator must provide:

1. **Target authorization**: Written approval for `jpvbootcamp_staging` schema on staging database
2. **Backup evidence**: Pre-apply full backup with timestamp and checksum
3. **Maintenance window**: Exact time window (UTC), rollback SLA
4. **Rollback owner**: Named operator responsible for recovery if needed
5. **Post-apply verification**: Confirm all 29 migrations applied and Prisma healthy

## Apply command

When authorized:

```bash
pnpm staging:payload-migration-apply \
  --expected-commit=43d569211acde5ae80f6e33524d40d432b417ce8 \
  --environment=staging \
  --target-id=jpvbootcamp-staging \
  --expected-schema=jpvbootcamp_staging \
  --expected-hostname=<db-host> \
  --expected-database=jpvbootcamp \
  --backup-evidence-id=<backup-id> \
  --maintenance-window-id=<window-id> \
  --operator-id=<operator> \
  --rollback-owner=<owner>
```

## Hard stops

- Do NOT apply without written staging target authorization
- Do NOT apply without pre-apply backup and evidence
- Do NOT apply without designated rollback owner
- Do NOT deploy without successful apply verification
- Apply does NOT authorize deployment or production action

## Next gates (after apply)

1. Post-apply migration status verification: `pnpm staging:migration-status`
2. Exact-SHA staging deployment (separate guarded workflow)
3. Staging smoke verification
4. External sign-off and acceptance

## Status update

After any operator action, update `docs/client/MIGRATION_APPROVAL_STATUS.md` with result code and timestamp.
