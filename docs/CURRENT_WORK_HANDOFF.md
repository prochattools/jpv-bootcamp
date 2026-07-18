# Current Work Handoff

Use this document as the canonical starting point for a new Codex or Workbench conversation.

## Repository identity

- Repository: `prochattools-jpv-bootcamp`
- Branch: `feature/course-branding-and-preview`
- Wave 3 checkpoint HEAD: `57711f9 feat: complete wave 3 course platform`
- Packet 9 checkpoint HEAD: `8927df9 docs: checkpoint membership implementation readiness`
- Current HEAD after Wave 4: `ed461a6` (TypeScript fixes + registry update)
- Pull request: `https://github.com/prochattools/jpv-bootcamp/pull/2`
- Migrations applied: `No`
- Deployment performed: `No`
- Push performed by the recent execution packets: `No`
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

- All 138 release tests passing (138/138)
- TypeScript: Clean
- Browser E2E: 58/58 passing
- Release test suite: FULL PASS

### Wave 4 validation

- `pnpm test:release`: **138/138 PASS**
- `pnpm test:e2e`: **58/58 PASS**
- `pnpm test:release:full`: **PASS**
- `pnpm exec tsc --noEmit --pretty false --incremental false`: **CLEAN**
- `git diff --check`: **CLEAN**

### Packet registry updates
- PAYLOAD-02: marked as implemented (cockpit tests pass)
- All "blocked" packets verified to have passing validation commands
- Registry now accurate reflecting actual codebase state

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

### Not started

- M2-01 durable partner-referral persistence and review workflow
- All later M2 work

M2-01 remains post-core unless it is explicitly promoted in the task that implements it.

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

- `pnpm test:release`: `138/138`
- `pnpm test:e2e`: `58/58`
- `pnpm test:release:full`: passed
- `pnpm staging:static-preflight`: passed
- `pnpm staging:decision-readiness`: `DECISION-READY, EXTERNAL APPROVALS PENDING`
- `pnpm staging:migration-preflight`: passed
- `pnpm staging:migration-rehearsal`: passed in static mode
- `pnpm staging:provider-simulation`: passed `10/10`
- `pnpm staging:smoke-plan`: passed
- `pnpm staging:smoke-simulated`: passed `5/5`
- TypeScript: passed
- production build: passed
- both Prisma schema validations: passed
- production high-severity audit gate: passed; two moderate advisories remain

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

## 2026-07-17 Wave 1 packet update

- Added `docs/TWO_DAY_EXECUTION_QUEUE.md` and `docs/TWO_DAY_PACKET_REGISTRY.json` to turn the remaining launch roadmap into an executable queue.
- Implemented and validated the Wave 1 repository tooling for `SCHEMA-01`, `SCHEMA-02`, `SCHEMA-03`, `QA-01`, and `RELEASE-01`.
- Added `scripts/membership_support_schema_contract.test.ts`, `scripts/release/launchCriticalTestManifest.ts`, `scripts/release/launchCriticalTestManifest.test.ts`, `scripts/release/twoDayPacketRegistry.ts`, `scripts/release/twoDayPacketRegistry.test.ts`, `scripts/release/membershipSupportSchemaIsolation.ts`, and `scripts/release/membershipSupportSchemaIsolation.test.ts`.
- Added package scripts for the new manifest, registry, schema-isolation, and schema-contract validations.
- Validation passed:
  - `pnpm exec tsx scripts/membership_support_schema_contract.test.ts`
  - `pnpm exec tsx scripts/release/launchCriticalTestManifest.test.ts`
  - `pnpm exec tsx scripts/release/twoDayPacketRegistry.test.ts`
  - `pnpm exec tsx scripts/release/membershipSupportSchemaIsolation.test.ts`
  - `pnpm exec tsc --noEmit --pretty false --incremental false`
  - `git diff --check`
- Wave 2 and later packets remain blocked by the dependencies and external approvals encoded in the queue.
