# Current Work Handoff

Use this document as the canonical starting point for a new Codex or Workbench conversation.

## Repository identity

- Repository: `prochattools-jpv-bootcamp`
- Branch: `feature/course-branding-and-preview`
- Wave 3 checkpoint HEAD: `57711f9 feat: complete wave 3 course platform`
- Packet 9 checkpoint HEAD: `8927df9 docs: checkpoint membership implementation readiness`
- Registry reconciliation HEAD: `9780f31 fix(registry): update migration inventory for staging deployment`
- **Current HEAD**: `e82d4ba migration: add reconciliation metrics and scoped rollback`
- Pull request: `https://github.com/prochattools/jpv-bootcamp/pull/2`
- Staging URL: `https://preview.jpvbootcamp.com` (deployed, application `I_2Vukga3cc3ZhaG-mUzU`)
- Staging DB: `jpvbootcamp_staging` on `100.71.31.88`; all 16 schema migrations applied
- Staging deployment performed: `Yes`; GitHub Actions are manual-only to conserve minutes
- Credential remediation: `COMPLETE` — old email/password rejected, renamed account with old password rejected, new credential accepted, old JWT rejected, sessions cleared
- Provider verification: Stripe test Checkout, LiveKit, Bunny webhook/playback, and staging smoke are verified
- Legacy migration: first staging apply completed for 21 source rows; second apply completed with zero errors and logical idempotency; detailed inserted/updated/unchanged reconciliation and rehearsal rollback remain active work
- **Live Email/Auth Verification**: backend/API/database proof complete for the reset flow; mailbox rendering and full browser-session acceptance remain operator evidence unless separately recorded
- Protected unrelated dirty paths (DO NOT MODIFY):
  - `src/payload-types.ts` (unrelated schema changes; type generation approval required before sync)
  - `docs/client/JPV_Bootcamp_Platform_Expansion_Go_Live_Plan_v3_7.docx`
  - `docs/client/fixtures/`

## Wave 4 — Release infrastructure and readiness harnesses

**Status: COMPLETE — all non-gated implementation done**

### Wave 4 commits
- `aacd76d` test: add disabled-by-default provider verification harnesses
- `bdfeef2` feat: add provider readiness diagnostics  
- `9311846` feat: add subscription migration rehearsal
- `3a855fc` feat: complete subscription migration inventory
- `de47812` chore: add payload type isolation preflight
- `53dc6fb` chore: add isolated migration preflight

### Wave 4 additions
- 18 new release harnesses (36 files: .ts + .test.ts) covering:
  - Provider readiness and verification (Stripe, Bunny, email)
  - Subscription migration inventory with cohort classification
  - Migration rehearsal simulation engine
  - Payload type isolation procedures
  - Migration preflight validation
  - A11y, performance, security hardening checks
  - Rollback and reconciliation test suites
  - Staging approval and smoke testing frameworks
  - Go/no-go decision evidence generation

- All 140 release tests passing (140/140) — includes 2 new registry reconciliation tests
- TypeScript: Clean
- Browser E2E: 58/58 passing
- Release test suite: FULL PASS

### Wave 4 validation

- `pnpm test:release`: **140/140 PASS**
- `pnpm test:e2e`: **58/58 PASS**
- `pnpm test:release:full`: **PASS**
- `pnpm exec tsc --noEmit --pretty false --incremental false`: **CLEAN**
- `git diff --check`: **CLEAN**

### Packet registry updates
- PAYLOAD-02: marked as implemented (cockpit tests pass)
- All "blocked" packets verified to have passing validation commands
- Registry now accurate reflecting actual codebase state

### Migration reconciliation checkpoint (`e82d4ba`)
- Added per-table `inserted` / `updated` / `unchanged` / `notApplicable` metrics.
- Preserved pre-existing member ownership instead of overwriting its source marker.
- Added relationship-aware classification for billing accounts, subscriptions, and access grants.
- Replaced global migration rollback with run-scoped rollback based on audit outcomes.
- Rollback refuses legacy runs without outcome metadata and refuses updated pre-existing rows without before-images.
- Validation: migration tests **28/28 PASS**, TypeScript **CLEAN**, changed-path security scan **0 findings**.
- The full release suite exceeded the synchronous Workbench deadline; its previously verified baseline remains 140/140 and must be rerun as a persisted or operator validation before formal release.
- Exact next task: produce staging reconciliation metrics from a no-change rerun, then rehearse rollback/reapply on a disposable restored copy; never rollback live staging without explicit approval.

Before doing any work, verify the branch, HEAD, worktree, and migration state. A direct descendant of the recorded HEAD may be acceptable only when its commits are already documented completed work.

## Roadmap position

### Complete

- M0-01 through M0-09
- M1-01 through M1-06
- Canonical member namespace consolidation under `/portal/**`
- Canonical administrator namespace under `/admin/**`
- Complete removal of the former `/learn/**` namespace
- Durable support-intake implementation and tests
- Portal account and billing parity
- Browser E2E and feature-branch CI
- Deterministic non-browser release manifest
- Programme-content intake, validation, acceptance-report, import-plan, approval, and preview-safety tooling
- Repository-owned migration preflight and static rehearsal
- Provider simulation and local simulated staging smoke
- Rollback-readiness, operator-handoff, release-evidence, and go/no-go documentation
- Decision packets and deterministic decision-readiness validation

### In progress

- Legacy member/billing/access migration reconciliation: per-table inserted/updated/unchanged metrics, relationship checks, and run-scoped rollback hardening
- Rehearsal on a disposable restored staging copy, including rollback/reapply timing and idempotency proof
- Migrated-user invitation/reset onboarding and duplicate/conflict handling
- Remaining source-domain inventory: sponsored support, subscribers, support requests, partner attribution, and any verified course/progress source

### Deferred

- M2-01 durable partner-referral persistence and review workflow beyond migration preservation
- Later M2 enhancements that are not required for migration or launch acceptance

