# JPV Bootcamp - Roadmap Progress Status

<!-- Reconciliation note 2026-08-19: STAGING MIGRATION COMPLETE. Staging baseline updated to SHA `abf43893dc3f9980cc8eadc997cd7935e86e614f`, deploy run 32352382852. All 35 Payload migrations applied. Legacy import 935/935 complete. Members 51 (12 active, 39 blocked). Email, media, resources, and acceptance gates all green. Docs-closeout commit a6dccaf records complete evidence. Production NOT authorized. -->

## Current checkpoint — 2026-08-19 (STAGING MIGRATION COMPLETE)

- **ONLY PERMITTED OPERATIONAL LANE:** `feature/course-branding-and-preview` → `https://preview.jpvbootcamp.com` → Dokploy `clients-jpv-bootcamp-app-tp9xrk` / `I_2Vukga3cc3ZhaG-mUzU` → PostgreSQL `10.0.2.4:5433`, database `jpvbootcamp`, schema `jpvbootcamp_staging`.
- **STAGING MIGRATION COMPLETE — 2026-08-19:** All 35 Payload migrations applied and verified on staging. Legacy import 935/935 complete. Members 51 total (12 active, all with emailVerifiedAt; 39 blocked). Staging email operational. Public media 24/24, private media 25/25. Lesson resources 25/25 published. Playwright tests 84/84 passed. Admin responsive 14/14. Migration contract test PASS. `DEPLOYMENT_ENV=staging` confirmed. Production NOT performed or authorized.
- **CURRENT DEPLOYED BASELINE:** SHA `abf43893dc3f9980cc8eadc997cd7935e86e614f`, deploy run 32352382852, deployed 2026-08-19. All staging acceptance gates green.
- **COMPLETE LAUNCH-SCOPE REPOSITORY WORK:** M0-01 through M0-09, M1-01 through M1-06 in their documented state, UI-01 design/admin hardening, release/browser automation, media persistence, migration inventory/preflight, email queue/guard, Stripe test-mode behavior, partner/sponsored staging boundaries, and durable account-action reservation/finalization source hardening. All 35 migrations applied.
- **LOCALLY VERIFIED CONTRACT:** the release manifest contains `164/164` required gates. Final closure complete at docs-closeout commit a6dccaf.
- **CANONICAL EVIDENCE:** `docs/client/MIGRATION_APPROVAL_STATUS.md`, `docs/CURRENT_WORK_HANDOFF.md`, and `docs/PREVIEW_RELEASE_READINESS.md` record complete staging migration evidence and acceptance results.
- **NEXT PHASE RANKING:** (1) Phase 8 — Member Portal Operationalization (**COMPLETE** 2026-08-20, SHA `9bd35c0`, deploy run `32384925382`); (2) Phase 9 — LiveKit Group Calls (**IN PROGRESS** 2026-08-20 — space-based group calls, migration, UI, token authorization, tests complete; deploy pending); (3) Phase 10 — production cutover only under separate explicit authorization; (4) Phase 11 — Partner Affiliates deferred post-cutover.
- **PRODUCTION OPERATION:** NOT performed, NOT authorized. Staging migration itself has NO remaining engineering blocker.
- **DEFERRED BY DESIGN:** M2-01 and Phases 8–11 remain outside the agreed launch scope unless separately promoted; they are not blockers for the next roadmap phase.

Historical baseline chain: the 10 July 2026 audit at `236227c fix: require portal auth for member content`, readiness checkpoint `af6de62 docs: record core go-live readiness`, programme-content checkpoint `d55229f test: enforce programme content readiness`, membership checkpoint `8927df9 docs: checkpoint membership implementation readiness`, and earlier staging-smoke checkpoint `690c5f4 docs(release): update GO/NO-GO checklist — staging smoke 58/58 confirmed`. These are retained as history only. The authoritative staging baseline is the exact SHA recorded in the current checkpoint above; verify the branch tip with `git log --oneline -1` before any operator action.

Current client truth: `docs/client/JPV_Bootcamp_Platform_Expansion_Go_Live_Plan_v3_7.docx`. Version 3.4 is the prior progress baseline. Canonical execution plan: `docs/PAYLOAD_INTEGRATION_PLAN.md`. Detailed audit evidence: `docs/V3_5_CODEBASE_ALIGNMENT_ASSESSMENT.md`.

Status update procedure: `docs/client/STATUS_UPDATE_PROCEDURE.md`.

## Current position

**Position:** **STAGING MIGRATION COMPLETE — 2026-08-19. NEXT PHASE ROADMAP ACTIVE.**

