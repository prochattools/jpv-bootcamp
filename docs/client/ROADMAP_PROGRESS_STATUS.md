# JPV Bootcamp — Roadmap Progress Status

Canonical progress and current-position record for the `feature/course-branding-and-preview` branch.
Version 3.4 is the current client-plan update; Version 3.3 remains the baseline for comparison.

Cross-links:
- Review packet: `docs/client/PAYLOAD_ONLY_FREE_PRO_REVIEW_PACKET.md`
- Version 3.4 summary: `docs/client/JPV_BOOTCAMP_GO_LIVE_PLAN_V3_4_SUMMARY.md`
- Front-end copy approval: `docs/client/FRONTEND_COPY_APPROVAL_PACKET.md`
- Front-end content request: `docs/client/CLIENT_CONTENT_REQUEST_15_JULY.md`
- Front-end content status tracker: `docs/client/FRONTEND_CONTENT_STATUS_TRACKER.md`
- Front-end acceptance evidence template: `docs/client/FRONTEND_ACCEPTANCE_EVIDENCE_TEMPLATE.md`
- Front-end content intake: `docs/client/FRONTEND_CONTENT_INTAKE_CHECKLIST.md`
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
- Evidence automation: `scripts/create_staging_evidence_artifacts.ts` and `scripts/validate_staging_evidence_artifacts.ts`
- Evidence folder: `docs/client/evidence/`
- Canonical integration plan: `docs/PAYLOAD_INTEGRATION_PLAN.md`
- Preview release readiness: `docs/PREVIEW_RELEASE_READINESS.md`
- Migration sources: `prisma/migrations/` and `src/migrations/`

---

## Current Position

**CURRENT POSITION:**
Payload-only Free/Pro refit is committed, pushed, clean, validated, staging-hardened, and now has migration approval, approval-status, rehearsal-runbook, operator handoff, evidence-review, evidence-template, status-update-procedure, evidence-automation (local-only generator and validator), static-preflight automation, pinned toolchain preflight automation, committed-evidence guard automation, and Version 3.4 summary prepared on `feature/course-branding-and-preview`.

**NEXT BLOCKER:**
Target-environment approval for table-plan-to-Free mapping is still required before migration rehearsal or execution.

**FRONT-END MILESTONE:**
The 15 July 2026 client content/input deadline and the 22 July 2026 front-end website go-live milestone are delivery markers only; they do not authorize migration execution. The handover buffer remains 23 July 2026 and the client-requested finished-by date remains 24 July 2026.

**NEXT EXECUTABLE TASK:**
Run `pnpm toolchain:check` and then `pnpm staging:static-preflight`, then operator completes approval, staging smoke, and provider/email evidence without applying migrations.

**DO NOT:**
Do not apply migrations. Do not touch `main`.

---

## Branch and Deployment State

| Field | Value |
| --- | --- |
| Branch | `feature/course-branding-and-preview` |
| Staging deployment target | This feature branch is the staging / production-staged deployment branch |
| Last recorded validated baseline before this status update | `4a8f79b chore: guard against committed draft evidence` |
| Branch tip verification | Verify the current branch tip with `git log --oneline -1` before operator action |
| PR / review URL | `https://github.com/prochattools/jpv-bootcamp/pull/2` |
| Migrations applied | None |
| Migration approval status | **Blocked** — table-plan-to-Free mapping requires explicit target-environment approval |
| Approved migration path | Must go through the approved database migration path; pushing or deploying must not auto-apply |

---

## Progress Table — 8 July 2026

Basis: v3.3 baseline set in `docs/PAYLOAD_INTEGRATION_PLAN.md` (expanded-platform ~58%, first core go-live ~62%, build foundation ~78%, expanded launch ~52%). Version 3.4 current update records current branch progress on `feature/course-branding-and-preview` with expanded-platform ~74%, core staging readiness ~97%, build foundation ~89%, testing/release readiness ~95%, migration readiness ~55%, and live cutover readiness ~20%.

