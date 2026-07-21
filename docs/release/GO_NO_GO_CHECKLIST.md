# Go / No-Go Checklist

Default decision state: `NO-GO`

Do not change this checklist to `GO` until the required operator evidence exists.

Decision-readiness prerequisite: `pnpm staging:decision-readiness`
Current repository result: `DECISION-READY, EXTERNAL APPROVALS PENDING`

## Identity

- Branch: `feature/course-branding-and-preview`
- Commit: `32874a2` (local HEAD); staging deployed at `d235c5a`
- Release candidate label: `feature/course-branding-and-preview @ 32874a2`
- Date: 2026-07-21
- Operator: [TO BE FILLED — named operator required]
- Approvers: [TO BE FILLED — client + technical approver required]
- Rollback owner: [TO BE FILLED]
- Monitoring owner: [TO BE FILLED]

## Repository-owned green gates

- [x] `pnpm staging:migration-preflight` — PASS (2026-07-21, HEAD `32874a2`)
- [x] `pnpm staging:migration-rehearsal` — PASS static mode (2026-07-21)
- [x] `pnpm staging:migration-rehearsal:evidence` — PASS (2026-07-21)
- [x] `pnpm staging:decision-readiness` — PASS: `DECISION-READY, EXTERNAL APPROVALS PENDING` (2026-07-21)
- [x] `pnpm staging:provider-simulation` — PASS 10/10 (2026-07-21)
- [x] `pnpm staging:smoke-plan` — PASS (2026-07-21)
- [x] `pnpm staging:smoke-simulated` — PASS 5/5 (2026-07-21)
- [x] `pnpm release:evidence:dry-run` — PASS (2026-07-21)
- [x] `pnpm test:release` — PASS 145/145 (2026-07-21, HEAD `32874a2`)
- [x] `pnpm test:e2e` — PASS 58/58 (2026-07-21, HEAD `c4581ff`)
- [x] `pnpm test:release:full` — PASS (2026-07-21)
- [x] `pnpm staging:static-preflight` — PASS (2026-07-21)
- [x] `./node_modules/.bin/tsc --noEmit --pretty false --incremental false` — PASS (2026-07-21)
- [x] `pnpm build` — PASS production build (2026-07-21)
- [x] `./node_modules/.bin/prisma validate --schema=prisma/system.prisma` — PASS (2026-07-21)
- [x] `./node_modules/.bin/prisma validate --schema=prisma/schema.prisma` — PASS (2026-07-21)
- [x] `pnpm exec pnpm audit --prod --audit-level high --ignore-registry-errors` — PASS high-severity gate (3 moderate advisories, js-yaml resolved) (2026-07-21)

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
- [x] staging smoke complete — HTTP 15/15 PASS + browser 42/42 PASS (2026-07-21, imageTag `d235c5a`, desktop + mobile Chromium via playwright-staging.config.ts): PUBLIC-001–005, BILLING-001–003, SUPPORT-001, ACCESSIBILITY-001–003, MOBILE-001–002, PERF-001–002, ERROR-001, SCHEMA-001, EVIDENCE-001–002, AUTH-001 all PASS
- [x] REM-01 test apply complete — `info@prochat.tools` (permitted test address): HTTP 200, audit record confirmed in `jpvbootcamp_staging.member_invitation_audit`, idempotency PASS; remaining 20 members pending explicit per-member authorization
- [x] browser acceptance evidence complete — AUTH-001 Playwright PASS: login API 200, JWT issued, post-login URL `/portal` confirmed (desktop + mobile), email_verified_at stamped; 2026-07-21
- [ ] monitoring readiness confirmed
- [ ] formal approval recorded

## Required green-gate status

| Gate | Required state | Evidence |
| --- | --- | --- |
| release suite | pass | **PASS 145/145** — 2026-07-21, HEAD `32874a2` |
| browser suite | pass | **PASS 58/58** — 2026-07-21, HEAD `c4581ff` |
| static preflight | pass | **PASS** — 2026-07-21 |
| build | pass | **PASS** — 2026-07-21 |
| Prisma validation | pass | **PASS** — both schemas, 2026-07-21 |
| dependency audit | pass at high severity gate | **PASS** — 3 moderate, js-yaml high resolved, 2026-07-21 |
| decision readiness | `DECISION-READY, EXTERNAL APPROVALS PENDING` | **PASS** — 2026-07-21 |
| migration preflight | pass | **PASS** — 2026-07-21 |
| migration rehearsal | pass in static mode | **PASS** static mode — 2026-07-21 |
| migration rehearsal evidence | pass | **PASS** — 2026-07-21 |
| provider simulation | pass | **PASS 10/10** — 2026-07-21 |
| migration applied | pending until executed | PENDING — operator authorization required |
| post-migration verification | pending until executed | PENDING |
| Stripe provider verification | pass | **PASS** — product active, GBP 80/mo + GBP 800/yr, portal active, staging webhook enabled, TEST mode, 2026-07-21 |
| Resend email verification | pass | **PASS** — jpvbootcamp.com verified, eu-west-1, API key valid, 2026-07-21 |
| Bunny CDN verification | pass | **PASS** — all 5 env vars present, library API 200, CDN hostname confirmed, 2026-07-21 |
| Payload/admin staging verification | pending until executed | PENDING — operator login with test account required |
| local simulated smoke | pass | **PASS 5/5** — 2026-07-21 |
| staging smoke (HTTP) | pass | **PASS 15/15** — 2026-07-21, imageTag `d235c5a`; all API boundary checks confirmed |
| staging smoke (browser) | pass | **PASS 42/42** — 2026-07-21, desktop + mobile Chromium; includes AUTH-001 portal login proof |
| REM-01 test invitation | pass | **PASS** — `info@prochat.tools` sent, audit confirmed, idempotency PASS; portal login PASS (AUTH-001); 20 others pending authorization |
| rollback readiness | documented and repository-owned checklist complete | **DOCUMENTED** — checklist complete |
| rollback evidence from staging | pending until executed | PENDING |
| monitoring readiness | owner assigned and evidence captured | PENDING |
| content approval | pending until explicit approval | PENDING — client content outstanding |

## Blockers

- programme content: client content outstanding; approved representative 8-week programme required or placeholder acceptance needed
- migration state: 3 pending migrations unapplied (remove_table_plan, rename_account_identity_columns, membership_support_schema); require explicit operator authorization with backup/rollback confirmed
- provider state: Stripe TEST ✓, Resend ✓, Bunny CDN ✓; Payload/admin authenticated session verification pending (requires operator with live member credentials)
- staging state: HTTP smoke 15/15 PASS; browser smoke 42/42 PASS (desktop + mobile, AUTH-001 PASS); REM-01 test send + portal login confirmed (info@prochat.tools, audit verified, idempotent); 20 remaining member invitations pending explicit per-member authorization
- unresolved advisories: 3 moderate npm advisories (non-blocking)
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
