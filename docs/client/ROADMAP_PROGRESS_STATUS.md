# JPV Bootcamp - Roadmap Progress Status

Current status for `feature/course-branding-and-preview`, audited against commit `236227c fix: require portal auth for member content` on 10 July 2026.

Current client truth: `docs/client/JPV_Bootcamp_Platform_Expansion_Go_Live_Plan_v3_5.docx`. Version 3.4 is the prior progress baseline. Canonical execution plan: `docs/PAYLOAD_INTEGRATION_PLAN.md`. Detailed audit evidence: `docs/V3_5_CODEBASE_ALIGNMENT_ASSESSMENT.md`.

Status update procedure: `docs/client/STATUS_UPDATE_PROCEDURE.md`.

## Current position

**Position:** The core Payload, authentication, entitlement, billing projection, migration-safety, and operator-evidence foundations are strong. The branch is not release-ready because several visible MVPs are static/client-only prototypes and P0 security, billing-contract, public-copy, abuse-control, dependency, and test gaps remain.

**Next task:** M0-01 under H0-01 - protect or remove the unauthenticated `/admin/review` prototype.

**Front-end schedule:** The 22 July front-end milestone is achievable only if immediate public blockers and the billing decision close by 13 July, all launch-scoped P0 implementation closes by 17 July, and client content, pricing/commitment language, legal wording, and course input arrive or placeholders are explicitly approved by 15 July. The 23 July handover buffer and 24 July client finished-by date remain.

**Cutover schedule:** Full platform cutover on 22-24 July is conditional and at risk. It requires approved migrations, rehearsal and rollback evidence, provider/email verification, complete browser smoke evidence, and explicit go-live approval.

**Hard stops:** Do not apply migrations. Do not touch `main`. Do not describe static prototypes as operational workflows.

## Branch and deployment state

| Field | Value |
| --- | --- |
| Branch | `feature/course-branding-and-preview` |
| Staging target | This feature branch is the staging / production-staged deployment branch |
| Audited commit | `236227c fix: require portal auth for member content` |
| PR / review | `https://github.com/prochattools/jpv-bootcamp/pull/2` |
| Migrations applied | None |
| Migration approval | Blocked pending table-plan-to-Free, account-column rename, path, backup, rollback, and owner approval |
| Provider/email acceptance | Pending |
| Complete staging/browser smoke | Pending |

No migrations have been applied on this branch.

## Audited readiness

These figures replace earlier Version 3.4 estimates. The rebaseline distinguishes code presence, static prototypes, durable operational workflows, automated validation, and accepted runtime evidence. It is a measurement correction, not a code regression.

| Area | Version 3.4 estimate | Version 3.5 audited | Evidence | Main blocker |
| --- | ---: | ---: | --- | --- |
| Expanded platform | ~73-75% | ~68% | Core services are substantial; recent MVP routes exist | Several MVPs are placeholders or client-only; release blockers remain |
| Core staging/code | ~97% | ~82% | Auth, account security, entitlements, billing projection, migrations, and CI build are mature | Public operator route, route duplication, endpoint hardening, dependency advisories |
| Build foundation | ~89-95% | ~86% | Most domains have typed services and focused tests | Starter/template residue and remaining hardening/test gaps |
| Testing/release | ~94-99% | ~76% | 96 script-style tests, type-check, Prisma validation, CI build | Static preflight runs a subset; no browser E2E, coverage gate, or full release command |
| Migration | ~55% | ~55% | Sources, inventory, approvals packet, runbook, and safety tests exist | No approval, rehearsal, rollback evidence, or application |
| Live cutover | ~20% | ~20% | Handoff/evidence templates exist | No migrations, full smoke, provider/email acceptance, content acceptance, or go-live approval |

## Deliverable truth

| Deliverable | Current state | Complete when |
| --- | --- | --- |
| Public landing page | Implemented but contains stale dates, unsupported claims, and cancel-any-time wording | Client-approved copy, canonical legal routes, accurate billing terms, mobile/desktop browser acceptance |
| Pro checkout | Monthly/annual checkout and projection logic implemented | 12-month commitment behavior is approved and enforced; provider smoke passes |
| Controlled Free access | Entitlement and sponsored-access foundations implemented | Public intake persists, queues review/notifications, and grants only after approval |
| Member portal | Auth and mature services exist under `/portal`; removed member routes are blocked | `/portal` owns all real views; removed member routes stay unavailable; full journey passes |
| 8-week course | Eight typed placeholder weeks | Representative approved content is persisted, editable, authorized, and smoke-tested |
| Community preview | Payload services exist; canonical portal uses local placeholder preview | Canonical portal uses authorized persisted data and private-room acceptance passes |
| Partner referral | Existing partner services exist; new referral form is client-only | Persist-before-success, delivery/retry, admin review, member history, and tests pass |
| Admin operations | Payload dashboard exists; separate static `/admin/review` is public | One authenticated admin surface shows real operational status |
| Release evidence | Templates and static tooling exist | Complete browser, provider/email, migration rehearsal, and rollback evidence is accepted |