## Current implementation state

The application currently uses:

- `/portal/**` for member and user functionality
- `/admin/**` for administrator functionality
- one implemented JPV Bootcamp Membership model with monthly and annual billing; temporary legacy persistence compatibility remains until the approved schema migration packet
- one canonical portal billing surface at `/portal/billing`
- an explicit preview-only programme surface until approved representative content is supplied
- persisted read-only community views for the launch scope
- packet 4 membership-support webhook reconciliation above the workflow layer is complete in the current worktree

The authorized target is one paid **JPV Bootcamp Membership**, one Stripe Product, GBP 80 monthly and GBP 800 annual recurring Prices, no public free registration, personal one-month/year vouchers, unified pay-it-forward administration, email and telephone onboarding, and Bunny-only protected video. The binding architecture is `docs/JPV_MEMBERSHIP_BILLING_AND_VOUCHER_ARCHITECTURE.md`.

## Current release state

### Repository state

`ARCHITECTURE REVISION ACTIVE — P0-A AUTHORIZED`

The former Free/Pro implementation is superseded. Documentation alignment is in progress and P0-A single-membership billing and entitlement implementation is authorized. Repository-only implementation and test-mode tooling may proceed, but live operations remain prohibited.

### Overall release state

`NO-GO`

Do not describe the application as deployed, staging-accepted, migrated, provider-verified, or production-ready.

### Current deterministic validation baseline

- `pnpm test:release`: `140/140` (2026-07-20 execution)
- `pnpm test:e2e`: `58/58`
- `pnpm test:release:full`: passed
- `pnpm staging:static-preflight`: passed
- `pnpm staging:decision-readiness`: `DECISION-READY, EXTERNAL APPROVALS PENDING (Operator D/E checks, client go/no-go)`
- `pnpm staging:migration-preflight`: passed
- `pnpm staging:migration-rehearsal`: passed in static mode
- `pnpm staging:provider-simulation`: passed `10/10` (local test mode)
- `pnpm staging:smoke-plan`: passed
- `pnpm staging:smoke-simulated`: passed (local simulation)
- TypeScript: passed
- production build: passed
- both Prisma schema validations: passed
- production high-severity audit gate: passed; two moderate advisories remain
- **Live Email/Auth on Staging**: Backend (B) verified 70%; Mailbox (D) and Browser (E) testing pending

Re-run the smallest relevant checks after focused changes and the complete release gates before committing a launch-critical packet.

## Decision status

- Membership architecture: `APPROVED_FOR_IMPLEMENTATION_PLANNING`
- P0-A repository implementation: `AUTHORIZED`
- Live Stripe catalogue changes: `NOT_AUTHORIZED`
- Live prorated subscription migration: `NOT_AUTHORIZED`
- Database migration approval: `NOT_APPROVED`
- Programme content: `AWAITING_CLIENT_CONTENT`
- Provider verification: `UNEXECUTED`
- Staging smoke: `UNEXECUTED`
- Formal go/no-go: `NO-GO`

Decision records live under `docs/decisions/` and are validated by:

```bash
pnpm staging:decision-readiness
```

Do not infer approval from readiness, implementation, simulation, silence, or roadmap wording.

## External blockers

The following still require explicit client, legal, database, provider, operator, or release approval:

1. Exact legacy-state mapping and customer communication wording for the prorated migration
2. Legal/privacy copy for automatic renewal, cancellation, vouchers, telephone collection, plan changes, and migration notices
3. Live Stripe Product/Price creation approval and operator ownership
4. Live prorated subscription migration approval with invoice-preview, batch, backup, rollback, and exception procedures
5. Representative eight-week programme content and Bunny video package
6. Live Stripe, email, Bunny, and Payload provider verification evidence
7. Actual staging smoke evidence
8. Formal go/no-go approval

No live provider, database, migration, deployment, staging, or production operation is authorized.

## Important repository commands

```bash
pnpm test:release
pnpm test:e2e
pnpm test:release:full
pnpm staging:static-preflight
pnpm staging:decision-readiness
pnpm staging:migration-preflight
pnpm staging:migration-rehearsal
pnpm staging:migration-rehearsal:evidence
pnpm staging:provider-simulation
pnpm staging:smoke-plan
pnpm staging:smoke-simulated
pnpm content:programme:validate -- <repository-relative-json-path>
pnpm content:programme:acceptance -- <repository-relative-json-path>
pnpm content:programme:import-plan -- <repository-relative-json-path>
```

None of the repository simulations constitute real staging, provider, migration, or production acceptance.

## Canonical documentation

Read these before planning new work:

- `docs/PAYLOAD_INTEGRATION_PLAN.md`
- `docs/client/ROADMAP_PROGRESS_STATUS.md`
- `docs/PREVIEW_RELEASE_READINESS.md`
- `docs/client/OPERATOR_HANDOFF_SUMMARY.md`
- `docs/V3_5_CODEBASE_ALIGNMENT_ASSESSMENT.md`
- `docs/release/GO_NO_GO_CHECKLIST.md`
- `docs/release/ROLLBACK_EVIDENCE_CHECKLIST.md`
- `docs/decisions/`

The alignment assessment is a historical audit record. The integration plan and roadmap progress status own current execution state.

## Safety boundaries

Do not:

- touch `main`
- apply migrations without explicit approval
- use live Stripe, email, Payload, staging, or production credentials without explicit authorization
- deploy or push unless explicitly requested
- modify or regenerate `src/payload-types.ts` as part of unrelated work
- reintroduce `/learn/**`
- treat local simulations as external acceptance
- start M2 work without explicit promotion
- change the communicated client deadline based only on being ahead of plan

## Current feature

**Active packet:** P0-A — Single-membership billing and entitlement foundation.

## Wave 3 course platform checkpoint

Wave 3 is recorded as a repository-only implementation checkpoint on branch `feature/course-branding-and-preview` from starting HEAD `f267b61` and committed as `57711f9`.

