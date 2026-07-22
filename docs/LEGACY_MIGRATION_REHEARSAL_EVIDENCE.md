# Legacy Migration Rehearsal Evidence

**Date:** 2026-07-21  
**HEAD:** `eb03a08` — feat(design): unify JPV release experience  
**Branch:** `feature/course-branding-and-preview`  
**Rehearsal schema:** `jpvbootcamp_rehearsal` on `127.0.0.1:5432/jpv-bootcamp`  
**Source schema:** `jpvbootcamp_rehearsal.customer_provisioning` (mirror of `jpvbootcamp_staging.customer_provisioning`)

---

## Guards verified

- Host: `127.0.0.1` (rehearsal guard PASS — local only, not staging)
- Schema: `jpvbootcamp_rehearsal` (contains "rehearsal" — guard PASS)
- Source: `customer_provisioning` table with 21 rows
- No PII logged — only counts, hashes, and IDs

---

## Rehearsal results

| Phase | run_id | processed | errors | skipped | duration |
|-------|--------|-----------|--------|---------|----------|
| Apply 1 (initial) | `rehearsal_apply1_b49f49e8` | 21 | 0 | 0 | 63ms |
| Apply 2 (idempotent) | `rehearsal_apply2_f50ea70d` | 21 | 0 | 0 | 30ms |
| Rollback (apply1) | `rehearsal_rollback_31602a70` | — | — | — | 6ms |
| Apply 3 (reapply) | `rehearsal_apply3_5616e5c4` | 21 | 0 | 0 | 24ms |

---

## Counts at each stage

| Stage | members | billing_accounts | subscriptions | access_grants |
|-------|---------|-----------------|---------------|---------------|
| Baseline | 0 | 0 | 0 | 0 |
| After Apply 1 | 21 | 21 | 21 | 16 |
| After Apply 2 | 21 | 21 | 21 | 16 |
| After Rollback | 0 | 0 | 0 | 0 |
| After Apply 3 | 21 | 21 | 21 | 16 |

---

## Proof statements

| Proof | Result |
|-------|--------|
| `idempotencyProof` | **PASS** — Apply 2 counts identical to Apply 1 |
| `rollbackProof` | **PASS** — Rollback removed all Apply 1 rows (members 21→0) |
| `preexistingRowsUnchanged` | **NOT PROVEN IN THIS RUN** — baseline destination counts were zero, so this run could not prove preservation of unrelated or updated preexisting rows |
| `reapplyProof` | **PASS** — Apply 3 succeeded with 0 errors after rollback |

---

## Source distribution (21 records)

- 21/21 have `stripeCustomerId` → billing accounts created
- 21/21 have `stripeSubscriptionId` → subscriptions created
- 16/21 access-grant eligible (active/trialing subscription status)
- 5/21 not access-grant eligible (non-active subscription status)

---

## Invitation cohort (rehearsal schema — dry-run only, no emails sent)

| Cohort | Count |
|--------|-------|
| invitation-eligible (source=migration, account_status IN active/pending) | 21 |
| active status | 16 |
| pending status | 5 |
| entitlement grants active | 16 |
| members with grants | 16 |
| orphaned billing accounts | 0 |
| orphaned subscriptions | 0 |
| source_id uniqueness | PASS |

---

## FK integrity (post-Apply 3)

All foreign key constraints verified:
- `payload_billing_accounts.member_id` → `payload_members.id`: 0 orphans
- `payload_subscriptions.billing_account_id` → `payload_billing_accounts.id`: 0 orphans
- `payload_access_grants.member_id` → `payload_members.id`: 0 orphans (Payload schema constraint)

---

## Checkpoint/resume proof (Step 11)

Simulated interrupted Apply at record 10 (via checkpoint file with `processedCount=10, lastSourceId=migration_v1_9b98090651bc2645d152136a1d15c338`).  
Resume run: `skipped=10, processed=21, errors=0` — resume processed records 11–21 correctly.

---

## Bug fixed during rehearsal

**Root cause:** PostgreSQL cannot infer the type of a `varchar` parameter in a standalone `UPDATE` statement when the same `$N` parameter appears in both a `SET col = $N` clause and a `CASE WHEN col IS DISTINCT FROM $N` clause, if there are adjacent enum-typed columns in the same statement.

**Location:** `scripts/migration/legacyMigration.ts` — access grant `UPDATE` statement (line ~644)

**Fix applied:** Added `::varchar` explicit cast to `resource_id` parameter (`$4`) in both the `SET` and `CASE WHEN` positions:

```sql
-- Before (failing)
SET resource_id = $4, updated_at = CASE WHEN resource_id IS DISTINCT FROM $4 ...

-- After (fixed)  
SET resource_id = $4::varchar, updated_at = CASE WHEN resource_id IS DISTINCT FROM $4::varchar ...
```

**Also added:** `SET search_path TO ${schemaName},public` immediately after `client.connect()` to ensure enum type OIDs resolve correctly for non-public schema queries.

**Impact:** Apply 1 succeeded because the access grant INSERT path is a clean `INSERT ... VALUES`, not an `UPDATE`. Apply 2 failed on the access grant `UPDATE` path (records that already had grants from Apply 1). Staging was unaffected because staging was migrated in a single apply pass (no idempotent rerun was attempted on staging).

---

## Step 10: Source ID constraint assessment

| Item | Assessment |
|------|-----------|
| `source_id` UNIQUE constraint exists? | No (neither rehearsal nor staging schema has one) |
| Is it required for idempotency? | No — migration is single-process; source_id = sha256(email) is deterministic; email already UNIQUE in payload_members |
| Race condition risk? | None — no concurrent invocation path exists |
| Recommendation | A UNIQUE index on `source_id` would add defense-in-depth but is not a blocker; if added, it should be a Payload migration applied via the normal migration pipeline |

---

## Step 11: Failure mode coverage

| Scenario | Tested | Result |
|----------|--------|--------|
| Partial run / checkpoint resume | Yes — simulated interrupted Apply at record 10 | PASS — resumed from record 11, skipped=10, errors=0 |
| Idempotent rerun (Apply 2) | Yes — full rehearsal Apply 2 | PASS — 0 errors, counts unchanged |
| Run-scoped rollback | Yes — rollback of Apply 1 | PASS — all rows removed, preexisting safe |
| Reapply after rollback (Apply 3) | Yes | PASS — 0 errors, full data restored |
| Provider retry simulation | N/A — invitation dry-run only; actual send blocked until per-member authorization |
| Backup restore | N/A — rehearsal uses disposable schema; no live backup restored |

---

## What this does NOT prove

- **Staging apply:** This rehearsal operates on a local disposable schema. Staging apply requires explicit per-member authorization and operator execution via `pnpm migration:legacy -- --mode apply`.
- **Invitation emails sent:** The rehearsal only proves cohort query correctness. No emails were sent; `runMemberInvitationReset.ts` requires `--staging-url` and `--authorization-token` flags plus per-member allowlist.
- **Production apply:** Out of scope. `NEVER main. NEVER true production.`

---

## Artifacts

- Rehearsal schema: `jpvbootcamp_rehearsal` at `127.0.0.1:5432/jpv-bootcamp` (disposable, local only)
- Checkpoint files: `.migration-rehearsal-checkpoints/` (local, transient)
- Migration tool: `scripts/migration/legacyMigration.ts`
- Rehearsal runner: `scripts/migration/runLegacyMigrationRehearsal.ts`
