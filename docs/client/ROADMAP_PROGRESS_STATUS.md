# JPV Bootcamp — Roadmap Progress Status

Canonical progress and current-position record for the `feature/course-branding-and-preview` branch.

Cross-links:
- Review packet: `docs/client/PAYLOAD_ONLY_FREE_PRO_REVIEW_PACKET.md`
- Status update procedure: `docs/client/STATUS_UPDATE_PROCEDURE.md`
- Migration approval packet: `docs/client/MIGRATION_APPROVAL_PACKET.md`
- Migration approval status: `docs/client/MIGRATION_APPROVAL_STATUS.md`
- Migration rehearsal runbook: `docs/client/MIGRATION_REHEARSAL_RUNBOOK.md`
- Operator handoff summary: `docs/client/OPERATOR_HANDOFF_SUMMARY.md`
- Evidence review checklist: `docs/client/EVIDENCE_REVIEW_CHECKLIST.md`
- Staging smoke checklist: `docs/client/STAGING_SMOKE_CHECKLIST.md`
- Staging smoke evidence template: `docs/client/STAGING_SMOKE_EVIDENCE_TEMPLATE.md`
- Provider/email readiness: `docs/client/PROVIDER_EMAIL_READINESS.md`
- Provider/email evidence template: `docs/client/PROVIDER_EMAIL_EVIDENCE_TEMPLATE.md`
- Canonical integration plan: `docs/PAYLOAD_INTEGRATION_PLAN.md`
- Preview release readiness: `docs/PREVIEW_RELEASE_READINESS.md`
- Migration sources: `prisma/migrations/` and `src/migrations/`

---

## Current Position

**CURRENT POSITION:**
Payload-only Free/Pro refit is committed, pushed, clean, validated, staging-hardened, and now has migration approval, approval-status, rehearsal-runbook, operator handoff, evidence-review, evidence-template, and status-update-procedure docs prepared on `feature/course-branding-and-preview`.

**NEXT BLOCKER:**
Target-environment approval for table-plan-to-Free mapping is still required before migration rehearsal or execution.

**NEXT EXECUTABLE TASK:**
Human/operator signs the migration approval status, then captures staging smoke and provider/email evidence without applying migrations.

**DO NOT:**
Do not apply migrations. Do not touch `main`.

---

## Branch and Deployment State

| Field | Value |
| --- | --- |
| Branch | `feature/course-branding-and-preview` |
| Staging deployment target | This feature branch is the staging / production-staged deployment branch |
| Last recorded validated baseline before this status update | `3bc8b7e docs: finalize operator handoff evidence review` |
| Branch tip verification | Verify the current branch tip with `git log --oneline -1` before operator action |
| PR / review URL | `https://github.com/prochattools/jpv-bootcamp/pull/2` |
| Migrations applied | None |
| Migration approval status | **Blocked** — table-plan-to-Free mapping requires explicit target-environment approval |
| Approved migration path | Must go through the approved database migration path; pushing or deploying must not auto-apply |

---

## Progress Table — 8 July 2026

Basis: v3.3 baseline set in `docs/PAYLOAD_INTEGRATION_PLAN.md` (expanded-platform ~58%, first core go-live ~62%, build foundation ~78%, expanded launch ~52%). Percentages marked as estimates; delta is justified by specific completed work listed in Evidence column.

| Area / Phase | Previous | Current | Delta | Evidence | Remaining blocker |
| --- | ---: | ---: | ---: | --- | --- |
| Overall expanded platform | ~58% | ~71% | +13% | Free/Pro refit committed/pushed/clean; legacy paths removed; billing hardening; focused validation passed; migration approval/status/runbook/evidence docs and status-update procedure added; Prisma and tsc validated | Live cutover unapproved; migrations unapplied; production content incomplete; provider email live verification pending |
| Core staging readiness | ~68% | ~95% | +27% | Branch pushed, clean, validated, hardened; shadow sync fixed; sponsored access corrected; docs hardened; approval packet, approval status, rehearsal runbook, operator handoff, evidence review, evidence templates, smoke checklist, provider/email readiness checklist, and status procedure prepared | Migration approval; post-refit staging smoke; provider email live verification |
| Build foundation | ~78% | ~88% | +10% | Payload-only refit; legacy code deleted; `server-only@0.0.1` added; type-check clean; Prisma schemas valid; SVG assets validated; checkout helper extraction and same-origin return URL guard added | Migration approval and rehearsal |
| Testing / release readiness | ~70% | ~90% | +20% | Focused checkout validation, migration static coverage, and status-doc consistency coverage added; approval-status, rehearsal, evidence, operator handoff, and evidence-review safety tests added; billing, entitlement, course access, shadow sync, sponsored claim/decision helpers covered | Batch-runner timing artifact (tests pass individually); migration rehearsal not executed |
| Migration readiness | ~25% | ~52% | +27% | Migration sources written and reviewed; inventory unified to 11 in policy/manifest/preflight; approval packet, approval status, runbook, operator handoff, evidence review, evidence templates, status procedure, and safety tests prepared; table-plan-to-Free migration static checks expanded | table-plan-to-Free approval required; no migrations applied; approved apply path not yet executed |
| Live cutover readiness | ~12% | ~20% | +8% | Code is staging-ready and validated; migration sources, staging smoke checklist, evidence templates, operator handoff, evidence review checklist, and status procedure are prepared; provider/email readiness checklist and evidence template are prepared | Migrations unapplied; target-environment approval pending; provider email live verification pending; course content incomplete |