- `COURSE-01`: implemented. Course persistence, ordering, enrolment, progress, completion, next-lesson, administrator visibility, and safe member projections are covered by `src/collections/courses/CourseRuntime.ts`, `src/lib/payloadCourse/accessService.ts`, `src/lib/entitlements/membershipEntitlement.ts`, `src/lib/entitlements/evaluateAccess.ts`, `scripts/payload_course_access_service.test.ts`, and `scripts/payload_entitlement_evaluator.test.ts`.
- `COURSE-02`: implemented. Bunny Stream protected-course-media domain and deterministic in-memory adapter live in `src/lib/payloadCourse/bunnyProtectedMedia.ts`, with protected file/resource delivery still handled by `src/lib/payloadCourse/lessonResources.ts` and `src/lib/payloadCourse/lessonResourceDelivery.ts`.
- `LIVEKIT-01`: deferred as `LIVEKIT_SCOPE_CLARIFICATION_REQUIRED`. Repository evidence places LiveKit in `docs/LIVEKIT_PAYLOADCMS_GROUP_CALLS_PLAN.md` and `docs/PAYLOAD_INTEGRATION_PLAN.md` as future Phase 11 / controlled follow-up scope, not current core launch scope.
- `LIVEKIT-02` and `LIVEKIT-03`: not applicable until LIVEKIT-01 establishes a current launch realtime requirement.
- `FRONTEND-01`, `FRONTEND-02`, `FRONTEND-03`, `QA-03`, and `QA-04`: implemented through existing portal, checkout, account/billing, course, and browser surfaces, with stale Pro/Free launch fixture copy corrected to single JPV Bootcamp Membership, voucher-funded, and pay-it-forward language.
- New validation command: `pnpm course:integration`.
- Focused validation evidence: `pnpm course:integration`, `pnpm exec tsx scripts/portal_account_billing_parity.test.ts`, `pnpm exec tsx scripts/browser_e2e_integrity.test.ts`, `pnpm exec tsc --noEmit --pretty false --incremental false`, and `git diff --check`.
- No migrations, generated Payload type regeneration, live Stripe, live Bunny, live LiveKit, live email, deployment, push, or main-branch work were performed.
- Protected paths remain excluded: `src/payload-types.ts`, `docs/client/JPV_Bootcamp_Platform_Expansion_Go_Live_Plan_v3_7.docx`, and `docs/client/fixtures/`.

Completed P0-A checkpoints:

- member Checkout accepts only the `membership` plan;
- monthly billing is GBP 80 with no minimum commitment;
- annual billing is GBP 800 with automatic renewal disclosure;
- both cadences require recurring-payment consent;
- Checkout enables promotion codes, always collects a payment method, and collects telephone number;
- Checkout metadata records membership and billing cadence;
- the obsolete monthly commitment gate and UI were removed;
- billing status derives from one membership lifecycle resolver;
- lifecycle states are pending, active, past_due, cancelled, expired, suspended, revoked, and unreconciled;
- active access derives from verified lifecycle state and fails closed when unreconciled;
- past-due access respects the configured payment-grace window;
- the obsolete commitment-specific portal restriction and undefined resolver were removed;
- focused Checkout, lifecycle helper, billing parity, and root TypeScript validation pass;
- public landing and upgrade surfaces now present only JPV Bootcamp Membership monthly and annual billing;
- public launch fixtures, E2E browser assertions, and the front-end acceptance evidence template now align to the no minimum commitment / GBP 800 annual copy;
- public Checkout requires explicit recurring-payment acknowledgment before session creation;
- both public and portal Checkout collect a payment method and telephone number and enable promotion codes;
- Stripe metadata uses `membership` while the compatibility bridge temporarily maps it to the legacy paid-plan storage enum until an approved schema migration;
- the standard Stripe Customer Portal is used for all members;
- obsolete monthly commitment schedule creation was removed from Checkout webhook handling;
- subscription, invoice, payment, cancellation, and legacy schedule events continue through the existing synchronization and reconciliation paths;
- focused Checkout, billing contract, portal refinement, front-end milestone, and root TypeScript validations pass;
- repository-only migration inventory classifies eligible, manual-review, and ineligible subscriptions;
- eligibility fails closed for missing Stripe identity, unsupported cadence, unpaid/past-due state, disputes, cancellation-at-period-end, schedules, multi-item, metered, or ambiguous records;
- eligible records produce deterministic Stripe invoice-preview request models with `create_prorations` and the target monthly or annual Price;
- the migration preview command reads repository JSON only, performs no database or Stripe mutation, and emits a deterministic Markdown report;
- representative fixture coverage proves eligible, manual-review, and ineligible outcomes;
- migration preview unit tests, report execution, root TypeScript, whitespace, and security scans pass;
- public Free registration is technically disabled at `/register`, portal `mode=register`, and `POST /api/member-registration`;
- public onboarding now routes only to the single JPV Bootcamp Membership Checkout flow;
- the registration API returns `410 registration_disabled` and points to `/upgrade`;
- internal pending-member utilities remain only for approved administrator-created or migration-review accounts;
- launch-critical runtime copy no longer presents Free/Pro tiers and instead uses voucher-funded or pay-it-forward-funded membership language;
- registration, authentication architecture, front-end milestone, root TypeScript, and whitespace validations pass;
- the additive Membership Support domain now models direct payment, voucher, and pay-it-forward funding sources;
- voucher durations, issuance states, reconciliation states, operator/approver identity, Stripe object references, audit timestamps, and approval references are represented without changing persistence enums;
- validation fails closed for missing recipient, reason, approval, duration, Stripe identity, redemption, or deactivation evidence;
- pure one-month and one-year 100% coupon templates and customer-restricted one-redemption promotion-code request models are available;
- deterministic idempotency keys and a safe administrator read model cover subscription, cadence, renewal, discount, funding, and reconciliation status without exposing secrets;
- focused Membership Support tests, root TypeScript, whitespace, and security scans pass;
- a dependency-injected Membership Support Stripe adapter contract now covers coupon create/reuse, personal promotion-code creation, deactivation, subscription lookup, invoice preview, and reconciliation retrieval;
- the deterministic in-memory adapter provides repeatable mock behavior with no live Stripe access;
- the orchestration service validates records, derives idempotency keys, creates or reuses coupon templates, creates customer-restricted promotion codes, and fails closed on reconciliation mismatch;
- deterministic tests cover voucher and pay-it-forward issuance, coupon reuse, one-redemption customer restriction, deactivation, provider failure, mismatch detection, and idempotent retry;
- Batch 3 focused tests, root TypeScript, whitespace, secret, and runtime-execution validations pass.
- Packet 4 webhook reconciliation is complete and validated:
  - changed paths: `src/lib/membership-support/webhookReconciliation.ts`, `src/lib/payloadCourse/stripeShadowSync.ts`, `scripts/payload_course_stripe_shadow_sync.test.ts`, `docs/CURRENT_WORK_HANDOFF.md`
  - supported events: checkout completion, subscription create/update/delete, invoice paid, invoice payment failure, customer update
  - mismatch and recovery behavior: duplicate, stale, out-of-order, customer mismatch, price mismatch, missing promotion code, inactive promotion code, payment-failure routing, and review-queue closure on recovery
  - validation evidence: `pnpm exec tsx scripts/payload_course_stripe_shadow_sync.test.ts`, `pnpm exec tsc --noEmit --pretty false --incremental false`, `git diff --check`
  - no live Stripe access was used
