# JPV Bootcamp Version 3.5 Codebase Alignment Assessment

Assessment date: 10 July 2026  
Branch: `feature/course-branding-and-preview`  
Audited commit: `236227c fix: require portal auth for member content`  
Migration state: no migrations applied

This is an audit record, not a second roadmap. Execution order and completion state remain canonical in `docs/PAYLOAD_INTEGRATION_PLAN.md` and `docs/client/ROADMAP_PROGRESS_STATUS.md`.

## Assessment outcome

The core Payload, member-authentication, entitlement, billing-projection, migration-safety, and operator-evidence foundations are substantial. The repository is not yet release-ready, however. Several recent MVP additions are static or client-only prototypes, public copy over-promises unfinished behavior, public legacy template routes remain reachable, and the release test gate does not exercise the whole product.

The 22 July front-end milestone remains achievable if the immediate public blockers and billing decision close by 13 July, launch-scoped P0 implementation closes by 17 July, and client content arrives or placeholders are explicitly approved by 15 July. The full 22-24 July platform cutover is conditional and at risk until migration approval, provider/email verification, browser smoke evidence, and rollback rehearsal exist.

The Version 3.5 percentages are rebaselined after distinguishing source presence, static prototypes, operational workflows, and accepted runtime evidence. The lower numbers are a measurement correction, not a code regression.

| Area | Audited readiness | Why |
| --- | ---: | --- |
| Expanded platform | ~68% | Strong core services, but several advertised workflows are prototypes and release blockers remain. |
| Core staging/code | ~82% | Auth, billing projection, access, and migration guards are mature; canonical-route and public-surface gaps remain. |
| Build foundation | ~86% | Most domains have implementation foundations, but duplicate routes and template residue add avoidable complexity. |
| Testing/release | ~76% | Ninety-six script-style test files exist, but static preflight runs only a subset and there is no browser E2E or coverage gate. |
| Migration | ~55% | Sources and runbooks exist; approvals, rehearsal, rollback evidence, and application remain pending. |
| Live cutover | ~20% | No migration, provider/email acceptance, complete staging smoke, or final go-live approval exists. |

## Confirmed strengths

- Free/Pro product semantics are consistently represented in active billing, entitlement, and migration code.
- Pro monthly and annual price identifiers resolve to the same Pro plan; unsupported public plan values fail closed.
- Member identity is server-derived for portal checkout and billing-portal access.
- Stripe webhook and shadow-projection logic has focused idempotency, billing-state, refund, dispute, and access-transition tests.
- Member verification, password reset, email change, account status, and protected-resource foundations are extensive.
- Payload collection access rules are generally explicit and server-side.
- Migration execution is separated from application startup and guarded by environment-specific runbooks.
- CI type-checks and builds feature branches without deploying or applying migrations.

## P0 release blockers

### H0-01 - Protect the administrator review surface

Problem: `src/app/(frontend)/admin/review/**` renders without an administrator-authentication check even though the route is labelled operator-only. It also creates a second application under Payload's `/admin` namespace.

Execution:

1. Prefer removing the separate front-end `/admin/review` prototype and showing required status in the existing Payload dashboard.
2. If it must remain, require a verified Payload administrator before rendering every page and export route.
3. Remove operator links from public route registries.
4. Add anonymous, member, and administrator route tests.

Exit criteria: anonymous and member requests fail closed; an administrator can reach the approved status surface; no unauthenticated operator metadata is rendered.

### H0-02 - Remove public template and legal-policy residue

Problem: `/tos` and `/privacy-policy` still publish MicroSassFast text, and the sitemap indexes those routes plus `/waiting-list`. Separate JPV `/terms` and `/privacy` pages exist.

Execution:

1. Redirect or remove `/tos` and `/privacy-policy`; keep one canonical JPV terms route and one canonical JPV privacy route.
2. Remove `/waiting-list` and other unapproved template routes from the sitemap.
3. Scan reachable public pages for MicroSassFast, boilerplate, stale events, template blog content, and unsupported product claims.
4. Add sitemap and public-copy regression tests.

Exit criteria: only approved JPV routes are indexed; no reachable page displays another product or obsolete legal terms.

### H0-03 - Make billing behavior match the 12-month commitment

Problem: the client truth says monthly billing has a 12-month commitment, while public FAQ/terms say cancel any time and the current Stripe checkout creates a normal monthly subscription without repository-level minimum-term enforcement.

Execution:

