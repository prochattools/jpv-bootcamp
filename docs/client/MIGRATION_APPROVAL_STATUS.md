# Migration Approval Status

<!-- Reconciliation note 2026-08-19: MIGRATION INVENTORY EXTENDED TO 35. Migrations 30-35 (member_profile_parity, portal_settings, and associated hardening) added and applied to staging. Authorization cycle reset. Branch HEAD advances from 43d569211acde5ae80f6e33524d40d432b417ce8 to current tip. All 35 migrations confirmed applied on staging. Authorization required before any production migration. -->

- Current status: `BLOCKED`
- Branch: `feature/course-branding-and-preview`
- Branch tip verification: current HEAD is `82a3a9f176ada26e958757802772807a24303f8f`; verify with `git log --oneline -1` before operator action
- Push CI run: `pending fresh green run on 82a3a9f`
- Migrations applied: `No`
- Target-environment table-plan-to-Free approval: `Pending`
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