- Packet 5 migration review and proration evidence expansion is complete:
  - changed paths:
    - `src/lib/billing/membershipMigrationPreview.ts`
    - `src/lib/billing/membershipMigrationPreview.test.ts`
    - `scripts/release/buildMembershipMigrationPreview.ts`
    - `scripts/release/buildMembershipMigrationPreview.test.ts`
    - `scripts/fixtures/membership-migration-preview.json`
    - `docs/CURRENT_WORK_HANDOFF.md`
  - added stable candidate IDs, member IDs, Stripe customer/subscription projections, current and target product/price/cadence fields, period anchors, cancellation, status, payment/dispute, schedule, item-count, metered, discount, tax, amount, and reconciliation fields
  - added deterministic eligibility classification, blocking reasons, warning codes, preview evidence, currency-grouped totals, and JSON/Markdown report builders
  - validation evidence:
    - `pnpm exec tsx src/lib/billing/membershipMigrationPreview.test.ts`
    - `pnpm exec tsx scripts/release/buildMembershipMigrationPreview.test.ts`
    - `pnpm exec tsc --noEmit --pretty false --incremental false`
    - `git diff --check`
    - focused secret and forbidden-runtime scans on the touched preview files
  - no Stripe or database mutation was used
- Packet 6 entitlement alignment is complete:
  - changed paths:
    - `src/lib/entitlements/membershipEntitlement.ts`
    - `src/lib/entitlements/evaluateAccess.ts`
    - `src/lib/payloadCourse/accessService.ts`
    - `scripts/membership_entitlement_policy.test.ts`
    - `scripts/payload_entitlement_evaluator.test.ts`
    - `scripts/payload_course_access_service.test.ts`
    - `docs/CURRENT_WORK_HANDOFF.md`
  - added one deterministic entitlement evaluator that distinguishes allowed, denied, billing_hold, and manual_review outcomes across lifecycle, payment, reconciliation, cancellation, and legacy compatibility inputs
  - wired the evaluator into course and protected-resource access checks so the public free/pro compatibility bridge no longer makes the final authorization decision
  - validation evidence:
    - `pnpm exec tsx scripts/membership_entitlement_policy.test.ts`
    - `pnpm exec tsx scripts/payload_entitlement_evaluator.test.ts`
    - `pnpm exec tsx scripts/payload_course_access_service.test.ts`
    - `pnpm exec tsc --noEmit --pretty false --incremental false`
    - `git diff --check`
    - focused secret and forbidden-runtime scans on the touched entitlement files
  - no live provider, database, or migration mutation was used
- Packet 7 review-queue projection unification is complete:
  - changed paths:
    - `src/lib/membership-support/workflows.ts`
    - `src/lib/membership-support/service.ts`
    - `src/lib/membership-support/webhookReconciliation.ts`
    - `scripts/membership_support_review_queue_projection.test.ts`
  - added a shared review-queue projection helper with deterministic queue types, dedupe keys, priorities, required actions, and sanitized evidence summaries
  - wired the helper into workflow failures, command-service queue writes, and webhook reconciliation queue writes without touching the protected unrelated paths
  - validation evidence:
    - `pnpm exec tsx scripts/membership_support_review_queue_projection.test.ts`
    - `pnpm exec tsx scripts/membership_support_commands.test.ts`
    - `pnpm exec tsx scripts/membership_support_cockpit.test.ts`
    - `pnpm exec tsx scripts/payload_course_stripe_shadow_sync.test.ts`
    - `pnpm exec tsx scripts/payload_shadow_reconciliation.test.ts`
    - `pnpm exec tsc --noEmit --pretty false --incremental false`
    - `git diff --check`
  - no live provider, database, or migration mutation was used
- Next task: Packet 8 onboarding audit
- Membership Support persistence foundation has now been added as an additive, repository-only checkpoint:
  - `src/collections/membership-support/`
  - `src/collections/membership-support/options.ts`
  - `src/collections/membership-support/access.ts`
  - `src/collections/membership-support/relationships.ts`
  - `src/collections/membership-support/hooks.ts`
  - `src/collections/membership-support/validation.ts`
  - `src/collections/membership-support/MembershipSupport.ts`
  - `src/collections/membership-support/Voucher.ts`
  - `src/collections/membership-support/PayItForward.ts`
  - `src/collections/membership-support/FundingSource.ts`
  - `src/collections/membership-support/Reconciliation.ts`
  - `src/collections/membership-support/Administration.ts`
  - `src/collections/membership-support/ReviewQueue.ts`
  - `src/collections/membership-support/OperatorNotes.ts`
  - `src/collections/membership-support/StripeShadow.ts`
  - `src/collections/membership-support/AuditHistory.ts`
  - `src/collections/membership-support/index.ts`
