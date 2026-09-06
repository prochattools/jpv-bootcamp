# Migration Approval Status

> **Historical record — not current operator state.** The 35/35 values and
> deployment details below belong to the 2026-08-19 checkpoint. Later 36/36
> records are also historical environment evidence. Current staging applied
> state is unknown until a fresh read-only exact-state probe is captured; see
> `docs/release/REPOSITORY_RECONCILIATION_CURRENT_TRUTH_2026-09-06.md`.
> Production remains unauthorized by this record.

<!-- Reconciliation note 2026-08-19: MIGRATION INVENTORY EXTENDED TO 35. Migrations 30-35 (member_profile_parity, portal_settings, and associated hardening) added and applied to staging. Authorization cycle reset. Branch HEAD advances from 43d569211acde5ae80f6e33524d40d432b417ce8 to current tip. All 35 migrations confirmed applied on staging. Authorization required before any production migration. -->

## STAGING MIGRATION COMPLETE — 2026-08-19

All staging migration and acceptance gates are closed. The following supersedes all prior BLOCKED/pending status lines.

- **Current status:** `STAGING MIGRATION COMPLETE`
- **Branch:** `feature/course-branding-and-preview`
- **Deployed SHA:** `abf43893dc3f9980cc8eadc997cd7935e86e614f`
- **Deploy run:** `32352382852` (GitHub Actions `deploy-preview.yml`)
- **Staging app:** `clients-jpv-bootcamp-app-tp9xrk` / `I_2Vukga3cc3ZhaG-mUzU`
- **Database:** `jpvbootcamp`, schema `jpvbootcamp_staging`
- **Payload migrations applied:** `35/35` (all Payload migrations including migrations 30–35 added and applied)
- **Legacy import operations:** `935/935` proposed operations applied; 2 historical failed ledger attempts superseded/audit-history-only
- **Members:** 51 total — 12 active (all with `emailVerifiedAt`), 39 blocked; 0 active without `emailVerifiedAt`
- **Login verified:** `westhoek@hotmail.com` login confirmed on staging
- **Staging email delivery:** `sent`, Resend ID `3affb3ee-38ad-4e6e-9fe1-55d202712b8c`
- **Public media:** 24/24 uploaded
- **Private media:** 25/25 uploaded
- **Lesson resources:** 25/25 published
- **Protected download (anonymous):** 404 (correct)
- **Protected download (authenticated entitled member):** 200 + real file content (correct)
- **Playwright staging tests:** 84 passed / 0 failed
- **Admin responsive tests:** 14/14
- **Migration contract test:** PASS
- **`DEPLOYMENT_ENV`:** `staging` confirmed in running container
- **Production migration / cutover:** NOT performed, NOT authorized. Production `jpvbootcamp.com` routing was manually restored after an unrelated incident; no production operation is authorized by this document.
- **Operator handoff summary:** `docs/client/OPERATOR_HANDOFF_SUMMARY.md`
- **Evidence review checklist:** `docs/client/EVIDENCE_REVIEW_CHECKLIST.md`
- **Status update procedure:** `docs/client/STATUS_UPDATE_PROCEDURE.md`
- **Rollback/recovery runbook:** `docs/client/MIGRATION_REHEARSAL_RUNBOOK.md`

---

> **Historical pre-closeout status lines** (superseded 2026-08-19 — retained as audit history only):
>
> - Prior status: BLOCKED (pre-migration-29 apply)
> - Prior branch tip: `82a3a9f176ada26e958757802772807a24303f8f`
> - Prior migration inventory checkpoint: `43d569211acde5ae80f6e33524d40d432b417ce8`
> - Migrations applied at that checkpoint: No (migration-29 pending)
> - Guarded read-only plan run `31215369413` at `9e068cc8b0a5ec9573732fee3a78bed9995787a6` returned `plan_ok`: 28 applied, migration-29 solely missing
> - Migration inventory was subsequently extended to 35; migrations 30–35 added and applied to staging; authorization cycle reset at that point

## Authorization checklist — COMPLETE (2026-08-19)

- [x] Repository-owned implementation complete (164/164 tests)
- [x] Type-check passed (tsc --noEmit)
- [x] Production build passed
- [x] Production audit passed (5 moderate, no high/critical)
- [x] Payload dependency family aligned (3.87.1)
- [x] Push CI passed (run 31278379259, status: success, SHA: 43d569211acde5ae80f6e33524d40d432b417ce8) — superseded by final SHA `abf43893dc3f9980cc8eadc997cd7935e86e614f`
- [x] Migrations applied: 35/35 to `jpvbootcamp_staging` — includes migration-29 plus migrations 30–35
- [x] Post-apply verification: all 35 applied, Prisma healthy, `DEPLOYMENT_ENV=staging` confirmed
- [x] Exact-SHA staging deployment: SHA `abf43893dc3f9980cc8eadc997cd7935e86e614f`, deploy run 32352382852
- [x] Staging smoke: Playwright 84/0, admin-responsive 14/14, migration contract test PASS
- [x] Provider and email live verification: Resend delivery confirmed, ID `3affb3ee-38ad-4e6e-9fe1-55d202712b8c`
- [x] Staging sign-off: all acceptance criteria verified — members, media, resources, downloads, login
- [ ] Production migration / cutover — NOT authorized; staging acceptance only