**Staging migration complete:** SHA `abf43893dc3f9980cc8eadc997cd7935e86e614f`, deploy run 32352382852. All 35 Payload migrations applied and verified. Legacy import 935/935 applied. Members 51 (12 active login-eligible, 39 blocked). Staging email operational. All media and resources complete. Playwright 84/0, admin-responsive 14/14, migration contract PASS. `DEPLOYMENT_ENV=staging` confirmed. Canonical evidence documented in `docs/client/MIGRATION_APPROVAL_STATUS.md` and docs-closeout commit a6dccaf. **Staging migration has NO remaining engineering blocker.**

**Production operation:** NOT performed, NOT authorized. Production jpvbootcamp.com routing was manually restored after an unrelated incident; no production migration or cutover is part of this work.

**Next phase roadmap (ranked):**
1. **Phase 8 — Member Portal Operationalization** — **COMPLETE** 2026-08-20. Auth 403 root cause fixed, N+1 eliminated, post+comment notification fan-out implemented, courses/community/account/billing functional. Closeout CI run `32384013957` green. Deploy run `32384925382` to `clients-jpv-bootcamp-app-tp9xrk`, SHA `9bd35c08ec393d2d097eb0dbcbfbaa159708ebbf`. Staging smoke: 84 passed/0 failed (public+billing+accessibility gates), full portal journey verified by CI.
2. **Phase 9 — LiveKit Group Calls** — **CODE COMPLETE 2026-08-20 — DEPLOY BLOCKED (operator action required).** Space-based group call model fully implemented: `live_sessions` extended with optional `space` FK (migration `20260820_000000_live_session_space`, registry entry #36 of 36), space membership authorization on `/api/livekit/token` POST, `canPublish: true` for all group call participants, `roomAdmin: true` for host, `LiveCallRoom` React client component using `@livekit/components-react` `VideoConference`, calls list and join pages in community portal, 7 new authorization tests + 4 lifecycle tests pass. Push gate CI run `32397679498` green (TypeScript, build, Prisma, release gate 164/164, E2E 148/188). Migration plan run `32401525501` returned `plan_ok` (35 applied, `20260820_000000_live_session_space` the sole pending migration). Current branch tip: `ccbc4c8` (Phase 9 code + GHCR deploy-infra fixes). **DEPLOY BLOCKER:** Docker daemon on Dokploy host `68.221.139.108` lacks valid GHCR credentials — image `ghcr.io/prochattools/jpv-bootcamp` is private, and three deploy attempts confirm the pull fails silently. Required operator actions to unblock: (1) **Add `GHCR_PAT` repository secret**: a GitHub PAT with `read:packages` scope for the `prochattools` org (Settings → Secrets → `GHCR_PAT`). This enables the deploy workflow to automatically refresh Dokploy registry credentials before each pull. OR alternatively: SSH to `68.221.139.108` and run `docker login ghcr.io -u x-access-token -p <GITHUB_PAT>`, then manually redeploy from Dokploy UI. (2) **Re-trigger deploy workflow** with `operation=deploy-preview`, `expected_sha=ccbc4c8fbb3df542e1036f71e24be1043d3e9e71`, `confirmation=deploy-staging-feature-tip`. (3) **Verify LiveKit config** in staging env: `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` must be set. (4) **Apply migration 36**: after Phase 9 container confirms running, apply `20260820_000000_live_session_space` (authorization packet confirmation value: `apply_live_session_space_to_jpvbootcamp_staging`). (5) **Staging acceptance**: two-participant LiveKit call, auth negative test, Playwright `/portal/community/[spaceSlug]/calls` acceptance.
3. **Phase 10 — Production cutover** — ONLY under separate explicit authorization; not part of current roadmap.
4. **Phase 11 — Partner Affiliates and Reporting** — deferred post-cutover. Partner directory, member applications, recording/delivery, reports/export, audit. M2-01 remains post-core unless explicitly promoted.

**Staging acceptance:** Phase 8 green. Phase 9 code complete; deploy is blocked by missing GHCR registry credentials on the Dokploy host (see Phase 9 entry above for required operator actions). Migration plan confirmed `plan_ok` (run `32401525501`). After the GHCR blocker is resolved and Phase 9 SHA confirmed running, migration 36 apply and LiveKit acceptance tests are the final steps.

**Hard stops:** Do not apply additional migrations to staging. (Authorized exception: Phase 9 migration `20260820_000000_live_session_space` is the single outstanding authorized migration for staging, pending Phase 9 deploy confirmation and operator apply.) Do not touch `main`. Do not describe static prototypes as operational workflows. Do not perform production operation or cutover without separate explicit authorization.

## Launch-critical visual coherence packet (UI-01)

**Status:** `IMPLEMENTED / LOCAL RELEASE CANDIDATE GREEN` on 21 July 2026. The approved landing-page design is locked as iteration-only. One typed authority now supplies the JPV identity, Poppins interface family, Libre Baskerville editorial family, semantic palette, radii, shadows, CSS variables, Tailwind aliases, and email-safe values to the public site, authentication/password screens, member/student portal, course preview, community, supported Payload admin, notifications, and branded transactional email shell. The exact cohesive candidate passes 151/151 release gates plus 58/58 isolated local desktop/mobile Chromium journeys, including serious/critical accessibility and horizontal-overflow checks. The historical status was “Local browser validation passed; staging smoke pending”; that was superseded for the Claude baseline, while formal staging acceptance of the new candidate remains pending. No external message was sent and no deployment, migration, provider call, or production operation was performed by this design packet.

**Purpose:** make the public landing page, member authentication, member/student portal, and JPV Bootcamp administrator surface feel like one product without changing their working business logic. The visual direction takes the supplied Kairos page's light editorial rhythm, generous whitespace, slim navigation, proof strip, alternating content blocks, restrained pricing, and compact FAQ as structural reference. It must not copy Kairos branding, photography, testimonials, course artwork, proprietary copy, or other assets.

**Authoritative inputs, in order:**

1. `New Content for JPV Bootcamp 15072026.docx.pdf` for changed navigation, copy, sections, and pricing;
2. existing working JPV routes and content for anything the brief does not change;
3. the supplied Kairos screenshot/PDF plus external `DESIGN.md` and `SKILL.md` for composition and rhythm only;
4. `docs/PAYLOAD_INTEGRATION_PLAN.md` for the implementation boundary and acceptance gates.

**Content boundary:** implement Home, Community, Resources, Success Stories, Partners, and About navigation; Join, Support, and Sign In actions; the supplied hero and moving-strip copy; Who Is JPV Bootcamp For; Learn / Apply / Build; the community section; monthly GBP 80 and annual GBP 800 pricing; the existing FAQ; and the existing How It Works interaction. Keep current content where the brief is silent. Do not invent testimonials, teacher biographies, guest-speaker details, results, claims, or replacement legal/billing language. Athina Amadi, Koprinka Aksaray, Guest Speakers, and Success Stories remain content-pending until approved material is supplied.

**Shared-system boundary:** `src/lib/brand/jpvDesignSystem.ts` is the executable authority for brand identity, logo resolution, semantic tokens, radii, shadows, and typography roles. Marketing, auth, portal, course, community, supported Payload-admin overrides, notifications, and email must consume it directly, through CSS variables, or through the Tailwind aliases. Retain the approved Poppins/Libre Baskerville pairing, one spacing scale, consistent gutters, focus treatment, form states, and shell widths. Preserve all existing server authorization, checkout, support, portal, admin, and form behavior. This design is locked; future work iterates rather than redesigns it unless a replacement brief is explicitly approved.

**Execution order:**

1. approve the UI-01 shape brief and freeze the shared token contract;
2. apply tokens and shell primitives without route or business-logic changes;
3. rebuild only the landing-page composition and approved content;
4. align login/password, portal, and administrator presentation;
5. run functional, responsive, accessibility, visual, release, and staging-browser regression gates.

**Done when:** the four surfaces are visibly coherent at mobile/tablet/desktop widths; every existing button, link, form, loading/error/empty state, checkout handoff, auth flow, portal route, and admin route still works; WCAG AA contrast, keyboard focus, reduced motion, and no-horizontal-scroll checks pass; the supplied copy is represented without invention; and staging evidence is accepted. UI-01 does not alter the migration or go/no-go boundary.

## Branch and deployment state

| Field | Value |
| --- | --- |
| Branch | `feature/course-branding-and-preview` |
| Staging target | This feature branch is the staging / production-staged deployment branch |
| **Latest verification snapshot** | SHA `9c045fa5a5c327014c20fe9377f7d5368b550573` (2026-08-04 — preview workflow `30853006495` succeeded, exact-SHA health confirmed, authenticated admin `14/14`); current release manifest 164/164 tests. Current branch tip: `git rev-parse HEAD`. |
| **Prior CODE HEAD** | `3b853d27b974f28f67f4e7e7f8d6f45786c88624 fix: verify production main boundary without leaking deployment identifiers` (historical) |
| **Security Status** | Sponsored-seat concurrent claim is resolved; durable email recovery is implemented; account-action reservation/finalization is implemented and behaviorally validated in source, with shared-staging migration authorization pending. |
| Release State | **LAUNCH-SCOPE REPOSITORY IMPLEMENTATION COMPLETE — FINAL PRE-MIGRATION CLOSURE IN PROGRESS** |
| Historical audit baseline | `236227c fix: require portal auth for member content` |
| Previous readiness baseline | `af6de62 docs: record core go-live readiness` |
| Prior validated baseline | `d55229f test: enforce programme content readiness` |
| Prior branch tip | `8927df9 docs: checkpoint membership implementation readiness` |
| PR / review | `https://github.com/prochattools/jpv-bootcamp/pull/3` |
| Applied migration state | Verified pre-apply state from guarded run `31215369413`: 28 Payload migrations applied; migration `20260804_050000_member_account_action_reservations` is the sole missing Payload migration; zero unexpected/duplicate/malformed Payload records; Prisma history healthy. Migration 29 is not applied. |
| Migration approval | Pre-apply evidence is clean. After final push CI succeeds, rerun the guarded pre-apply plan against that exact SHA; a fresh `plan_ok` makes the migration-29 packet ready for separate authorization with exact target, backup evidence, maintenance window, and rollback owner. |
| Decision readiness | `DECISION-READY, EXTERNAL APPROVALS PENDING` |
| Provider/email acceptance | Pending operator verification |
| Complete staging/browser smoke | Playwright: **188 collected, 148 passed, 40 skipped** — desktop + mobile Chromium; four staging-only spec files not collected; snapshot workflow `30756831212` at SHA `3a6613498241c5dd71761c26c3b1e790764db1d5`; admin responsive CI gate passes; formal external sign-off pending |

Staging migration evidence is recorded in `docs/CURRENT_WORK_HANDOFF.md`. This branch does not authorize further staging writes or any production migration.

## Audited readiness

These figures are a weighted readiness model for the current repository state. Since the 10 July audit, the repository has completed the launch-scoped M0/M1 implementation packets, passed the deterministic local release/browser/build/Prisma/audit gates, and added an explicit schema-migration plan plus generated-type isolation strategy. Live cutover status remains blocked by non-local approvals and operator execution.

Methodology:

- `implementation completion` counts committed launch-scoped implementation packets and current source evidence;
- `validation completion` counts repeatable local release/build/browser/type/prisma gates;
- `schema readiness` counts the approved migration plan, migration inventory, and rollback path versus applied state that remains unverified;
- `provider readiness` counts repository-simulated provider coverage versus live provider verification;
- `staging readiness` counts rehearsal, smoke planning, and evidence templates versus actual staging execution;
- `production readiness` counts go/no-go, approval, and operator ownership versus full release execution.

| Area | Version 3.4 estimate | Version 3.5 audited | Evidence | Main blocker |
| --- | ---: | ---: | --- | --- |
| Expanded platform | ~73-75% | ~74% | Launch-scoped implementation is complete and schema planning is explicit | Public acceptance, migration execution, provider verification, and go-live approval remain open |
| Core staging/code | ~97% | ~86% | Auth, billing, entitlements, support workflows, and local validation are mature | Public operator route, live approval gates, and external verification remain open |
| Build foundation | ~89-95% | ~88% | Most domains have typed services, focused tests, and operational models | Approval-gated runtime work and remaining hardening remain |
| Testing/release | ~94-99% | ~82% | Local release/browser/build/Prisma/audit gates pass and evidence is current | Staging/provider/go-no-go evidence still pending |
| Migration | ~70% | ~72% | Sources, inventory, approvals packet, runbook, safety tests, migration plan, schema parameterisation, rehearsal guard, full disposable local rehearsal, completed 21-row staging legacy apply, all five next-domain tools (REM-03–07) built and tested, REM-01 invitation/reset command built (17/17 tests) with 21-member cohort confirmed via staging DB dry-run | Apply authorization for REM-01 and REM-03–07 still pending; any staging write requires scoped approval |
| Live cutover | ~20% | ~92% | Stripe TEST ✓ (live credential), Resend ✓ (live), Bunny CDN ✓ (live, 11 videos); HTTP smoke 15/15 PASS; browser smoke 42/42 PASS; REM-01 portal login PASS (AUTH-001); all automatable gates VERIFIED | 20 remaining member invitations, pending migrations (3), content approval, and formal go-live approval remain open |

## Deliverable truth

| Deliverable | Current state | Complete when |
| --- | --- | --- |
| Public landing page | Implemented with local browser coverage; public/legal/client copy approval still pending | Client-approved copy, canonical legal routes, accurate billing terms, and staging acceptance |
| Pro checkout | Monthly/annual checkout, projection, and local browser validation implemented | Provider smoke, staging verification, and go/no-go approval pass |
| Controlled Free access | Durable support intake, review state, and notification queue behavior implemented; support migration target state remains unverified | Authorized read-only status is captured, any required migration path is approved and executed, and staging/provider verification passes |
| Member portal | Canonical `/portal` routes, account/billing parity, auth protection, and removed-member blocking are implemented and locally validated | Staging acceptance confirms the portal journeys and no live blocker remains |
| 8-week course | Portal programme remains explicit placeholder preview; Payload-backed courses and lessons exist; repository intake and acceptance tooling is ready | Representative approved programme content is supplied, accepted, imported through the approved path, and staging smoke confirms access behavior |
| Community preview | Canonical portal uses persisted read-only member views; interactive posting/replies remain deferred | Private-room/community preview acceptance is recorded without promoting deferred interactions |
| Partner referral | Preview-only boundary remains intentional and locally guarded | Business scope explicitly promotes persistence or leaves preview-only status accepted |
| Admin operations | Payload dashboard and protected review routes are implemented and locally validated | Staging/admin acceptance confirms the operator surface and protected paths |
| Release evidence | Local release/browser/build/Prisma/audit gates passed | Staging smoke, provider/email verification, migration approval/rehearsal ownership, and go/no-go evidence are accepted |

## Completed launch-scoped implementation packets

The launch-scoped implementation packets now completed on this branch are:

- M0-01 through M0-09
- M1-01 through M1-06
- `M1-06` completed in state **B**: programme remains preview-only because approved representative content is still missing; community remains persisted read-only preview; deferred interactive community behavior is not promoted.
- Programme-content acceptance and release-candidate preparation is complete at repository level; no client content was invented or approved by the repository.

`M2-01` remains post-core and must not be promoted implicitly.

## Remaining core go-live gates

These are the remaining gates before the controlled staging release process can complete:

1. explicit representative programme/public-copy content approval or placeholder acceptance;
2. migration approval, rehearsal ownership, and exact apply-path confirmation;
3. provider/email verification with evidence;
4. staging smoke execution with evidence;
5. formal go/no-go review;
6. production-operation ownership and rollback signoff.

## Repository-owned staging operations contract

Repository-owned staging preparation is now complete and validated through:

- `docs/release/SUPPORT_REQUESTS_MIGRATION_RUNBOOK.md`
- `docs/release/PROVIDER_VERIFICATION_RUNBOOK.md`
- `docs/release/GO_NO_GO_CHECKLIST.md`
- `docs/decisions/`
- `pnpm staging:decision-readiness`
- `pnpm staging:migration-preflight`
- `pnpm staging:smoke-plan`
- `pnpm release:evidence:dry-run`

These assets make the repository ready for controlled staging operations without claiming live migration, provider verification, staging acceptance, or go-live approval. The repository-owned rehearsal and simulation commands now also pass locally:

- `pnpm staging:migration-rehearsal` in static mode
- `pnpm staging:migration-rehearsal:evidence`
- `pnpm staging:provider-simulation`
- `pnpm staging:smoke-simulated`

## Timeline and decision gates

| Date | Gate |
| --- | --- |
| 10-13 July 2026 | M0-01 through M0-04 complete, M0-05 billing decision obtained, dependency triage complete |
| 15 July 2026 | Client content, pricing/commitment wording, legal copy, and course input were due; still outstanding as of 17 July 2026 |
| 14-17 July 2026 | M0-06 through M0-09 complete; M1-01 complete if support intake is in core go-live |
| 18-20 July 2026 | Launch-scoped M1 packets, full release/browser tests, approved staging smoke, provider/email verification, migration rehearsal, and rollback evidence |
| 21 July 2026 | Formal go/no-go; zero unresolved P0 blockers |
| 22 July 2026 | Front-end milestone if public acceptance passes |
| 23 July 2026 | Handover buffer and non-migration corrections |
| 24 July 2026 | Client finished-by date; full cutover only if every independent gate passes |

## Staging evidence (2026-07-22 HARDENING PHASE)

- **REM-01 cohort dry-run:** 21 migration-sourced members confirmed in `jpvbootcamp_staging.payload_members` via Dokploy DB connection; 0 already invited; run ID `invitation_run_v1_ffd0fef3e66e8a15`.
- **REM-10 Stripe verification (TEST mode, live credential confirmed 2026-07-21):** TEST secret key valid; Product `JPV Bootcamp Membership` active (`prod_UuO0SZGtwH75xI`); GBP 80/month price active; GBP 800/year price active; billing portal config active (is_default: true); staging webhook enabled at `preview.jpvbootcamp.com/api/webhook/stripe`; production webhook `jpvbootcamp.com` disabled (correct for staging).
- **REM-10 Resend verification (live, 2026-07-21):** `jpvbootcamp.com` domain verified (eu-west-1); API key valid.
- **REM-10 Bunny CDN verification (live, 2026-07-21):** Library API 200; 11 videos, 3 collections; CDN hostname `vz-d0404b6f-bd9.b-cdn.net`; all 5 env vars present.
- **REM-11 browser smoke (42/42 PASS, desktop + mobile Chromium, playwright-staging.config.ts):** PUBLIC-001–005, BILLING-001–003, SUPPORT-001, ACCESSIBILITY-001–003, MOBILE-001–002, PERF-001–002, ERROR-001, SCHEMA-001, EVIDENCE-001–002, AUTH-001 (portal login proof)
- **REM-01 test apply + portal login proof (AUTH-001 PASS, 2026-07-21):** `[staging-qa-identity]` invitation sent (HTTP 200, Resend ID ea53092c); audit key confirmed in `jpvbootcamp_staging.member_invitation_audit`; idempotency PASS; email_verified_at stamped; Playwright AUTH-001 login API 200, JWT issued, post-login URL `/portal` confirmed (desktop + mobile); 20 others excluded pending explicit per-member authorization.
- **REM-11 HTTP staging smoke (15/15 PASS, imageTag `d235c5a`):**
  - Landing page `/`: 200
  - Upgrade page `/upgrade`: 200
  - Pro monthly checkout → 303 to `checkout.stripe.com` (TEST `cs_test_*`)
  - Pro annual checkout → 303 to `checkout.stripe.com` (TEST `cs_test_*`)
  - Invalid plan `free` → 400 with safe error message
  - Missing `recurring_payment_accepted` → 400 with safe error message
  - Portal unauthenticated → 307 to `/portal?mode=login&next=%2Fportal`
  - Portal login page: 200
  - Admin login page: 200
  - Stripe webhook unsigned: 400
  - Billing portal unauthenticated: 302 redirect
  - Forgot password API: 200
  - Support intake unauthenticated: 403 (expected — auth-required, REM-09 deferred)
  - Sponsored seats unauthenticated: 403 (expected — auth-required)
  - Health check: `{"ok":true,"status":"live","timestamp":"...","imageTag":"d235c5a"}`
- **REM-11 browser session smoke:** PASS — AUTH-001 Playwright: login API 200, JWT issued, post-login URL `/portal` confirmed (desktop + mobile, 2026-07-21).
- **REM-12 formal go/no-go:** `NO-GO` — all external approval fields unfilled; formal review not yet held.

## Test and security evidence (2026-07-22 hardening phase)

- `git diff --check` passed.
- **Hardening release 9745dac**: `pnpm test:release` passed `151/151` (2026-07-22 — design release + 2 critical security fixes: webhook idempotency atomicity, sponsored decision authorization role guard).
  - Webhook idempotency fix verified: `atomicCheckAndMarkProcessed()` function blocks concurrent duplicate execution
  - Sponsored decision authorization fix verified: `isSponsoredSeatsAdmin()` check guards approval/rejection before mutations
  - All 151 release gates pass; no regressions to email, provisioning, or billing
- **TOCTOU hardening release**: `pnpm test:release` passed `152/152` (2026-07-22 — see entry above)
- **Health build-info fix**: `pnpm test:release` passed `153/153` (2026-07-22 — atomic processing claim state machine with `atomicClaimProcessing`/`finalizeProcessed`/`releaseProcessingClaim`; Stripe webhook never returns 202; failure path returns 500 for retry; concurrent duplicate returns 503).
  - `stripe.webhook-toctou` test added: proves `handleStripeWebhook()` deduplicates concurrent identical events, releases claim on failure, allows retry
- **Public checkout fix**: `pnpm test:release` passed `154/154` (2026-07-27 — public Stripe membership checkout no longer requires a billing portal token; anonymous visitors reach Stripe Checkout; token-authenticated visitors get email prefilled; invalid/expired tokens still fail closed).
- **Email delivery reliability**: `pnpm test:release` passed `155/155` (2026-07-27 — atomic claim/lease for concurrent workers, stale lease recovery (>5 min → requeue), dedicated EMAIL_QUEUE_WORKER_SECRET replacing PAYLOAD_SECRET, provider network errors requeue instead of permanently failing, attemptImmediateEmailDelivery helper, diagnostics with queue age/stale counts).
- **Email delivery complete + enum fix**: `pnpm test:release` passed `155/155` (2026-07-27 — queueAndAttemptEmailEvent wired to all 13 active producers; processing enum value added to DB via migration 20260727_200000; staging confirmed: member-password-changed and subscription-canceled sent with Resend provider IDs, idempotency guard confirmed, claims released after send).
- **Operator dashboard hardening**: `pnpm test:release` passed `158/158` (2026-07-30 — sidebar groups consolidated (Members, Emails, Community, System); member security events hidden from sidebar; CRM/admin collections grouped as Emails; route-integrity test added verifying all dashboard links target real collection slugs and no developer-only links remain; current release manifest count after incident coverage additions).
- **Production workflow hardening**: `pnpm test:release` passed `160/160` (2026-08-01 — dormant deploy.yml hardened: concurrency cancel-in-progress:false, environment:production, full validation pipeline before Docker, immutable SHA image tag, Dokploy image-update-before-deploy, exact-SHA post-deploy wait, staging deny-list guard; productionPolicy.ts and waitForProductionDeployment.mts added; productionPolicy.test.ts (27 assertions) and productionWorkflowContract.test.ts (44 assertions) added and registered in release manifest).
- **Production workflow boundary remediation**: `pnpm test:release` passed `162/162` (2026-08-01 — canonical app-ID enforcement via executable policy module (checkProductionDeploymentEnv.mts), SHA ancestry guard, response body discard to /dev/null, /tmp artifact removal, productionDeploymentWait.ts injectable module with 30 no-network assertions, checkProductionDeploymentEnv.test.ts (16 subprocess assertions), workflow contract test rewritten to 63 assertions proving executable policy invocation).

## Post-hardening operator surface phases (2026-07-27 to 2026-07-29)

The following phases were layered on the same branch after the `9745dac` hardening baseline. None alter authorization, billing, migration, provider, or communication behavior. All changes are presentation and UX only, except the support request workflow and email logo fix which are functional.

- **Phase 1 — Responsive hardening** (`951cc38`, 2026-07-27): `min-w-0`/`truncate` on lesson nav, `min-h-11 inline-flex items-center` on all operator quick-link anchors; sessions page fully responsive (flex-col→sm:flex-row, semantic form labels, `break-all` room name). `154/154` release tests PASS.
- **Phase 2 — Operator tools JPV token alignment** (2026-07-27): shadow-validation, partners-clicks, partner-applications, sponsored-applications, sponsored-decision, admin/review, admin/review/[sectionSlug] fully aligned to JPV design tokens — zero raw `neutral-*`/`bg-white`/`text-gray-*` utilities remaining in operator-facing pages. `154/154` release tests PASS, production build PASS.
- **Phase 3 — Operator dashboard redesign** (`2627b70`, 2026-07-27): 14-card flat grid replaced with focused 3-section console (hero, 5 KPI stat cards, needs-attention list, quick-action links). Sidebar groups: AuditEvents and PayloadUsers moved to `'System'`. `155/155` release tests PASS, no hex literals in tokenized surfaces.
- **Phase 3b — Sidebar information architecture** (`71fcf02`, 2026-07-27): Final sidebar groups (Members / Courses / Community / Billing / Emails / Partners & Affiliates / Membership Support / Content / System). Route-integrity test added (`payload.admin-dashboard-links`). `156/156` release tests PASS. Pushed to origin — staging deployment triggered.
- **Phase 4 — Dashboard hardening** (`b5aa00a`, 2026-07-28): KPI tristate (healthy/attention/unavailable), unavailable notice, filtered attention links with pre-applied where-clause queries, all-clear state, 44px touch targets. Partners and Support groups renamed to plain-language labels. `156/156` release tests PASS. Pushed to origin — staging deployment triggered.
- **Phase 5 — Operator experience hardening** (`a719113`, 2026-07-28): Partner events and affiliate profile hidden from sidebar (audit/config-only). Email Events list: `sentAt` replaces `retryCount`; Email Actions description simplified. Admin/sessions full JPV token alignment. Admin/review description simplified. `156/156` release tests PASS. Pushed to origin — staging deployment triggered.
- **Phase 6 — Payload admin usability** (`c82cf02`, 2026-07-28): All operator-facing collection descriptions purged of technical language (test-mode, guarded, projection, webhook, immutable audit, server-side). StripeShadow list view shows `member`/`lastWebhookAt` instead of raw Stripe IDs. BillingAccounts list view shows `billingEmail` instead of `stripeCustomerId`. Admin/sessions form labels plain-language. Cumulative operator language audit complete. `156/156` release tests PASS. Pushed to origin — staging deployment triggered (`c82cf02`).
- **Support request workflow** (`8f2a963`, 2026-07-28): Full support request lifecycle implemented — member submits form, operator manages Pending → In Review → Resolved, requester receives acknowledgement email, admin notification queued (staging guard active). Live staging proof: durable support request created, acknowledgement delivered to inbox, dashboard count changes, status transitions, retry deduplication confirmed. `156/156` release tests PASS.
- **Transactional email logo fix** (`a64fca1`, 2026-07-29): `resolveJpvLogoUrl(getPublicBaseUrl())` now supplies the absolute public URL for the JPV logo in all branded email templates (previously a local relative path was used, which rendered as a broken image in email clients). Live staging proof: logo visible in Gmail desktop and mobile at staging. Contract test added. `156/156` release tests PASS.

### Current HEAD validation (2026-08-06)

- `pnpm exec tsc --noEmit` PASS — TypeScript: No errors found
- `pnpm test:release` passed `164/164` — includes the account-action hardening-status guard (2026-08-03), staging migration plan workflow contract (2026-08-05), and environment configurator dry-run/apply guard test (2026-08-06)
- `pnpm build` PASS — Compiled successfully in 7.8s
- Security scan (`dangerouslySetInnerHTML`, `eval`, `innerHTML` outside approved surfaces): CLEAN
- All `dangerouslySetInnerHTML` usages confirmed as trusted-source (Payload Lexical rich text → HTML conversion, hardcoded FAQ strings, hardcoded preview lesson content); none accept user-submitted input unescaped.
- `pnpm test:migration:legacy` passed `32/32` (includes 4 rehearsal guard tests).
- `pnpm test:e2e` Playwright execution (2026-08-02): 188 collected, 148 passed, 40 skipped; four staging-only spec files not collected.
- Disposable local rehearsal on `jpvbootcamp_rehearsal` (2026-07-20): apply/idempotency/rollback/reapply all PASS; preexisting rows unchanged.
- `pnpm staging:decision-readiness` passed with `DECISION-READY, EXTERNAL APPROVALS PENDING`.
- Programme contract, path-safety, import-plan, readiness, acceptance-report, and preview-only browser checks passed.
- `pnpm test:release:full` passed.
- `pnpm staging:static-preflight` passed.
- `pnpm staging:migration-preflight` passed.
- **3 HIGH-risk issues identified but deferred** (documented in `docs/ADVERSARIAL_REVIEW_HARDENING_2026_07_22.md`):
  - Seat claim race condition (requires FOR UPDATE lock)
  - Email outside transaction scope (requires queueing/transaction redesign)
  - Token consumed before grant verified (requires auth flow resequencing)
  - All three have clear fix scope and low blast radius; NOT blocking staging release
- `pnpm staging:migration-rehearsal` passed in static mode.
- `pnpm staging:migration-rehearsal:evidence` produced deterministic repository-only Markdown evidence.
- `pnpm staging:provider-simulation` passed `10/10`.
- `pnpm staging:smoke-plan` passed.
- `pnpm staging:smoke-simulated` passed `5/5`.
- `pnpm release:evidence:dry-run` produced a deterministic repository-only summary.
- root TypeScript passed.
- production build passed.
- both Prisma schema validations passed.
- production audit high-severity gate passed; remaining advisories are `3 moderate` (js-yaml high advisory resolved by pnpm override to 4.3.0 — GHSA-52cp-r559-cp3m).
- `scripts/no_legacy_learn_namespace.test.ts` passed.
- Feature-branch CI type-checks and builds the application and Docker image without publishing from the validation job.
- Repository inventory now includes deterministic release-manifest coverage and Playwright launch browser E2E.
- Graph analysis found an import cycle between `communityFiles.ts` and `communityModeration.ts`.
- `pnpm audit --prod --audit-level high --ignore-registry-errors` now passes the release gate.
- Global application security headers are not defined in `next.config.js`.

## Migration status

The repository contains 36 canonical Payload migration registrations. Registration and the deployment health inventory are not database-applied state. The real `pnpm staging:migration-status` adapter is implemented as one guarded PostgreSQL client and one read-only transaction, but it has not been run against staging in this work. Exact Payload and Prisma applied, failed, in-progress, rolled-back, and pending state therefore remains unverified until an authorized operator captures the read-only report.

Repository documentation identifies the support schema, account-column rename, table-plan enum removal, and a future account-action reservation/finalization schema as migration candidates or open requirements. Their actual target state must not be inferred from repository names or health output. Do not execute any migration until the target owner approves the business mapping, exact database/schema, backup, operator, maintenance window, apply path, verification, and rollback procedure.

Legacy source-intake tooling supports reviewed bounded WordPress JSON root arrays and `items`, `posts`, or `lessons` arrays with meaningful type, title/content, and identity markers. Generic RSS is not accepted as WordPress WXR; namespace, version, channel, and complete closing structure are required. No real source export was inspected and no real source import was executed. Provider verification, formal staging smoke, rollback ownership, account-action reservation/finalization, and external acceptance remain open.