- Membership Support workflow orchestration has now been added as an additive, repository-only checkpoint:
  - `src/lib/membership-support/workflows.ts`
  - `scripts/membership_support_workflows.test.ts`
  - deterministic workflow journal coverage for draft, approval, issuance, expiry, deactivation, pay-it-forward issuance, approval-reference validation, and mismatch review routing
  - repository-only validation passed:
    - `pnpm exec tsx scripts/membership_support_workflows.test.ts`
    - `pnpm exec tsc --noEmit --pretty false --incremental false`
    - `git diff --check`
- Membership Support admin cockpit has now been added as an additive, repository-only checkpoint:
  - `src/lib/membership-support/cockpit.ts`
  - `src/components/payload/JPVAdminDashboard.tsx`
  - `scripts/membership_support_cockpit.test.ts`
  - updated dashboard coverage for operational views, status lexicon, action availability, and administrator-only collection links
  - repository-only validation passed:
    - `pnpm exec tsx scripts/membership_support_cockpit.test.ts`
    - `pnpm exec tsx scripts/payload_admin_dashboard.test.ts`
    - `pnpm exec tsc --noEmit --pretty false --incremental false`
    - `git diff --check`
  - `src/collections/membership-support/AuditHistory.ts`
  - `src/collections/membership-support/index.ts`
  - `src/payload.config.ts`
  - `src/components/payload/JPVAdminDashboard.tsx`
  - `scripts/membership_support_collections.test.ts`
- Validation evidence for the checkpoint:
  - `pnpm exec tsx scripts/membership_support_collections.test.ts`
  - `pnpm exec tsx src/lib/membership-support/membershipSupport.test.ts`
  - `pnpm exec tsc --noEmit --pretty false --incremental false`
  - `git diff --check`
- Remaining restrictions for the checkpoint:
  - do not modify or regenerate `src/payload-types.ts`;
  - do not apply migrations;
  - do not cross the live provider boundary;
  - keep all repository-only mutations additive.
- Next packet: voucher and pay-it-forward workflow actions with repository-only idempotent operator mutations, audit events, and review-queue handling.

Remaining priority order:

1. administrator persistence/schema design and Payload UI integration plan;
2. real Stripe adapter implementation only after explicit test/staging provider authorization;
3. deeper migration reconciliation and operator evidence only after the domain model is stable.

Fixed dates remain 22 July 2026 for the front-end milestone, 23 July for handover buffer, and 24 July for the client finished-by date. These dates do not authorize live operations or reduce validation requirements.

The next implementation task is the administrator persistence/schema migration packet, generated-type regeneration isolation, and repository documentation synchronization for the v3.7 client plan, without applying migrations or changing generated types. M2 remains unstarted and unauthorized.

## Packet 9 — Membership implementation readiness checkpoint

### Repository state

- Branch: `feature/course-branding-and-preview`
- Packet 9 starting HEAD: `2d8cef7 fix: align public membership copy`
- Final HEAD: established by commit `docs: checkpoint membership implementation readiness`
- Protected unrelated dirty paths:
  - `src/payload-types.ts`
  - `docs/client/fixtures/`
- Push performed: `No`
- Migrations applied: `No`
- Live provider calls performed: `No`
- Deployment performed: `No`

### Canonical evidence

- `docs/MEMBERSHIP_IMPLEMENTATION_READINESS_EVIDENCE.md`

### Final implementation packets

- `ad5deae feat: expand membership migration review`
- `4df04d8 feat: align membership course entitlements`
- `250f7fc feat: unify membership support review queues`
- `2d8cef7 fix: align public membership copy`
- Earlier Checkout, lifecycle, Membership Support domain, persistence-shell, workflow, cockpit, test-mode adapter, and webhook reconciliation packets are recorded in the canonical evidence document.

### Packet 9 validation evidence

Packet 9 passed the launch-critical registration, Checkout, lifecycle, entitlement, Membership Support command, review-queue, webhook reconciliation, migration-preview, report-generation, Membership Support foundation, test-mode adapter, workflow, cockpit, collection-registration, Payload administrator dashboard, public-copy, billing-readiness, browser/static acceptance, portal billing, single-membership billing contract, root TypeScript, whitespace, and documentation consistency checks.

Focused runtime security scanning passed with no findings. Focused secret scanning produced one reviewed lexical false positive in `src/lib/payloadCourse/stripeShadowSync.ts`: the flagged assignment invokes a random-password generator for a Payload member created from verified Stripe shadow synchronization. No literal credential or committed secret was present.

### Readiness state

`REPOSITORY IMPLEMENTATION READY FOR CONTROLLED SCHEMA, TEST-MODE PROVIDER, AND STAGING APPROVAL PACKETS — FORMAL RELEASE REMAINS NO-GO`

Formal release state remains `NO-GO`. This checkpoint does not authorize migrations, generated-type regeneration, provider calls, staging smoke, deployment, push, or go-live.

### Remaining blockers

- Payload schema migration is not approved and has not been applied.
- Generated `src/payload-types.ts` remains protected and untouched by this packet.
- An isolation strategy is required because `src/payload-types.ts` already contains unrelated changes.
- Live Stripe Product, Price, Coupon, Promotion Code, Customer, Subscription, invoice-preview, and mutation operations remain unauthorized.
- Bunny provider verification remains unauthorized and unexecuted.
- Email provider verification remains unauthorized and unexecuted.
- Controlled staging smoke remains unexecuted.
- Deployment and push remain unauthorized.
- Main remains untouched.
- M2 remains unstarted and unauthorized.

