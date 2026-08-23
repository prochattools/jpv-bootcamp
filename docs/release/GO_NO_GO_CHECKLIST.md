# Go / No-Go Checklist

## Current repository review — 2026-08-23

- **Working branch:** `feature/course-branding-and-preview`; starting committed tip `ae8c886d125200d94a8ee7aec005b6226a1304e0`.
- **Local evidence:** after cleanup, `pnpm test:release` passed `164/164`; focused browser checks passed `60/60`; full browser E2E passed `148/148` with 60 declared skips. The shared muted-token contrast defect is corrected.
- **External evidence:** staging/provider/database/production state was not changed or reverified by this pass. Keep the checklist `NO-GO` until exact-SHA operator evidence and approvals exist.
- The older dated identity and gate rows below are retained as historical evidence and must not be copied as current release identity.
- **Phase 9.5 current truth:** `docs/release/PHASE_9_5_CURRENT_TRUTH_2026-08-23.md`; **remaining work:** `docs/release/PHASE_9_5_FINAL_IMPLEMENTATION_BACKLOG_2026-08-23.md`.

Default decision state: `NO-GO`

Do not change this checklist to `GO` until the required operator evidence exists.

Decision-readiness prerequisite: `pnpm staging:decision-readiness`
Current repository result: `DECISION-READY, EXTERNAL APPROVALS PENDING`

## Identity

> The identity rows below are historical snapshots retained for audit. They are not the current candidate identity; use `docs/release/PHASE_9_5_CURRENT_TRUTH_2026-08-23.md`.

- Branch: `feature/course-branding-and-preview`
- Commit: `eb03a08` (local HEAD); staging confirmed running `eb03a08` design tokens (imageTag env var not set in Dokploy — cosmetic only; design confirmed in deployed HTML, 2026-07-21)
- Release candidate label: `feature/course-branding-and-preview @ eb03a08`
- Date: 2026-07-21
- Operator: [TO BE FILLED — named operator required]
- Approvers: [TO BE FILLED — client + technical approver required]
- Rollback owner: [TO BE FILLED]
- Monitoring owner: [TO BE FILLED]

## Repository-owned green gates

- [x] `pnpm staging:migration-preflight` — PASS 12/12 (2026-07-21, HEAD `eb03a08`)
- [x] `pnpm staging:migration-rehearsal` — PASS disposable localhost rehearsal (2026-07-21, code baseline `eb03a08`): Apply 1 processed=21 errors=0, Apply 2 idempotent processed=21 errors=0, rollback grants=16 subs=21 billing=21 members=21 removed, Apply 3 reapply processed=21 errors=0. Idempotency, scoped deletion, and reapply passed; preservation of preexisting rows was not proven because the baseline was empty.
- [x] `pnpm staging:migration-rehearsal:evidence` — PASS (2026-07-21, HEAD `eb03a08`); evidence at `docs/LEGACY_MIGRATION_REHEARSAL_EVIDENCE.md`
- [x] `pnpm staging:decision-readiness` — PASS: `DECISION-READY, EXTERNAL APPROVALS PENDING` (2026-07-21, HEAD `eb03a08`)
- [x] `pnpm staging:provider-simulation` — PASS 10/10 (2026-07-21)
- [x] `pnpm staging:smoke-plan` — PASS (2026-07-21)
- [x] `pnpm staging:smoke-simulated` — PASS 5/5 (2026-07-21)
- [x] `pnpm release:evidence:dry-run` — PASS (2026-07-21)
- [x] `pnpm test:release` — PASS 151/151 (2026-07-21, HEAD `eb03a08`)
- [x] `pnpm test:e2e` — PASS 58/58 (2026-07-21, HEAD `eb03a08`)
- [x] `pnpm test:release:full` — PASS (2026-07-21)
- [x] `pnpm staging:static-preflight` — PASS (2026-07-21)
- [x] `./node_modules/.bin/tsc --noEmit --pretty false --incremental false` — PASS (2026-07-21)
- [x] `pnpm build` — PASS production build (2026-07-21)
- [x] `./node_modules/.bin/prisma validate --schema=prisma/system.prisma` — PASS (2026-07-21)
- [x] `./node_modules/.bin/prisma validate --schema=prisma/schema.prisma` — PASS (2026-07-21)
- [x] `pnpm exec pnpm audit --prod --audit-level high --ignore-registry-errors` — PASS high-severity gate (3 moderate advisories; fast-uri→3.1.4, sharp→^0.35.0 overrides applied 2026-07-22) (2026-07-22, HEAD `eb03a08`+)

## Required external gates

- [ ] representative programme content approved or placeholder accepted
- [ ] table-plan-to-Free decision approved
- [ ] account-column rename decision approved
- [ ] migration approval complete
- [ ] migration applied through approved path
- [ ] post-migration verification complete
- [ ] rollback evidence from staging or production window captured
- [x] provider/email verification complete — Resend: jpvbootcamp.com domain VERIFIED (eu-west-1, 2026-07-21); API key valid
- [x] Stripe verification complete — Product active, GBP 80/month + GBP 800/year prices active, portal config active, staging webhook enabled at preview.jpvbootcamp.com (2026-07-21, TEST mode)
- [x] Bunny CDN credentials verified — all 5 required env vars present, library API 200, CDN hostname confirmed, env=staging (2026-07-21)
- [ ] Payload/admin staging verification complete — requires operator login with test account
- [ ] support-intake staging verification complete where in scope — blocked on REM-09 (support migration unapplied)
- [x] staging smoke complete — 58/58 PASS (2026-07-21, imageTag `93799c6`, desktop + mobile Chromium via playwright-staging.config.ts): PUBLIC-001–005, BILLING-001–003, SUPPORT-001, ACCESSIBILITY-001–003, MOBILE-001–002, PERF-001–002, ERROR-001, SCHEMA-001, EVIDENCE-001–002, AUTH-001, PORTAL-001–008 all PASS
- [x] REM-01 test apply complete — `[staging-qa-identity]` (permitted test address): HTTP 200, audit record confirmed in `jpvbootcamp_staging.member_invitation_audit`, idempotency PASS; remaining 20 members pending explicit per-member authorization
- [x] browser acceptance evidence complete — AUTH-001 Playwright PASS: login API 200, JWT issued, post-login URL `/portal` confirmed (desktop + mobile), email_verified_at stamped; 2026-07-21
- [ ] monitoring readiness confirmed
- [ ] formal approval recorded