1. Obtain a written implementation decision for how Stripe enforces the 12-month commitment and what the billing portal permits.
2. Implement that decision in checkout/portal configuration and subscription-state handling.
3. Remove `cancel any time`, generic proration, refund, certificate, clinic, and other unsupported claims unless approved and implemented.
4. Add monthly, annual, cancellation, duplicate-subscription, webhook, and portal tests plus one controlled provider smoke check.

Exit criteria: public copy, terms, Stripe checkout, billing portal, webhook state, and tests describe and enforce the same contract.

### H0-04 - Stop prototype forms from claiming durable submission

Problem: `/portal/support` and `/portal/partner-referral` validate only in the browser, generate `Math.random()` references, and then claim the request was recorded or submitted. No record or notification is created.

Execution:

1. Until persistence is implemented, disable submission and label the forms as non-submitting previews.
2. Then connect support/pay-it-forward to the existing sponsored-application/access services and connect referral applications to the existing Payload partner-application service.
3. Generate references server-side, persist before success, and queue operator/member notifications with stable dedupe keys.
4. Add validation, authorization, persistence, idempotency, email-queue, and failure-path tests.

Exit criteria: success is shown only after a durable record exists; duplicate submission and provider failure behavior is defined; no parallel temporary domain model remains.

### H0-05 - Harden public write and email endpoints

Problem: `/api/support`, `/api/subscribe`, sponsored application, and support-credit checkout paths have inconsistent body limits, origin checks, rate limits, PII logging, and redirect validation. In-memory per-IP throttling is not sufficient across multiple instances.

Execution:

1. Reuse one bounded JSON/input-normalization helper and one request-origin policy.
2. Add field length limits, body-size limits, bot/honeypot protection, and a deployment-appropriate shared rate-limit control or documented reverse-proxy rule.
3. Redact email and remove environment/key-length diagnostics from request logs.
4. Validate all support-credit success/cancel URLs as approved same-origin URLs.
5. Add abuse, oversized-body, forged-origin, duplicate, log-redaction, and redirect tests.

Exit criteria: every public write endpoint has documented abuse controls, bounded input, safe logs, and focused negative tests.

### H0-06 - Resolve production dependency advisories

Problem: `pnpm audit --prod` reports 26 advisories: 3 high, 18 moderate, and 5 low. The high findings are `undici` advisories through Payload; additional findings include DOMPurify, PostCSS, and esbuild paths.

Execution:

1. Upgrade Payload and related packages to the smallest compatible patched release, or use a reviewed transitive override only when the framework supports it.
2. Regenerate the lockfile with `pnpm@10.33.0`.
3. Re-run production audit, type-check, full build, Payload admin login, rich-text/editor, and webhook smoke tests.
4. Record any accepted residual advisory with exploitability and owner.

Exit criteria: no unreviewed high-severity production advisory remains and Payload admin/runtime behavior passes.

## P1 structural and test hardening

### H1-01 - Keep `/portal` as the sole member namespace

Problem: The member namespace migration must stay closed. `/portal` is the only approved member route tree, and removed legacy member routes must not return through pages, generated URLs, fixtures, or docs.

Execution:

1. Inventory canonical member routes and keep `/portal` as the only implementation owner.
2. Move or reuse mature service-backed views under `/portal` without duplicating business logic.
3. Delete removed member routes rather than preserving compatibility aliases.
4. Update links, route registry, smoke plan, authorization tests, and repository invariants.

Exit criteria: one member route tree owns each feature; removed member routes stay unavailable; direct URL, mobile, empty, loading, and unauthorized states pass.

### H1-02 - Create one complete release test command

Problem: 96 script-style test files exist, but `staging:static-preflight` runs a curated subset. There is no browser E2E suite, coverage threshold, or single command proving the critical user journeys.

Execution:

1. Define `test:release` with deterministic groups: unit/service, route/API, migrations, docs/static, type-check, Prisma validate, build, and browser E2E.
2. Add Playwright coverage for public landing, member login, monthly/annual checkout start, portal auth, course access, support/referral submission, admin denial, and canonical legal routes.
3. Add an explicit test manifest so every required test file is owned by a suite.
4. Run the same command in feature-branch CI.

Exit criteria: one command and CI job exercise the release-critical matrix; failures identify the owning group; no test file is accidentally omitted.

### H1-03 - Replace static MVP status with operational truth