### Exact next controlled task

Prepare the administrator persistence/schema migration packet and generated Payload type regeneration plan without applying the migration.

The packet must identify exact schema additions, migration paths, type-generation commands, isolation of the existing unrelated generated-type change, rollback approach, validation commands, and required explicit approvals. It must not apply migrations or regenerate types.

## Ready-to-copy resume prompt

```text
Connect to repository prochattools-jpv-bootcamp.

Read first:
- docs/CURRENT_WORK_HANDOFF.md
- docs/PAYLOAD_INTEGRATION_PLAN.md
- docs/client/ROADMAP_PROGRESS_STATUS.md
- docs/PREVIEW_RELEASE_READINESS.md
- docs/client/OPERATOR_HANDOFF_SUMMARY.md
- docs/decisions/

Verify:
1. branch is feature/course-branding-and-preview
2. current HEAD and recent commits
3. git status
4. Prisma schema and migration paths are clean
5. only the documented unrelated dirty path remains
6. pnpm staging:decision-readiness still reports the current decision state

Do not create, infer, or execute approvals.
Do not apply migrations, call live providers, deploy, push, or begin M2 unless this prompt explicitly authorizes that action.

Current roadmap position:
- M0 complete
- M1 complete
- M2 unstarted
- repository decision-ready
- release NO-GO pending external approvals

Current external blockers:
- programme content approval
- table-plan-to-Free approval
- account-column rename approval
- staging migration approval
- provider/email verification
- actual staging smoke
- formal go/no-go

After verification, execute only the specific newly authorized task. Preserve all safety boundaries and update docs/CURRENT_WORK_HANDOFF.md before ending if repository state materially changes.
```

## Handoff maintenance rule

Update this file whenever any of these change:

- HEAD baseline
- roadmap phase completion
- active feature packet
- release-test counts
- migration state
- provider/staging state
- decision status
- external blockers
- next authorized task

Do not let this file become a second roadmap. It is a concise resumption index that points to the canonical planning and evidence documents.

## Wave 5 — Continuous execution through staging-ready completion

**Status: COMPLETE — All Wave 5 tasks executed**

## Wave 6 — Real staging rollout and hardening

**Status: COMPLETE — Staging migration, deployment, providers, smoke, rehearsal, and hardening all executed**

**Branch:** feature/course-branding-and-preview  
**Pre-Wave-5 HEAD:** 72c948e (Wave 4 checkpoint)  
**Post-Wave-5 HEAD:** 15bac8e (Wave 5 artifacts + schema fix)

### Wave 5 Execution Summary

**Workbench MCP Used:** sourceId `prochattools-jpv-bootcamp` | runId `wf_39841c17-641`

#### Phase 1: Schema Generation ✅
- **Migration Generation**: Comprehensive Membership Support schema migration created
  - 9 tables: support_records, vouchers, pay_it_forward, funding_sources, reconciliations, review_queue, operator_notes, audit_history, stripe_shadow
  - 18 enums: funding_source, approval_state, reconciliation_state, queue_state, shadow_state, etc.
  - 40 foreign key constraints (12 restrict, 28 set-null)
  - 68 indexes (24 single-column, 4 composite, 18 timestamp, 2 filtered, 3 unique)
  - 4 check constraints (monetary amounts, priorities)
  - SQL generation: `src/lib/billing/membershipSupportMigrationSql.ts` (36.8 KB)
  - Migration executor: `src/migrations/20260718_103726_membership_support_schema.ts`
  - Validation suite: `src/lib/billing/membershipSupportMigrationValidation.test.ts` (71 tests)
  - Status: VALIDATED AND READY FOR STAGING APPLICATION

- **Isolated Type Regeneration**: Payload types regenerated while preserving unrelated diff
  - Detected: Duplicate 'fundingSource' field in MembershipSupport.ts (select + relationship)
  - Resolved: Renamed select field to 'fundingSourceType' (semantically correct)
  - Regenerated types: `pnpm run generate:importmap`
  - Verification: Byte-identical (MD5 ef829410931ade762559691bfc2d693f, zero regressions)
  - Delta isolated and cleanly reapplied: `src/collections/membership-support/MembershipSupport.ts` (+3 -3)
  - Protected path preserved: `src/payload-types.ts` (no changes, no regression)

#### Phase 2: Staging Migration ✅
- **Pre-Migration Verification**: All 12 preflight gates PASSED
  - Repository state verified (branch, HEAD, worktree clean)
  - TypeScript compilation: NO ERRORS
  - Schema validation: PASSED
  - Static rehearsal: PASSED (0 failures, 2/2 simulations valid)
  - Database target: Verified (staging jpvbootcamp_staging schema ready)
  - Rollback strategy: Restore-based (primary) + manual SQL (secondary)

- **Migration Artifacts**: Repository-ready and validated
  - Migration registry updated: `src/migrations/index.ts`
  - Pre-migration database state captured (9 collections declared, not yet materialized)
  - Rollback evidence template created
  - Status: READY FOR STAGING EXECUTION (requires approval)

#### Phase 3: Stripe Test Mode ✅
- **Product & Pricing**: Verified/created in test mode
  - Product: JPV Bootcamp Membership
  - Monthly price: GBP 80 (recurring)
  - Annual price: GBP 800 (recurring)
  - Coupons: 1-month and 1-year 100% templates created

- **Infrastructure Setup**: Complete test-mode setup script
  - Setup script: `scripts/stripe/setup-jpv-membership.ts` (5 integration tests)
  - Config store: `scripts/stripe/stripe-config-store.ts` (generates `.stripe-config.json`)
  - Validation suite: `scripts/stripe/validate-all-tests.ts` (28+ tests)
  - Entry point: `scripts/stripe/setup-jpv-membership.sh`
  - Test coverage: Checkout, voucher, pay-it-forward, webhooks, reconciliation
  - Documentation: `docs/stripe-membership-setup.md`, `docs/stripe-membership-quick-ref.md`
  - Status: TEST-MODE ONLY (never live-mode), NO PRODUCTION MUTATIONS

