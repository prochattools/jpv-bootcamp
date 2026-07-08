# JPV Bootcamp — Roadmap Progress Status

Canonical progress and current-position record for the `feature/course-branding-and-preview` branch.

Cross-links:
- Review packet: `docs/client/PAYLOAD_ONLY_FREE_PRO_REVIEW_PACKET.md`
- Canonical integration plan: `docs/PAYLOAD_INTEGRATION_PLAN.md`
- Preview release readiness: `docs/PREVIEW_RELEASE_READINESS.md`
- Migration sources: `prisma/migrations/` and `src/migrations/`

---

## Current Position

**CURRENT POSITION:**
Payload-only Free/Pro refit is committed, pushed, clean, validated, and staging-hardened on `feature/course-branding-and-preview`.

**NEXT BLOCKER:**
Approve table-plan-to-Free mapping for the target environment before migrations can be applied.

**NEXT EXECUTABLE TASK:**
Add runtime route tests for checkout legacy-plan rejection, improve `startMemberCheckout` error logging, and add a same-origin guard to `STRIPE_SUCCESS_URL` — none of these require migrations.

**DO NOT:**
Do not apply migrations. Do not touch `main`.

---

## Branch and Deployment State

| Field | Value |
| --- | --- |
| Branch | `feature/course-branding-and-preview` |
| Staging deployment target | This feature branch is the staging / production-staged deployment branch |
| Latest validated commit | `80012b7 fix: staging readiness audit — access semantics, shadow sync, docs, and test fixes` |
| PR / review URL | `https://github.com/prochattools/jpv-bootcamp/pull/2` |
| Migrations applied | None |
| Migration approval status | **Blocked** — table-plan-to-Free mapping requires explicit target-environment approval |
| Approved migration path | Must go through the approved database migration path; pushing or deploying must not auto-apply |

---

## Progress Table — 8 July 2026

Basis: v3.3 baseline set in `docs/PAYLOAD_INTEGRATION_PLAN.md` (expanded-platform ~58%, first core go-live ~62%, build foundation ~78%, expanded launch ~52%). Percentages marked as estimates; delta is justified by specific completed work listed in Evidence column.

| Area / Phase | Previous | Current | Delta | Evidence | Remaining blocker |
| --- | ---: | ---: | ---: | --- | --- |
| Overall expanded platform | ~58% | ~65% | +7% | Free/Pro refit committed/pushed/clean; legacy paths removed; billing hardening; 68 pass / 0 fail; Prisma and tsc validated | Live cutover unapproved; migrations unapplied; production content incomplete; provider email live verification pending |
| Core staging readiness | ~68% | ~88% | +20% | Branch pushed, clean, validated, hardened; shadow sync fixed; sponsored access corrected; docs hardened; Dokploy API key literal removed; migration inventory unified to 11 | Migration approval; post-refit staging smoke; provider email live verification |
| Build foundation | ~78% | ~86% | +8% | Payload-only refit; legacy code deleted; `server-only@0.0.1` added; type-check clean; Prisma schemas valid; SVG assets validated | Runtime route tests for checkout rejection; `startMemberCheckout` error logging improvement |
| Testing / release readiness | ~70% | ~80% | +10% | 68 pass / 0 fail; billing, entitlement, course access, shadow sync, sponsored claim/decision helpers covered | Runtime route tests for checkout legacy-plan rejection; batch-runner timing artifact (tests pass individually) |
| Migration readiness | ~25% | ~30% | +5% | Migration sources written and reviewed; inventory unified to 11 in policy/manifest/preflight; table-plan-to-Free migration static smoke passed | table-plan-to-Free approval required; no migrations applied; approved apply path not yet executed |
| Live cutover readiness | ~12% | ~15% | +3% | Code is staging-ready and validated; migration sources complete; staging safety docs hardened | Migrations unapplied; target-environment approval pending; provider email live verification pending; course content incomplete |

---

## Validation Evidence (latest pass)

Commands passed at commit `80012b7`:

```bash
git diff --check
./node_modules/.bin/tsc --noEmit --pretty false --incremental false
./node_modules/.bin/prisma validate --schema=prisma/system.prisma
./node_modules/.bin/prisma validate --schema=prisma/schema.prisma
./node_modules/.bin/tsx scripts/billing_readiness_report.test.ts
./node_modules/.bin/tsx scripts/member_checkout.test.ts
./node_modules/.bin/tsx scripts/membership_email_copy.test.ts
./node_modules/.bin/tsx scripts/payload_course_stripe_shadow_sync.test.ts
./node_modules/.bin/tsx scripts/payload_entitlement_evaluator.test.ts
./node_modules/.bin/tsx scripts/payload_course_access_service.test.ts
./node_modules/.bin/tsx scripts/tests/sponsored_claim_helpers.ts
./node_modules/.bin/tsx scripts/tests/sponsored_decision_helpers.ts
```

Test suite total: **68 pass, 0 fail**. Batch-runner timing artifact noted; affected tests pass individually.

---

## Grep Exception Summary

Expected and allowed exceptions only:

- `wp_*` strings remain only inside `prisma/migrations/20260707_120000_rename_account_identity_columns/migration.sql` — required for column/index rename DDL.
- `STRIPE_PRICE_TABLE` remains only in a negative readiness assertion verifying that membership checkout no longer uses the old table price configuration.
- `pnpm-lock.yaml` can match `libvips` package names and integrity hashes (Sharp dependency — not project integration references).
- Review packet and roadmap docs mention removed integration/product names only to state they must not remain as active paths.

Zero active residue confirmed.

---

## Remaining Risks

| Risk | Severity | Notes |
| --- | --- | --- |
| table-plan-to-Free migration mapping | **Blocker** | Legacy table-plan subscription values become controlled Free access. Requires explicit target-environment approval before execution. |
| `startMemberCheckout` swallows errors without logging the error object | Medium | Error is caught but not logged; diagnosis is difficult in production if checkout silently fails. |
| `STRIPE_SUCCESS_URL` has no same-origin guard | Medium | Redirect target is not validated to be same-origin; should be guarded before production. |
| Checkout rejection coverage is static regex, not runtime route tests | Low | Static coverage passes; runtime route tests for legacy-plan rejection are not yet written. |

---

## Next Executable Tasks (in order, no migrations required)

1. Add runtime route tests for `startMemberCheckout` legacy-plan rejection (`plan=table` etc.) — static regex only today.
2. Improve `startMemberCheckout` error logging: log the error object before re-throwing or returning the safe error response.
3. Add a same-origin guard to `STRIPE_SUCCESS_URL` derivation to prevent open-redirect via Stripe return.
4. *(Blocked until migration approval)* Apply `prisma/migrations/20260707_120000_rename_account_identity_columns/migration.sql` via the approved database migration path.
5. *(Blocked until migration approval)* Apply `src/migrations/20260707_130000_remove_table_plan_from_payload_enums.ts` after explicit table-plan-to-Free mapping approval.

---

## Migration Warning (repeated for visibility)

The Payload migration `20260707_130000_remove_table_plan_from_payload_enums` maps legacy table-plan subscription values to `free` and removes obsolete allowed-plan rows. This is data-preserving at the record level but business-significant: legacy table-plan subscribers become controlled Free access rather than a paid product label.

**This migration must not be applied until the table-plan-to-Free mapping is explicitly approved for the target environment.**

See `docs/PREVIEW_RELEASE_READINESS.md` for the canonical eleven-migration inventory and independent authorization templates.
