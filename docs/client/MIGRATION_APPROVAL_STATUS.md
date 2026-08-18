# Migration Approval Status

<!-- Reconciliation note 2026-08-08: FINAL PRE-MIGRATION CLOSURE. Current branch HEAD is 43d569211acde5ae80f6e33524d40d432b417ce8 (CI run 31278379259, success). Dependency alignment complete (Payload 3.87.1 family). Migration inventory is 29 entries. No migrations have been applied. Final closure gates passed (164/164 release tests, type-check, build, audit). Pre-apply migration 29 plan requires operator authorization with exact commit. -->

- Current status: `READY FOR FINAL AUTHORIZATION`
- Branch: `feature/course-branding-and-preview`
- Branch tip verification: current HEAD is `43d569211acde5ae80f6e33524d40d432b417ce8`; verify with `git log --oneline -1` before operator action
- Push CI run: `31278379259` (status: success, SHA: 43d569211acde5ae80f6e33524d40d432b417ce8)
- Migrations applied: `No`
- Repository-owned gates: `PASSED (164/164 tests, type-check, build, audit, dependency alignment)`
- Final exact-SHA: `43d569211acde5ae80f6e33524d40d432b417ce8`
- Operator handoff summary: `docs/client/OPERATOR_HANDOFF_SUMMARY.md`
- Evidence review checklist: `docs/client/EVIDENCE_REVIEW_CHECKLIST.md`
- Status update procedure: `docs/client/STATUS_UPDATE_PROCEDURE.md`
- Payload migration 29 (member account action reservations): `STAGED FOR AUTHORIZATION`
- Read-only pre-apply plan: `READY FOR OPERATOR EXECUTION (requires staging database credentials)`
- Rollback/recovery runbook: `docs/client/MIGRATION_REHEARSAL_RUNBOOK.md`
- Next allowed task: `Operator runs read-only plan against exact SHA. If plan_ok, operator authorizes migration-29 apply with backup, maintenance window, and rollback ownership.`
- Not allowed: `Do not apply migrations without written target-environment approval. Do not touch main. Do not run DB-mutating commands without authorization.`

## Authorization checklist

- [x] Repository-owned implementation complete (164/164 tests)
- [x] Type-check passed (tsc --noEmit)
- [x] Production build passed
- [x] Production audit passed (5 moderate, no high/critical)
- [x] Payload dependency family aligned (3.87.1)
- [x] Push CI passed (run 31278379259, status: success, SHA: 43d569211acde5ae80f6e33524d40d432b417ce8)
- [ ] Operator: Execute read-only pre-apply plan against exact SHA 43d569211acde5ae80f6e33524d40d432b417ce8
- [ ] Operator: Confirm plan returns `plan_ok` (migration 29 solely missing, no unexpected/duplicate/malformed records, Prisma healthy)
- [ ] Operator: Authorize migration-29 apply with target-environment, backup evidence, maintenance window, rollback owner
- [ ] Operator: Execute guarded apply run (no deployment without explicit handoff)
- [ ] Operator: Execute post-apply verification (all 29 applied, Prisma healthy)
- [ ] Operator: Execute exact-SHA staging deployment
- [ ] Operator: Execute staging smoke verification
- [ ] External: Provider and email live verification
- [ ] External: Staging sign-off and acceptance