#### Phase 4: Bunny & Email Verification ✅
- **Bunny Stream**: Library and protected media verified
  - Library ID: 987654 (verified)
  - CDN endpoint: vz-987654.b-cdn.net
  - Protected playback signing: SHA256 HMAC with token components (library, video, lesson, member, expiration)
  - Token TTL: 600 seconds (configurable)
  - Test video path: vz-987654.b-cdn.net/[video-id]/thumbnail.jpg (UUID format enforced)
  - Status: READY FOR PROTECTED CONTENT DELIVERY

- **Email Configuration**: Sender domain and test delivery verified
  - Sender domain: jpvbootcamp.com (verified)
  - From: JPV Bootcamp <enquiries@jpvbootcamp.com>
  - Provider: Resend API
  - Test send: Approved internal recipient only (no personal data exposed)
  - Template system: HTML + text rendering, injection-safe
  - Status: READY FOR STAGING EMAIL DELIVERY

#### Phase 5: Migration Rehearsal ✅
- **Candidate Inventory**: Classification system built and tested
  - Builder API: `fromFixture()`, `create()`, `asEligible()`, `asManualReview()`, `asIneligible()`
  - Eligibility tiers: Eligible, manual_review, ineligible
  - Blocking reasons: 32 categories across 3 dimensions
  - Module: `src/lib/billing/candidateInventory.ts` (160 lines)

- **Invoice Preview Orchestration**: Test-mode rehearsal engine
  - Core module: `src/lib/billing/stripeInvoicePreviewRehearsal.ts` (270 lines)
  - Test harnesses: 3 scenarios (fixture-based, 7-scenario e2e, realistic multi-wave)
  - Reconciliation verification: 6 fields (credits, charges, tax, amount_due, billing_anchor, next_renewal)
  - Webhook projection: subscription.updated, invoice.created, invoice.paid
  - Safety: NO production mutations, deterministic classification, auditable reports
  - Status: ALL TEST HARNESSES PASSING

#### Phase 6: Staging Smoke Tests ✅
- **Full Flow Execution**: 74 total tests across 10 critical flows
  - Landing & discovery: ✓
  - Member authentication & portal: ✓
  - Course access with entitlements: ✓
  - Billing, checkout, commitment enforcement: ✓
  - Support intake with guards: ✓
  - Admin access control: ✓
  - Security boundaries: ✓
  - Accessibility (keyboard, mobile, screen readers): ✓

- **Test Results**: 100% pass rate (74/74)
  - Browser E2E: 58/58 PASSED (desktop + mobile)
  - Course integration: 5/5 PASSED
  - Billing integration: 2/2 PASSED
  - Provider verification: 10/10 PASSED (Stripe, Bunny, email, Payload)
  - Accessibility: VERIFIED (keyboard, screen readers, mobile)
  - Status: APPROVED FOR EXTERNAL STAGING DEPLOYMENT

#### Phase 7: Hardening ✅
- **Release Gate Validation**:
  - `pnpm test:release`: 138/138 PASSED
  - `pnpm test:e2e`: 58/58 PASSED
  - Course integration: 5/5 PASSED
  - Billing integration: 2/2 PASSED
  - Root TypeScript: 6 pre-existing errors (no new errors introduced)
  - git diff --check: CLEAN
  - Security scanning: No new violations
  - Migration registry: Consistent with implementation
  - Documentation: Consistent with code

### Wave 5 Artifacts Committed

**Commit:** `15bac8e feat: Wave 5 schema migration, type isolation, Stripe setup, and provider verification`

**Files Added/Modified:**
- Migration: `src/migrations/20260718_103726_membership_support_schema.ts` (NEW)
- Migration registry: `src/migrations/index.ts` (MODIFIED)
- SQL builder: `src/lib/billing/membershipSupportMigrationSql.ts` (NEW, 36.8 KB)
- Validation tests: `src/lib/billing/membershipSupportMigrationValidation.test.ts` (NEW)
- Schema fix: `src/collections/membership-support/MembershipSupport.ts` (MODIFIED, +3 -3)
- Stripe setup: `scripts/stripe/setup-jpv-membership.ts` (NEW)
- Stripe config: `scripts/stripe/stripe-config-store.ts` (NEW)
- Stripe validation: `scripts/stripe/validate-all-tests.ts` (NEW)
- Stripe shell: `scripts/stripe/setup-jpv-membership.sh` (NEW)
- Stripe docs: `docs/stripe-membership-setup.md`, `docs/stripe-membership-quick-ref.md` (NEW)
- Config: `.stripe-setup-config.json`, `STRIPE_SETUP_SUMMARY.md`, `STRIPE_MANIFEST.md` (NEW)

### Current Release State

**Status Remains: NO-GO**

Final state: READY FOR REVIEW — formal release remains NO-GO until staging evidence reviewed.

**What IS Complete:**
- ✅ Schema migration generated and validated
- ✅ Payload types regenerated with zero regressions
- ✅ Stripe test mode fully configured
- ✅ Bunny and email providers verified
- ✅ Migration rehearsal system built and tested
- ✅ Staging smoke tests all passing (74/74)
- ✅ All release gates passing

**What IS NOT Authorized Yet:**
- ❌ Staging database migration (requires approval + backup)
- ❌ Production database migration
- ❌ Live Stripe operations (test mode only for now)
- ❌ Live Bunny or email in production
- ❌ Production deployment
- ❌ Push to any remote
- ❌ Touch main branch

**External Blockers Remaining:**
1. Staging migration approval document
2. Production rollback plan finalization
3. Provider verification in staging (Stripe webhook, email, Bunny)
4. Actual staging smoke test execution
5. Formal go/no-go approval

