# Current Work Handoff

Use this document as the canonical starting point for a new Codex or Workbench conversation.

## Repository identity

- Repository: `prochattools-jpv-bootcamp`
- Branch: `feature/course-branding-and-preview`
- Current HEAD: `973a651 docs: align go-no-go decision flow`
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
- Free and Pro as the active product model in the new application
- one canonical portal billing surface at `/portal/billing`
- an explicit preview-only programme surface until approved representative content is supplied
- persisted read-only community views for the launch scope

The repository is ready to accept a representative eight-week programme package but must not publish one until the content contract, validation, approval evidence, and publication authorization all pass.

## Current release state

### Repository state

`DECISION-READY, EXTERNAL APPROVALS PENDING`

The repository-owned implementation, validation, rehearsal planning, simulation, rollback planning, and decision preparation are complete.

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

- Table-plan-to-Free: `AWAITING_APPROVAL`
- Account-column rename: `AWAITING_APPROVAL`
- Staging migration approval: `NOT_APPROVED`
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

The following require explicit client, business, database, provider, operator, or release approval:

1. Representative eight-week programme content package and publication approval
2. Table-plan-to-Free business decision
3. Account-column rename/database decision
4. Staging migration approval with exact path, owners, backup, and rollback authorization
5. Live provider and email verification evidence
6. Actual staging smoke evidence
7. Formal go/no-go approval

The support-request migration remains unapplied.

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

There is no active uncommitted feature packet at this handoff point.

The core M0/M1 implementation is complete. Work is currently paused at the external-approval boundary. The next task depends on what is explicitly authorized:

1. If new approval evidence is supplied, ingest and validate that evidence, then prepare or execute only the approved packet.
2. If M2-01 is explicitly promoted, implement the durable partner-referral persistence and review workflow as a post-core packet.
3. If controlled staging operations are explicitly authorized, follow the repository runbooks and decision records exactly; do not combine migration, provider verification, staging smoke, deployment, or go/no-go into one implicit approval.

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
