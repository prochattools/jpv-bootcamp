# Current Work Handoff

Use this document as the canonical starting point for a new Codex or Workbench conversation.

## Repository identity

- Repository: `prochattools-jpv-bootcamp`
- Branch: `feature/course-branding-and-preview`
- Current HEAD: `3cca73a feat: build membership support admin cockpit`
- Pull request: `https://github.com/prochattools/jpv-bootcamp/pull/2`
- Migrations applied: `No`
- Deployment performed: `No`
- Push performed by the recent execution packets: `No`
- Known unrelated dirty path: `src/payload-types.ts`

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
- an implemented Free/Pro product model that is now superseded and must be refactored before release
- one canonical portal billing surface at `/portal/billing`
- an explicit preview-only programme surface until approved representative content is supplied
- persisted read-only community views for the launch scope
- packet 3 membership-support command orchestration above the workflow layer is under validation in the current worktree

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

The next implementation task is the administrator persistence/schema design and Payload UI integration plan, without applying migrations or changing generated types. M2 remains unstarted and unauthorized.

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