| Area / Phase | Previous | Current | Delta | Evidence | Remaining blocker |
| --- | ---: | ---: | ---: | --- | --- |
 | Overall expanded platform | ~58% | ~75% | +17% | Free/Pro refit committed/pushed/clean; legacy paths removed; billing hardening; focused validation passed; migration approval/status/runbook/evidence docs, status-update procedure, evidence automation (local-only generator and validator), static-preflight automation, committed-evidence guard, front-end milestone static test, and Version 3.4 summary added; partner referral MVP, course programme MVP shell, and pay-it-forward MVP added; Prisma and tsc validated | Live cutover unapproved; migrations unapplied; client content/input due 15 July; production content incomplete; provider email live verification pending |
| Core staging readiness | ~68% | ~97% | +29% | Branch pushed, clean, validated, hardened; shadow sync fixed; sponsored access corrected; docs hardened; approval packet, approval status, rehearsal runbook, operator handoff, evidence review, evidence templates, smoke checklist, provider/email readiness checklist, status procedure, evidence automation, static-preflight automation, pinned toolchain preflight, committed-evidence guard, and Version 3.4 summary prepared | Migration approval; post-refit staging smoke; provider email live verification |
| Build foundation | ~78% | ~91% | +13% | Payload-only refit; legacy code removed; `server-only@0.0.1` added; type-check clean; Prisma schemas valid; SVG assets validated; checkout helper extraction and same-origin return URL guard added; pinned toolchain preflight added and validated; course programme MVP shell added with 8-week typed catalog, public overview route, and static tests; pay-it-forward typed validation service and public support route added | Migration approval and rehearsal |
| Testing / release readiness | ~70% | ~96% | +26% | Focused checkout validation, migration static coverage, status-doc consistency coverage, evidence-package safety tests, committed-evidence guard tests, version-3.4 plan consistency test, front-end milestone static test, and static-preflight package guard tests added; approval-status, rehearsal, evidence, operator handoff, evidence-review, evidence-automation, and static-preflight safety tests added; billing, entitlement, course access, shadow sync, sponsored claim/decision helpers covered; pay-it-forward MVP test added to preflight | Batch-runner timing artifact (tests pass individually); migration rehearsal not executed |
| Migration readiness | ~25% | ~55% | +30% | Migration sources written and reviewed; inventory unified to 11 in policy/manifest/preflight; approval packet, approval status, runbook, operator handoff, evidence review, evidence templates, status procedure, evidence automation, static-preflight, committed-evidence guard, and safety tests prepared; table-plan-to-Free migration static checks expanded | table-plan-to-Free approval required; no migrations applied; approved apply path not yet executed |
| Live cutover readiness | ~12% | ~20% | +8% | Code is staging-ready and validated; migration sources, staging smoke checklist, evidence templates, operator handoff, evidence review checklist, status procedure, and evidence automation are prepared; provider/email readiness checklist and evidence template are prepared; front-end website go-live milestone is defined for 22 July 2026 with 23 July handover and 24 July finish-by dates | Migrations unapplied; target-environment approval pending; provider email live verification pending; course content incomplete |

---

## Front-End Milestone Readiness Note

**Front-end delivery readiness / evidence preparation: ~88–90%**

The front-end website go-live milestone (22 July 2026) is delivery-ready from the code and infrastructure perspective, and now has a client-sendable content request, operator status tracker, and manual front-end acceptance evidence template. No acceptance is claimed yet. Remaining blockers are external:

- **Client content/input due 15 July 2026** — client must approve current wording/placeholders or provide replacement copy using `docs/client/CLIENT_CONTENT_REQUEST_15_JULY.md`; operator tracks decisions in `docs/client/FRONTEND_CONTENT_STATUS_TRACKER.md`.
- **Operator acceptance** — manual front-end website load and UX verification.
- **Final public copy approval** — unless placeholders have been explicitly approved.

**This front-end milestone does not authorize migration execution or full platform cutover.** Migration decision and staging smoke remain separate and blocked pending migration approval, target-environment confirmation, and provider/email verification.

See `docs/client/FRONTEND_CONTENT_INTAKE_CHECKLIST.md` for the complete operator/client-facing checklist, `docs/client/FRONTEND_COPY_APPROVAL_PACKET.md` for exact public copy requirements, and `docs/client/FRONTEND_ACCEPTANCE_EVIDENCE_TEMPLATE.md` for manual acceptance evidence capture after real operator checks.

---

## Validation Evidence (latest pass)

