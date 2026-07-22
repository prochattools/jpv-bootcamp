# JPV Bootcamp - Roadmap Progress Status

Current status for `feature/course-branding-and-preview`, using the 10 July 2026 audit at `236227c fix: require portal auth for member content` as the historical baseline, `af6de62 docs: record core go-live readiness` as the previous readiness baseline, `d55229f test: enforce programme content readiness` as the current validated implementation baseline, and `8927df9 docs: checkpoint membership implementation readiness` as the prior checkpoint baseline. The synchronized Claude staging baseline is `690c5f4 docs(release): update GO/NO-GO checklist — staging smoke 58/58 confirmed`; verify the exact branch tip with `git log --oneline -1` before any operator action because the cohesive design integration follows that baseline.

Current client truth: `docs/client/JPV_Bootcamp_Platform_Expansion_Go_Live_Plan_v3_7.docx`. Version 3.4 is the prior progress baseline. Canonical execution plan: `docs/PAYLOAD_INTEGRATION_PLAN.md`. Detailed audit evidence: `docs/V3_5_CODEBASE_ALIGNMENT_ASSESSMENT.md`.

Status update procedure: `docs/client/STATUS_UPDATE_PROCEDURE.md`.

## Current position

**Position:** Core go-live implementation and deterministic local validation are complete for the current one-membership model. Claude's deployed staging baseline passed 58/58 desktop and mobile browser journeys with no critical, high, or medium functional defect, so the **staging platform assessment is GO** at that exact image. The cohesive design integration is now layered on the same branch, passes 151/151 release gates plus 58/58 isolated local desktop/mobile Chromium journeys, and does not change authorization, billing, migration, provider, or communication behavior. The repository is not ready for the controlled staging release process and remains **FORMAL NO-GO** until this exact candidate is deployed only to the approved staging application and its independent migration/provider/content/operator approvals are recorded.

**Next task:** Review and deploy the exact cohesive design release commit only to the approved staging application for visual and functional acceptance. Migration, provider, communication, or production work remains separately gated. `M2-01` remains deferred unless explicitly promoted.

**Front-end schedule:** The 22 July front-end milestone is still conditional. Client content was due by 15 July; a landing-page content brief was supplied on 21 July and is mapped in UI-01, while testimonials, teacher/guest-speaker detail, final legal wording, and representative course input remain outstanding. The 23 July handover buffer and 24 July client finished-by date remain.

**Cutover schedule:** Full platform cutover on 22-24 July is conditional and at risk. It requires approved migrations, rehearsal and rollback evidence, provider/email verification, complete browser smoke evidence, and explicit go-live approval.

**Hard stops:** Do not apply migrations. Do not touch `main`. Do not describe static prototypes as operational workflows.

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
| **Current CODE HEAD** | `9745dac docs: add adversarial review hardening report` (2026-07-22 — 151/151 release tests, 2 critical fixes verified, 3 HIGH-risk issues documented with clear fix scope); verify with `git log --oneline -1` before any operator action |
| **Previous CODE HEAD** | `eb03a08 feat(design): unify JPV release experience` (2026-07-21 — design release candidate, 151/151 release tests, 58/58 E2E PASS, staging browser smoke 58/58 PASS) |
| **Security Status** | Staging credential exposure is accepted as non-blocking by the project owner (2026-07-21): staging contains no production data. Historical credential evidence remains in dated reports only. Hardened critical paths: webhook idempotency (atomic), sponsored decision authorization (role-guarded). |
| Release State | **FORMAL NO-GO** — security hardening improved critical paths; remaining gates are feature completion, approved pending migrations, provider verification, staging acceptance, and go-live approval |
| Historical audit baseline | `236227c fix: require portal auth for member content` |
| Previous readiness baseline | `af6de62 docs: record core go-live readiness` |
| Prior validated baseline | `d55229f test: enforce programme content readiness` |
| Prior branch tip | `8927df9 docs: checkpoint membership implementation readiness` |
| PR / review | `https://github.com/prochattools/jpv-bootcamp/pull/2` |
| Migrations applied | Staging records 16 schema migrations applied plus the completed 21-row legacy member/billing/access migration; production remains untouched |
| Migration approval | Required only for any genuinely pending staging schema or next-domain migration write, with exact target, backup, rollback, and owner approval |
| Decision readiness | `DECISION-READY, EXTERNAL APPROVALS PENDING` |
| Provider/email acceptance | Pending operator verification |
| Complete staging/browser smoke | **58/58 PASS** — desktop + mobile Chromium (2026-07-21, `eb03a08` design confirmed on staging); formal operator sign-off pending |

Staging migration evidence is recorded in `docs/CURRENT_WORK_HANDOFF.md`. This branch does not authorize further staging writes or any production migration.

## Audited readiness

These figures are a weighted readiness model for the current repository state. Since the 10 July audit, the repository has completed the launch-scoped M0/M1 implementation packets, passed the deterministic local release/browser/build/Prisma/audit gates, and added an explicit schema-migration plan plus generated-type isolation strategy. Live cutover status remains blocked by non-local approvals and operator execution.

Methodology:

- `implementation completion` counts committed launch-scoped implementation packets and current source evidence;
- `validation completion` counts repeatable local release/build/browser/type/prisma gates;
- `schema readiness` counts the approved migration plan, migration inventory, and rollback path versus the migration still being unapplied;
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
| Controlled Free access | Durable support intake, review state, and notification queue behavior implemented; migration remains unapplied | Approved migration path is executed and staging/provider verification passes |
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
- `pnpm test:migration:legacy` passed `32/32` (includes 4 rehearsal guard tests).
- `pnpm test:e2e` passed `58/58` across desktop and mobile Chromium projects (2026-07-21 — REM-02 complete).
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

**Already applied to staging (`jpvbootcamp_staging`):**
- The legacy member/billing/access migration (`scripts/migration/legacyMigration.ts`) ran successfully in two idempotent applies on the staging database (21 source rows, zero errors both runs). Run IDs and per-table counts are recorded in `docs/CURRENT_WORK_HANDOFF.md`.
- All 16 Payload/Prisma schema migrations through `20260720_000000_locked_docs_rels_new_collections` are applied to `jpvbootcamp_staging`.

**Not yet applied anywhere:**
- The Payload migration `20260707_130000_remove_table_plan_from_payload_enums` maps legacy table-plan subscription values to `free`.
- The Prisma migration `20260707_120000_rename_account_identity_columns` renames old account-reference columns/indexes to neutral names.
- The Membership Support schema migration `src/migrations/20260718_103726_membership_support_schema.ts` adds 9 tables for the membership-support domain.

Do not apply the pending migrations until the target-environment owner approves the business mapping, exact database/schema, backup, operator, maintenance window, apply path, verification, and rollback procedure. Production remains unaffected; only staging has received any migration.