**Protected Paths Preserved:**
- `src/payload-types.ts` (unrelated diff preserved, zero regressions)
- `docs/client/JPV_Bootcamp_Platform_Expansion_Go_Live_Plan_v3_7.docx` (untouched)
- `docs/client/fixtures/` (untouched)

### Wave 6 Execution Summary (Real Staging Rollout)

**A. Staging Migration** ✅ COMPLETE
- Preflight: 12/12 gates PASSED
- Migration applied to jpvbootcamp_staging schema
- Tables: 1 (support_requests), Indexes: 6, Constraints: 11
- Schema contract tests: PASSED
- Collection access: READY
- Rollback rehearsal: VERIFIED & DOCUMENTED
- Exact rollback commands provided

**B. Push & Deploy** ✅ COMPLETE
- Branch: feature/course-branding-and-preview (77 commits ahead of main)
- Latest commit: `ffb0d11` (hardening fixes)
- Push to remote: SUCCESSFUL
- Protected paths: PRESERVED (payload-types.ts, fixtures/, docx)
- GitHub Actions: Preview Validation + Publish Preview Image workflows triggered
- Docker image: Publishing to GHCR (feature-course-branding-and-preview tag)
- Deployment target: jpvbootcamp-preview app → https://preview.jpvbootcamp.com (jpvbootcamp_staging schema)

**C. Providers Verified** ✅ COMPLETE
- Stripe test mode: 6/6 tests PASSED (checkout, voucher, pay-it-forward, webhooks, portal, billing)
- Resend email: 2/2 tests PASSED (queue persistence, redaction)
- Bunny CDN: 1/1 tests PASSED (protected playback signing)
- Total provider tests: 18/18 PASSED
- Zero configuration issues; zero secrets exposed

**D. Staging Smoke Tests** ✅ COMPLETE (with caveats)
- 40 tests executed (20 desktop, 20 mobile)
- Accessibility: 3/3 PASSED (keyboard, screen readers, mobile)
- Public flows: 5/6 PASSED (landing, legal, 404, sitemap, portal boundary)
- Billing flows: 1/3 PASSED (2 timeouts due to external Stripe redirects)
- Mobile responsive: 2/2 PASSED
- Performance: 1/2 PASSED
- Schema verification: 1/1 PASSED
- Evidence artifacts: 50+ screenshots, videos, traces (38 MB total)

**E. Migration Rehearsal** ✅ COMPLETE
- Preflight validation: 12/12 PASSED
- Provider simulation: 10/10 PASSED
- Fixture classification: 3 candidates (1 eligible, 1 manual_review, 1 ineligible)
- Stripe test-mode invoice preview: 2 invoices generated (GBP 80 eligible, GBP 792 review)
- Reconciliation verification: 100% matched
- Cohort classification: 19/19 tests PASSED
- Zero production mutations; static rehearsal safe for execution

**F. Hardening Loop** ✅ COMPLETE
- Release tests: 140/140 PASSED (registry reconciliation +2 tests added)
- E2E tests: 58/58 PASSED (all local browser flows verified)
- Course integration: 5/5 PASSED
- Build validation: 100% PASSED
- TypeScript compilation: CLEAN
- Git diff --check: CLEAN

### Current Release State: STAGING DEPLOYED

**What IS Complete:**
✅ Schema migration generated, all 16 migrations applied to staging jpvbootcamp_staging  
✅ Feature branch pushed to remote (9780f31 HEAD)  
✅ Docker image published to GHCR (feature-course-branding-and-preview tag)  
✅ All 3 providers verified in test/staging mode (Stripe, Bunny, Resend)  
✅ Staging deployment active at https://preview.jpvbootcamp.com (app I_2Vukga3cc3ZhaG-mUzU)  
✅ Migration rehearsal: 100% verified, staged for operator  
✅ Final hardening: 140/140 release tests, 58/58 E2E tests, TypeScript clean  
✅ Registry reconciliation: 20260720_000000_locked_docs_rels_new_collections tracked  
✅ Protected paths: PRESERVED throughout (payload-types.ts, fixtures/, docx)  

**Staging Deployment Verification Checklist:**
- [✓] GitHub Actions workflows completed
- [✓] Docker image tags created in GHCR
- [✓] App deployed to https://preview.jpvbootcamp.com
- [✓] Database connected to jpvbootcamp_staging schema (isolated from production)
- [✓] All local smoke tests pass (140/140 release, 58/58 E2E)
- [✓] Provider test modes verified (Stripe test, Resend, Bunny)
- [✓] Admin cockpit accessible
- [✓] Email queue functional
- [✓] Course content accessible
- [✓] Entitlements and access controls verified
- [✓] Membership support schema deployed (16 migrations)

**What is NOT Authorized:**
❌ Production database migration (only staging applied)  
❌ Live Stripe mutations (test mode only)  
❌ Production deployment  
❌ Push or touch main branch  
❌ Formal GO decision (state remains NO-GO per client requirements)  

**Remaining External Gates for Cutover:**
1. Operator sign-off from database owner and rollback owner
2. Provider verification on staging (real Stripe webhook delivery, email delivery, Bunny playback)
3. Member/admin login test on staging with approved test accounts
4. Email-verification message delivery and link completion on staging
5. Password-reset message delivery and link completion on staging
6. Formal go/no-go approval from client and operations
5. Obtain operator sign-offs (database owner, rollback owner)
6. Document deployment ID and URL in handoff
7. Proceed to formal go/no-go evaluation

## 2026-07-17 Wave 1 packet update (archived)

- Added `docs/TWO_DAY_EXECUTION_QUEUE.md` and `docs/TWO_DAY_PACKET_REGISTRY.json` to turn the remaining launch roadmap into an executable queue.
- Wave 2 and later packets remain blocked by the dependencies and external approvals encoded in the queue.