Commands passed against the current working branch state:

```bash
./node_modules/.bin/tsx scripts/toolchain_preflight.test.ts
git diff --check
./node_modules/.bin/tsc --noEmit --pretty false --incremental false
./node_modules/.bin/prisma validate --schema=prisma/system.prisma
./node_modules/.bin/prisma validate --schema=prisma/schema.prisma
./node_modules/.bin/tsx scripts/frontend_milestone_static.test.ts
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
./node_modules/.bin/tsx scripts/committed_evidence_guard.test.ts
./node_modules/.bin/tsx scripts/staging_static_preflight_package.test.ts
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
- `pnpm staging:static-preflight` is a local-only validation bundle and must not be read as operator approval or evidence of manual smoke completion.
- Draft evidence `.md` files under `docs/client/evidence/` are local operator artifacts and must not be committed unless explicitly approved.

Zero active residue confirmed.

---

## Remaining Risks

| Risk | Severity | Notes |
| --- | --- | --- |
| table-plan-to-Free migration mapping | **Blocker** | Legacy table-plan subscription values become controlled Free access. Requires explicit target-environment approval before execution. |
| account-column rename migration | Medium | The Prisma rename migration is record-preserving, but it still changes live column/index names and must be explicitly approved with the target-environment rollback plan. |
| static preflight automation | Low | Safe local-only validation bundle added; it reduces drift risk but does not replace manual approval or staging smoke evidence. |
| provider email live verification | Medium | Repository and staging docs are ready, but live delivery verification remains a separate operator approval path. |
| evidence capture readiness | Low | Evidence templates now exist, but operators still need to populate them after manual staging/provider verification. |
| operator handoff ambiguity | Low | The new handoff summary and evidence review checklist reduce drift risk for future operators, but they still require explicit human approval. |
| approval drift risk | Medium | Future agents could mistake the branch as rehearsal-approved without the status tracker and runbook. The new status and runbook docs reduce that risk but do not replace written approval. |
| Batch-runner timing artifact | Low | Focused tests pass individually; batch runner can still report timing-sensitive noise. |

---

## Next Executable Tasks (in order, no migrations required)

1. Review and approve `docs/client/MIGRATION_APPROVAL_PACKET.md` and `docs/client/MIGRATION_APPROVAL_STATUS.md` for the target environment.
2. Run `pnpm staging:static-preflight` before manual staging smoke or evidence capture.
3. **Optional:** Run `npx tsx scripts/create_staging_evidence_artifacts.ts` to generate draft evidence templates under `docs/client/evidence/`.
4. Use `docs/client/MIGRATION_REHEARSAL_RUNBOOK.md` for static-only rehearsal review and evidence capture.
5. Perform the approved manual smoke preparation using `docs/client/STAGING_SMOKE_CHECKLIST.md`, then populate evidence in `docs/client/evidence/`.
6. During provider/email checks, populate `docs/client/PROVIDER_EMAIL_EVIDENCE_TEMPLATE.md` in `docs/client/evidence/`.
7. **Before closing out:** Run `npx tsx scripts/validate_staging_evidence_artifacts.ts` to validate completed evidence for safety and consistency.
8. Review `docs/client/OPERATOR_HANDOFF_SUMMARY.md` and `docs/client/EVIDENCE_REVIEW_CHECKLIST.md` before closing out the operator pass.
9. Apply `prisma/migrations/20260707_120000_rename_account_identity_columns/migration.sql` only after approval and rehearsal.
10. Apply `src/migrations/20260707_130000_remove_table_plan_from_payload_enums.ts` only after explicit table-plan-to-Free mapping approval.

## No Migration Apply

No migrations have been applied on this branch.

---

## Migration Warning (repeated for visibility)

The Payload migration `20260707_130000_remove_table_plan_from_payload_enums` maps legacy table-plan subscription values to `free` and removes obsolete allowed-plan rows. This is data-preserving at the record level but business-significant: legacy table-plan subscribers become controlled Free access rather than a paid product label.

**This migration must not be applied until the table-plan-to-Free mapping is explicitly approved for the target environment.**

See `docs/PREVIEW_RELEASE_READINESS.md` for the canonical eleven-migration inventory and independent authorization templates.