## Hardening-first execution queue

Execute one `M0-*` or `M1-*` packet per clean change set. Every code packet includes focused tests; no migration or provider operation is implied. The exact file scopes, dependencies, effort ranges, and stop conditions are in `docs/V3_5_CODEBASE_ALIGNMENT_ASSESSMENT.md`.

| Order | Task | Scope | Required validation |
| ---: | --- | --- | --- |
| 1 | H0-01 | Protect/remove public `/admin/review` and keep one Payload admin surface | Anonymous/member denial plus admin acceptance |
| 2 | H0-02 | Remove MicroSassFast legal routes, stale sitemap entries, and reachable public template copy | Route/sitemap/public-copy regression tests |
| 3 | H0-03 | Decide and enforce monthly 12-month commitment; align landing, terms, portal, and Stripe | Billing unit/route tests plus controlled provider smoke |
| 4 | H0-04 | Disable false-success support/referral forms, then wire to existing durable services | Persistence, idempotency, queue, and failure tests |
| 5 | H0-05 | Bound and protect public write/email endpoints; redact PII/log diagnostics | Abuse, origin, size, redirect, and log tests |
| 6 | H0-06 | Resolve production dependency advisories | Production audit, type-check, build, Payload admin smoke |
| 7 | H1-01 | Keep `/portal` as the sole member namespace and block removed member routes from returning | Route parity, auth, direct URL, mobile/desktop journeys |
| 8 | H1-02 | Add one complete `test:release` command and browser E2E suite | CI executes full critical matrix |
| 9 | H1-03 | Replace static course/community/admin status with persisted operational data | Empty/partial/complete/unauthorized tests |
| 10 | H1-04 | Replace `PAYLOAD_SECRET` bearer reuse with scoped operator auth | Missing/wrong/valid/rotated credential tests |
| 11 | H1-05 | Add tested security headers and trim remote image allowlists | Public/portal/API/admin browser checks |
| 12 | H2-01 | Remove unreachable starter routes, sample data, components, icons, and utilities | Import and route allowlist tests |
| 13 | H2-02 | Break community file/moderation import cycle | Existing community file/moderation suite |
| 14 | H2-03 | Narrow trust-boundary casts and `overrideAccess` usage | Service authorization and regression tests |

Exact file boundaries and acceptance criteria are in `docs/V3_5_CODEBASE_ALIGNMENT_ASSESSMENT.md`.

## Timeline and decision gates

| Date | Gate |
| --- | --- |
| 10-13 July 2026 | M0-01 through M0-04 complete, M0-05 billing decision obtained, dependency triage complete |
| 15 July 2026 | Client content, pricing/commitment wording, legal copy, and course input approved or placeholders accepted |
| 14-17 July 2026 | M0-06 through M0-09 complete; M1-01 complete if support intake is in core go-live |
| 18-20 July 2026 | Launch-scoped M1 packets, full release/browser tests, approved staging smoke, provider/email verification, migration rehearsal, and rollback evidence |
| 21 July 2026 | Formal go/no-go; zero unresolved P0 blockers |
| 22 July 2026 | Front-end milestone if public acceptance passes |
| 23 July 2026 | Handover buffer and non-migration corrections |
| 24 July 2026 | Client finished-by date; full cutover only if every independent gate passes |

## Test and security evidence

- `git diff --check`, TypeScript, both Prisma schema validations, and prior focused suites have passed on the branch.
- Feature-branch CI type-checks and builds the application and Docker image without publishing from the validation job.
- Repository inventory contains 96 `*.test.ts` script files; the static preflight invokes only a curated subset.
- No Playwright/Cypress E2E configuration or coverage threshold is present.
- Graph analysis found an import cycle between `communityFiles.ts` and `communityModeration.ts`.
- `pnpm audit --prod` on 10 July reported 26 advisories: 3 high, 18 moderate, and 5 low. High findings are `undici` paths through Payload.
- Global application security headers are not defined in `next.config.js`.

## Migration warning

The Payload migration `20260707_130000_remove_table_plan_from_payload_enums` maps legacy table-plan subscription values to `free`. The Prisma migration `20260707_120000_rename_account_identity_columns` renames old account-reference columns/indexes to neutral names. Neither migration has been applied.

Do not apply migrations until the target-environment owner approves the business mapping, exact database/schema, backup, operator, maintenance window, apply path, verification, and rollback procedure.