Problem: course weeks are all `placeholder`; community rooms and threads are local preview data; the admin review dashboard is a static model; support/referral forms are not operational.

Execution:

1. Move approved course content into Payload seed/admin workflows and mark readiness from persisted data.
2. Render canonical community views from authorized Payload services.
3. Derive admin status from real counts/evidence, or remove the prototype dashboard.
4. Add empty, partial, complete, and unauthorized tests for each domain.

Exit criteria: roadmap status can be derived from persisted/accepted evidence rather than hard-coded preview constants.

### H1-04 - Separate operator API credentials

Problem: queued-email admin routes accept `PAYLOAD_SECRET` as a bearer token. The application encryption/session secret should not double as an operator API credential.

Execution:

1. Introduce a dedicated scoped operator secret or authenticated Payload administrator session.
2. Compare bearer secrets with a timing-safe helper and keep responses non-enumerating.
3. Rotate/deprecate the shared-secret path through approved environment management.
4. Add missing, wrong, expired/rotated, and valid credential tests.

Exit criteria: compromise of an operator API credential does not expose the Payload application secret.

### H1-05 - Add application security headers

Problem: repository configuration does not define a Content Security Policy, frame protection, HSTS, referrer policy, permissions policy, or global content-type protection.

Execution:

1. Add a header policy compatible with Next.js, Payload admin, Stripe, Resend assets, and approved media providers.
2. Remove obsolete remote image hosts before writing the policy.
3. Add header tests for public, portal, API, and admin responses.
4. Verify Payload's editor, image loading, checkout redirect, and member portal in a browser.

Exit criteria: required headers are present without breaking approved application behavior.

## P2 simplification after release blockers

### H2-01 - Remove unreachable starter/template code

Audit and remove unapproved blog, waiting-list, builder-boilerplate, stale icon, utility, and sample-data surfaces only after import and route checks prove they are unused. This includes reviewing `src/utils/data.ts`, old blog components, starter `Header`/`Hero` components, broad remote image allowlists, and duplicated privacy/terms routes. Add a route allowlist test before deletion.

### H2-02 - Break the community file/moderation import cycle

Move shared moderation actor/file projection types and pure mapping helpers into a dependency-neutral module. Keep service dependencies one-way and preserve focused community file/moderation tests.

### H2-03 - Reduce trust-boundary casts and broad `overrideAccess`

Review high-concentration files, starting with `src/lib/payloadCourse/accessService.ts`, `stripeShadowSync.ts`, `partnerApplications.ts`, and member mutation services. Replace repeated `as unknown as` adapters with narrow interfaces and require an explicit service-level authorization reason for `overrideAccess: true`.

## GPT-5.4 mini work packets

The parent H0/H1 tasks above describe outcomes. Execute the packets below one at a time. Effort is a reviewed engineering range for planning, not an instruction to skip validation when a packet takes longer.

