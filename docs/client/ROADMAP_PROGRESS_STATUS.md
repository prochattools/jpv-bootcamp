# JPV Bootcamp — Roadmap Progress Status

Canonical progress and current-position record for the `feature/course-branding-and-preview` branch.

Cross-links:
- Review packet: `docs/client/PAYLOAD_ONLY_FREE_PRO_REVIEW_PACKET.md`
- Migration approval packet: `docs/client/MIGRATION_APPROVAL_PACKET.md`
- Staging smoke checklist: `docs/client/STAGING_SMOKE_CHECKLIST.md`
- Provider/email readiness: `docs/client/PROVIDER_EMAIL_READINESS.md`
- Canonical integration plan: `docs/PAYLOAD_INTEGRATION_PLAN.md`
- Preview release readiness: `docs/PREVIEW_RELEASE_READINESS.md`
- Migration sources: `prisma/migrations/` and `src/migrations/`

---

## Current Position

**CURRENT POSITION:**
Payload-only Free/Pro refit is committed, pushed, clean, validated, staging-hardened, and now has migration approval and staging smoke handoff docs prepared on `feature/course-branding-and-preview`.

**NEXT BLOCKER:**
Approve the target-environment migration packet, especially table-plan-to-Free mapping and the account-column rename boundary, before migrations can be applied.

**NEXT EXECUTABLE TASK:**
Approve the migration packet, then perform the approved migration rehearsal and staging smoke run without touching `main`.

**DO NOT:**
Do not apply migrations. Do not touch `main`.

---

## Branch and Deployment State

| Field | Value |
| --- | --- |
| Branch | `feature/course-branding-and-preview` |
| Staging deployment target | This feature branch is the staging / production-staged deployment branch |
| Latest validated pre-migration-handoff commit | `587862b fix: harden checkout validation and success URL safety` |
| PR / review URL | `https://github.com/prochattools/jpv-bootcamp/pull/2` |
| Migrations applied | None |
| Migration approval status | **Blocked** — table-plan-to-Free mapping requires explicit target-environment approval |
| Approved migration path | Must go through the approved database migration path; pushing or deploying must not auto-apply |

---

## Progress Table — 8 July 2026

Basis: v3.3 baseline set in `docs/PAYLOAD_INTEGRATION_PLAN.md` (expanded-platform ~58%, first core go-live ~62%, build foundation ~78%, expanded launch ~52%). Percentages marked as estimates; delta is justified by specific completed work listed in Evidence column.

| Area / Phase | Previous | Current | Delta | Evidence | Remaining blocker |
| --- | ---: | ---: | ---: | --- | --- |
| Overall expanded platform | ~58% | ~67% | +9% | Free/Pro refit committed/pushed/clean; legacy paths removed; billing hardening; focused validation passed; migration approval/smoke/provider docs added; Prisma and tsc validated | Live cutover unapproved; migrations unapplied; production content incomplete; provider email live verification pending |
| Core staging readiness | ~68% | ~91% | +23% | Branch pushed, clean, validated, hardened; shadow sync fixed; sponsored access corrected; docs hardened; migration approval packet, staging smoke checklist, and provider/email readiness checklist prepared | Migration approval; post-refit staging smoke; provider email live verification |
| Build foundation | ~78% | ~88% | +10% | Payload-only refit; legacy code deleted; `server-only@0.0.1` added; type-check clean; Prisma schemas valid; SVG assets validated; checkout helper extraction and same-origin return URL guard added | Migration approval and rehearsal |
| Testing / release readiness | ~70% | ~85% | +15% | Focused checkout validation and migration static coverage added; billing, entitlement, course access, shadow sync, sponsored claim/decision helpers covered | Batch-runner timing artifact (tests pass individually); migration rehearsal not executed |
| Migration readiness | ~25% | ~40% | +15% | Migration sources written and reviewed; inventory unified to 11 in policy/manifest/preflight; static approval packet and rehearsal docs prepared; table-plan-to-Free migration static checks expanded | table-plan-to-Free approval required; no migrations applied; approved apply path not yet executed |
| Live cutover readiness | ~12% | ~18% | +6% | Code is staging-ready and validated; migration sources and staging smoke checklist are prepared; provider/email readiness checklist is prepared | Migrations unapplied; target-environment approval pending; provider email live verification pending; course content incomplete |

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
- Review packet, roadmap, approval packet, and staging/provider checklists may mention removed integration/product names only to state they must not remain as active paths.

Zero active residue confirmed.

---

## Remaining Risks

| Risk | Severity | Notes |
| --- | --- | --- |
| table-plan-to-Free migration mapping | **Blocker** | Legacy table-plan subscription values become controlled Free access. Requires explicit target-environment approval before execution. |
| account-column rename migration | Medium | The Prisma rename migration is record-preserving, but it still changes live column/index names and must be explicitly approved with the target-environment rollback plan. |
| provider email live verification | Medium | Repository and staging docs are ready, but live delivery verification remains a separate operator approval path. |
| Batch-runner timing artifact | Low | Focused tests pass individually; batch runner can still report timing-sensitive noise. |

---

## Next Executable Tasks (in order, no migrations required)

1. Review and approve `docs/client/MIGRATION_APPROVAL_PACKET.md` for the target environment.
2. Perform the approved migration rehearsal and manual smoke run using `docs/client/STAGING_SMOKE_CHECKLIST.md`.
3. Apply `prisma/migrations/20260707_120000_rename_account_identity_columns/migration.sql` only after approval and rehearsal.
4. Apply `src/migrations/20260707_130000_remove_table_plan_from_payload_enums.ts` only after explicit table-plan-to-Free mapping approval.

---

## Migration Warning (repeated for visibility)

The Payload migration `20260707_130000_remove_table_plan_from_payload_enums` maps legacy table-plan subscription values to `free` and removes obsolete allowed-plan rows. This is data-preserving at the record level but business-significant: legacy table-plan subscribers become controlled Free access rather than a paid product label.

**This migration must not be applied until the table-plan-to-Free mapping is explicitly approved for the target environment.**

See `docs/PREVIEW_RELEASE_READINESS.md` for the canonical eleven-migration inventory and independent authorization templates.