## Required green-gate status

| Gate | Required state | Evidence |
| --- | --- | --- |
| release suite | pass | **PASS 151/151** — 2026-07-21, HEAD `eb03a08` |
| browser suite | pass | **PASS 58/58** — 2026-07-21, HEAD `eb03a08` |
| static preflight | pass | **PASS** — 2026-07-21 |
| build | pass | **PASS** — 2026-07-21 |
| Prisma validation | pass | **PASS** — both schemas, 2026-07-21 |
| dependency audit | pass at high severity gate | **PASS** — 3 moderate, fast-uri+sharp high resolved via overrides, 2026-07-22 |
| decision readiness | `DECISION-READY, EXTERNAL APPROVALS PENDING` | **PASS** — 2026-07-21 |
| migration preflight | pass | **PASS** — 2026-07-21 |
| migration rehearsal | pass | **PARTIAL PASS** disposable localhost rehearsal — apply, idempotent rerun, scoped rollback, and reapply passed; preexisting-row preservation remains unproven because the baseline was empty; 2026-07-21, code baseline `eb03a08` |
| migration rehearsal evidence | pass | **PASS** — `docs/LEGACY_MIGRATION_REHEARSAL_EVIDENCE.md`; 2026-07-21, HEAD `eb03a08` |
| provider simulation | pass | **PASS 10/10** — 2026-07-21 |
| migration applied | pending until executed | PENDING — operator authorization required |
| post-migration verification | pending until executed | PENDING |
| provider verification | pending until executed | Stripe/Resend/Bunny live-credential evidence in decision docs; Payload/admin pending operator login |
| Stripe provider verification | pass | **PASS** — product active, GBP 80/mo + GBP 800/yr, portal active, staging webhook enabled, TEST mode, 2026-07-21 |
| Resend email verification | pass | **PASS** — jpvbootcamp.com verified, eu-west-1, API key valid, 2026-07-21 |
| Bunny CDN verification | pass | **PASS** — all 5 env vars present, library API 200, CDN hostname confirmed, 2026-07-21 |
| Payload/admin staging verification | pending until executed | PENDING — operator login with test account required |
| local simulated smoke | pass | **PASS 5/5** — 2026-07-21 |
| staging smoke | pending until executed | **58/58 PASS** per playwright-staging.config.ts; AUTH-001 + PORTAL-001–008 all PASS; formal operator sign-off pending |
| staging smoke (HTTP) | pass | **PASS 15/15** — 2026-07-21, imageTag `93799c6`; all API boundary checks confirmed |
| staging smoke (browser) | pass | **PASS 58/58** — 2026-07-21, desktop + mobile Chromium; includes AUTH-001 + PORTAL-001–008 |
| REM-01 test invitation | pass | **PASS** — `[staging-qa-identity]` sent, audit confirmed, idempotency PASS; portal login PASS (AUTH-001); 20 others pending authorization |
| rollback readiness | documented and repository-owned checklist complete | **DOCUMENTED** — checklist complete |
| rollback evidence from staging | pending until executed | PENDING |
| monitoring readiness | owner assigned and evidence captured | PENDING |
| content approval | pending until explicit approval | PENDING — client content outstanding |

## Blockers

- programme content: client content outstanding; approved representative 8-week programme required or placeholder acceptance needed
- migration state: Payload migrations 7–16 include 5 from original inventory (remove_table_plan, member_email_verification, member_account_action_purposes, partner_affiliate_operations, partner_schema_reconciliation) plus 5 newer (membership_support_schema, live_sessions, bunny_videos, subscription_schema_cols, locked_docs_rels_new_collections) and the Prisma rename_account_identity_columns. CURRENT_WORK_HANDOFF states 16 schema migrations applied on staging. Formal operator authorization required for any remaining unapplied migrations.
- provider state: Stripe TEST ✓, Resend ✓, Bunny CDN ✓; Payload/admin authenticated session verification pending (requires operator with live member credentials)
- staging state: 58/58 PASS (desktop + mobile, AUTH-001 + PORTAL-001–008 all PASS); deployed image confirmed running `eb03a08` design tokens (imageTag env var not set — cosmetic); REM-01 test send + portal login confirmed ([staging-qa-identity], audit verified, idempotent); 20 remaining member invitations pending explicit per-member authorization
- unresolved advisories: 3 moderate npm advisories (non-blocking); 2 high-severity advisories (fast-uri, sharp) resolved via pnpm overrides 2026-07-22
- operational ownership: named operator, approvers, rollback owner, monitoring owner all unfilled

## Rollback trigger review

- [ ] rollback trigger criteria reviewed
- [ ] backup or snapshot reference recorded
- [ ] rollback owner available during the window
- [ ] restore-based fallback approved

## Decision

- GO:
- CONDITIONAL GO:
- NO-GO:

Current default:

- Decision: `NO-GO`
- Reason: repository-owned preparation is decision-ready, but actual migration approval and apply, staging/provider verification, staging rollback evidence, content approval, and formal approval remain external gates until evidenced.

## Approval record

- Timestamp:
- Approver names:
- Approval references:
- Notes:
