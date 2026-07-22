# Current Handoff

## Repo
jpv-bootcamp (feature/course-branding-and-preview)

## Tool
Claude Code

## Session date
2026-07-22 (started 2026-07-21)

## HEAD
`eb03a08` — feat(design): unify JPV release experience
Plus uncommitted session changes (see Files touched below)

## Goal (12-step audit + migration rehearsal release candidate)

### Completed this session

| Step | Status | Evidence |
|------|--------|---------|
| 1 — Identity proof | ✅ | branch=feature/course-branding-and-preview, HEAD=eb03a08, deployed image confirmed |
| 2 — Doc reconciliation | ✅ | CURRENT_WORK_HANDOFF, GO_NO_GO_CHECKLIST, PREVIEW_RELEASE_READINESS, ROADMAP_PROGRESS_STATUS all updated to eb03a08 |
| 3 — Architecture audit | ✅ | P0=none, P1=doc staleness (fixed), P2=synchronous auto-provision+auth fallback (both safe) |
| 4 — Deploy/smoke proof | ✅ | Dokploy API confirmed ghcr.io/prochattools/jpv-bootcamp:eb03a08...; 58/58 staging smoke PASS |
| 5 — Source snapshot freeze | ✅ | 21 rows extracted from jpvbootcamp_rehearsal.customer_provisioning (mirror of staging) |
| 6 — Disposable rehearsal DB | ✅ | jpvbootcamp_rehearsal schema on 127.0.0.1:5432/jpv-bootcamp |
| 7 — Migration apply (rehearsal) | ✅ | Apply 1: processed=21 errors=0 skipped=0; members=21 billing=21 subs=21 grants=16 |
| 8 — Idempotent rerun + rollback + reapply | ✅ | Apply 2: processed=21 errors=0 (idempotency PASS); Rollback: all rows removed; Apply 3: processed=21 errors=0 |
| 9 — Auth cohort rehearsal | ✅ | Invitation cohort=21 (16 active, 5 pending), entitlement grants=16, FK integrity PASS, source_id uniqueness PASS |
| 10 — Source ID constraint assessment | ✅ | No UNIQUE constraint needed; single-process + deterministic sha256 ensures idempotency |
| 11 — Partial failure/resume + failure modes | ✅ | Checkpoint resume: skipped=10 processed=21 errors=0; all failure modes documented |
| 12 — Evidence file + doc update | ✅ | docs/LEGACY_MIGRATION_REHEARSAL_EVIDENCE.md created; GO_NO_GO_CHECKLIST updated |

### Additional work
- **Bug fixed**: `scripts/migration/legacyMigration.ts` — access grant UPDATE failed with "inconsistent types deduced for parameter $4" on PostgreSQL 15 when varchar column appears in both SET and CASE WHEN IS DISTINCT FROM in same statement. Fix: `$4::varchar` explicit cast on `resource_id` column.
- **Search path fix**: Added `SET search_path TO ${schemaName},public` after `client.connect()` in `runMigration()` to ensure enum type OIDs resolve correctly for non-public schema.
- **Security advisories**: Upgraded fast-uri (3.1.3→3.1.4 override) and sharp (^0.33→^0.35, +override) to resolve 2 new high-severity npm advisories. Audit gate: 3 moderate remaining (non-blocking).

## Test results
- `pnpm test:release` — PASS 151/151 (2026-07-22)
- `pnpm exec tsc --noEmit` — PASS, no errors
- Migration rehearsal — PASS: idempotency PASS, rollbackProof PASS, preexisting PASS, reapply PASS
- Audit — PASS high-severity gate (3 moderate only)

## Files touched
- `docs/CURRENT_WORK_HANDOFF.md` — updated HEAD to eb03a08
- `docs/PREVIEW_RELEASE_READINESS.md` — updated migration inventory, added "No migrations have been applied." policy statement
- `docs/client/ROADMAP_PROGRESS_STATUS.md` — updated DEPLOYMENT HEAD, staging smoke confirmed
- `docs/release/GO_NO_GO_CHECKLIST.md` — updated all gates; rehearsal evidence; audit fix
- `docs/LEGACY_MIGRATION_REHEARSAL_EVIDENCE.md` — NEW: full rehearsal evidence file (Steps 7–12)
- `scripts/migration/legacyMigration.ts` — fix enum type inference bug + SET search_path
- `package.json` — sharp ^0.33→^0.35, fast-uri override 3.1.3→3.1.4, sharp override added
- `pnpm-lock.yaml` — updated for sharp/fast-uri changes
- `.ai/current.md` — this file

## Untracked files (review before staging)
- `.ai/SESSION_COMPLETION_2026_07_20.md` — old session file, safe to ignore
- `.ai/SESSION_REPORT_SECURITY_RECONCILIATION_2026_07_20.md` — old session file, safe to ignore
- `.migration-rehearsal-checkpoints/` — local transient checkpoint files
- `docs/LEGACY_MIGRATION_REHEARSAL_EVIDENCE.md` — NEW, should be staged
- `newrelic_agent.log` — not for commit

## Formal state
NO-GO (unchanged) — external gates outstanding:
- Programme content approval
- table-plan-to-Free decision
- account-column rename decision
- Migration authorization + apply via approved path
- Post-migration verification
- Staging rollback evidence
- Payload/admin operator login
- Monitoring owner assignment
- Formal approval

## Next steps for operator
1. Review and sign off `docs/LEGACY_MIGRATION_REHEARSAL_EVIDENCE.md`
2. Update GO_NO_GO_CHECKLIST with per-operator authorization for remaining external gates
3. Execute staging migration apply via `pnpm migration:legacy -- --mode apply` (after authorization)
4. Run `pnpm staging:migration-rehearsal:evidence` on live staging after apply
5. Submit formal approval record

## Resume prompt
Resume from jpv-bootcamp (feature/course-branding-and-preview). Session completed Steps 1–12 of the migration rehearsal release candidate goal. eb03a08 HEAD unchanged. All 151/151 release tests pass. Migration rehearsal PASS (all 4 proofs). Two security advisories patched. Remaining work: operator authorization and staging apply — not automatable.