---

## Validation Evidence (latest pass)

Commands passed against the current working branch state:

```bash
git diff --check
./node_modules/.bin/tsc --noEmit --pretty false --incremental false
./node_modules/.bin/prisma validate --schema=prisma/system.prisma
./node_modules/.bin/prisma validate --schema=prisma/schema.prisma
./node_modules/.bin/tsx scripts/preview_migration_inventory.test.ts
./node_modules/.bin/tsx scripts/migration_readiness_static.test.ts
./node_modules/.bin/tsx scripts/migration_rehearsal_safety.test.ts
./node_modules/.bin/tsx scripts/staging_evidence_static.test.ts
./node_modules/.bin/tsx scripts/operator_handoff_static.test.ts
./node_modules/.bin/tsx scripts/billing_readiness_report.test.ts
./node_modules/.bin/tsx scripts/stripe_checkout_validation.test.ts
./node_modules/.bin/tsx scripts/member_checkout.test.ts
./node_modules/.bin/tsx scripts/membership_email_copy.test.ts
./node_modules/.bin/tsx scripts/payload_course_stripe_shadow_sync.test.ts
./node_modules/.bin/tsx scripts/payload_entitlement_evaluator.test.ts
./node_modules/.bin/tsx scripts/payload_course_access_service.test.ts
./node_modules/.bin/tsx scripts/tests/sponsored_claim_helpers.ts
./node_modules/.bin/tsx scripts/tests/sponsored_decision_helpers.ts
```

Previously recorded suite total: **68 pass, 0 fail**. The checkout hardening tests listed above also pass individually. Batch-runner timing artifact noted; affected tests pass individually.

---

## Grep Exception Summary

Expected and allowed exceptions only:

- `wp_*` strings remain only inside `prisma/migrations/20260707_120000_rename_account_identity_columns/migration.sql` — required for column/index rename DDL.
- `STRIPE_PRICE_TABLE` remains only in a negative readiness assertion verifying that membership checkout no longer uses the old table price configuration.
- Removed plan labels may appear in focused checkout tests only as rejected negative cases.
- `pnpm-lock.yaml` can match `libvips` package names and integrity hashes (Sharp dependency — not project integration references).
- Review packet, roadmap, approval packet, approval status, rehearsal runbook, operator handoff, evidence review, evidence templates, and staging/provider checklists may mention removed integration/product names only to state they must not remain as active paths.

Zero active residue confirmed.

---

## Remaining Risks

| Risk | Severity | Notes |
| --- | --- | --- |
| table-plan-to-Free migration mapping | **Blocker** | Legacy table-plan subscription values become controlled Free access. Requires explicit target-environment approval before execution. |
| account-column rename migration | Medium | The Prisma rename migration is record-preserving, but it still changes live column/index names and must be explicitly approved with the target-environment rollback plan. |
| provider email live verification | Medium | Repository and staging docs are ready, but live delivery verification remains a separate operator approval path. |
| evidence capture readiness | Low | Evidence templates now exist, but operators still need to populate them after manual staging/provider verification. |
| operator handoff ambiguity | Low | The new handoff summary and evidence review checklist reduce drift risk for future operators, but they still require explicit human approval. |
| approval drift risk | Medium | Future agents could mistake the branch as rehearsal-approved without the status tracker and runbook. The new status and runbook docs reduce that risk but do not replace written approval. |
| Batch-runner timing artifact | Low | Focused tests pass individually; batch runner can still report timing-sensitive noise. |

---

## Next Executable Tasks (in order, no migrations required)

1. Review and approve `docs/client/MIGRATION_APPROVAL_PACKET.md` and `docs/client/MIGRATION_APPROVAL_STATUS.md` for the target environment.
2. Use `docs/client/MIGRATION_REHEARSAL_RUNBOOK.md` for static-only rehearsal review and evidence capture.
3. Populate `docs/client/STAGING_SMOKE_EVIDENCE_TEMPLATE.md` and `docs/client/PROVIDER_EMAIL_EVIDENCE_TEMPLATE.md` after operator-run staging/provider checks.
4. Review `docs/client/OPERATOR_HANDOFF_SUMMARY.md` and `docs/client/EVIDENCE_REVIEW_CHECKLIST.md` before closing out the operator pass.
5. Perform the approved manual smoke preparation using `docs/client/STAGING_SMOKE_CHECKLIST.md`.
6. Apply `prisma/migrations/20260707_120000_rename_account_identity_columns/migration.sql` only after approval and rehearsal.
7. Apply `src/migrations/20260707_130000_remove_table_plan_from_payload_enums.ts` only after explicit table-plan-to-Free mapping approval.

## No Migration Apply

No migrations have been applied on this branch.

---

## Migration Warning (repeated for visibility)

The Payload migration `20260707_130000_remove_table_plan_from_payload_enums` maps legacy table-plan subscription values to `free` and removes obsolete allowed-plan rows. This is data-preserving at the record level but business-significant: legacy table-plan subscribers become controlled Free access rather than a paid product label.

**This migration must not be applied until the table-plan-to-Free mapping is explicitly approved for the target environment.**

See `docs/PREVIEW_RELEASE_READINESS.md` for the canonical eleven-migration inventory and independent authorization templates.