| Packet | Parent | Reviewed effort | Primary files | Dependency and exit test |
| --- | --- | ---: | --- | --- |
| M0-01 | H0-01 | 0.5-1 day | `src/app/(frontend)/admin/review/**`, `src/lib/admin/adminReviewModel.ts`, `src/lib/navigation/mvpRouteRegistry.ts`, `scripts/admin_review_mvp.test.ts` | No dependency. Anonymous/member denial and approved administrator behavior pass. |
| M0-02 | H0-02 | 0.5 day | `src/app/(frontend)/tos/page.tsx`, `privacy-policy/page.tsx`, `waiting-list/**`, `src/app/sitemap.ts`, canonical `/terms` and `/privacy` pages | No dependency. Only approved JPV legal/public routes remain reachable and indexed. |
| M0-03 | H0-02/H0-03 | 0.5-1 day | `src/app/(frontend)/page.tsx`, canonical legal pages, `scripts/frontend_copy_approval_static.test.ts` | Client-approved wording may remain a blocker. Remove unsupported claims and stale dates; copy regression passes. |
| M0-04 | H0-04 | 0.5 day | `portal/support/page.tsx`, `portal/partner-referral/page.tsx`, `payItForwardService.ts`, `referralService.ts`, related MVP tests | No dependency. Preview forms cannot display a success state or generated reference without persistence. |
| M0-05 | H0-03 | Human decision | Client plan, Stripe product/portal decision record | Written decision defines commitment, cancellation, refund, and portal behavior. Stop here until approved. |
| M0-06 | H0-03 | 1-2 days | Stripe checkout/portal routes, plan/config helpers, landing/legal copy, checkout and billing tests | Requires M0-05. Monthly and annual contract behavior, projection, copy, and tests agree. |
| M0-07 | H0-05 | 0.5-1 day | Existing auth/request-safety helpers plus one shared public-request guard | No provider action. Origin, body, field, redirect, rate-limit, and redaction policy has unit tests. |
| M0-08 | H0-05 | 1-1.5 days | `/api/support`, `/api/subscribe`, sponsored-application, sponsored-seat checkout, focused route tests | Requires M0-07. Every public write path uses the shared guard and negative tests pass. |
| M0-09 | H0-06 | 1-2 days | `package.json`, `pnpm-lock.yaml`, affected Payload/runtime smoke tests | Patch only after compatibility review. No unreviewed high advisory; type-check, build, admin/editor, and webhook smoke pass. |
| M1-01 | H0-04/H1-03 | 1-2 days | Portal support page/service, sponsored application/access services, email queue, focused sponsored tests | Required only if support intake is in core go-live. Persist-before-success, dedupe, review, and failure tests pass. |
| M1-02 | H1-02 | 0.5-1 day | `package.json`, `scripts/status_docs_consistency.test.ts`, `scripts/frontend_milestone_static.test.ts`, other static-preflight scripts, explicit release test manifest | M0 packets stable. Update stale v3.4 guard assertions, then make one deterministic command own every required non-browser test. |
| M1-03 | H1-02 | 1-2 days | New browser E2E config/specs and feature CI | Requires M1-02 and stable launch routes. Public, auth, checkout start, portal, legal, submission, and admin-denial journeys pass. |
| M1-04 | H1-01 | 0.5 day | Removed member namespace inventory, `/portal/**`, route registry, portal/route tests | Inventory only. Produce a route parity matrix and identify the implementation owner for each feature. |
| M1-05 | H1-01 | 1-2 days | Launch-critical `/portal` routes plus shared service-backed views | Requires M1-04. `/portal` owns launch routes; removed member routes stay deleted and unavailable. |
| M1-06 | H1-03 | 1-2 days plus content | `programmeCatalog.ts`, portal programme/community views, Payload course/community services, focused tests | Requires approved content. Core course/community status comes from authorized persisted data. |
| M2-01 | H0-04/H1-03 | 1-2 days | Portal referral page/service, `payloadCourse/partnerApplications.ts`, queue/history tests | Post-core unless explicitly promoted. Referral success requires a durable application and review trail. |

Do not start M0-06 without M0-05. If M1-01 or M2-01 is not included in the approved launch scope, keep its public form disabled and do not claim the workflow is operational.

## Execution contract for GPT-5.4 mini

1. Start from a clean worktree on `feature/course-branding-and-preview`; never touch `main`.
2. Execute one task ID per change set. Do not combine unrelated cleanup.
3. Read the named files and existing tests before editing.
4. Keep the smallest diff that satisfies the task; reuse existing helpers and services.
5. Add or update focused tests in the same task. A feature change without tests is incomplete.
6. Run `git diff --check`, type-check, both Prisma validates, the focused tests, and the full release gate available at that point.
7. Do not apply migrations, change provider configuration, deploy, or run live checks unless separately approved.
8. Stop and report a blocker when a task requires a business, legal, migration, provider, or environment decision.

## Timeline gate

| Date | Required outcome |
| --- | --- |
| 10-13 July | Complete M0-01 through M0-04, obtain M0-05, and finish dependency triage. If the billing decision is still open, defer the 22 July public launch. |
| 15 July | Client content, pricing/commitment wording, legal copy, and representative course input approved or placeholders explicitly accepted. |
| 14-17 July | Complete M0-06 through M0-09 and M1-01 if support intake is part of core go-live. No launch-scoped P0 blocker remains. |
| 18-20 July | Complete M1-02 through M1-06 for launch-scoped routes and content; run the full release/browser matrix and approved smoke checks. |
| 19-20 July | Approved staging smoke, provider/email verification, and migration rehearsal evidence. |
| 21 July | Formal go/no-go decision. No unresolved P0 blocker. |
| 22 July | Front-end milestone only if public copy, legal routes, checkout terms, security blockers, and browser acceptance pass. |
| 23 July | Handover buffer and non-migration corrections. |
| 24 July | Client finished-by date; full platform cutover only if every independent approval gate passes. M2-01 remains post-core unless promoted. |

No migration is authorized by this assessment.
