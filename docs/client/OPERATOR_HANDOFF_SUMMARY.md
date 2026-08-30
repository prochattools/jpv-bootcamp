# Operator Handoff Summary

## Current repository reconciliation — 2026-08-23

- **Working branch:** `feature/course-branding-and-preview`; frozen staging release candidate and deployed SHA are `9d87c4a3eeeffb9afb78a38964054792330ea1cb`.
- **Cleanup record:** `docs/release/BRANCH_RECONCILIATION_2026-08-23.md`.
- **Release gate:** push validation run `32647651167` succeeded with the 164/164 release gate; explicit staging deployment run `32648229013` succeeded for this exact SHA.
- **Current staging:** `/api/health` returned 200 and reported the exact candidate SHA, `deploymentEnv=staging`, and live status. Read-only migration plan run `32648793013` returned 36/36, pending `[]`, Prisma healthy, and no malformed/duplicate/unexpected records.
- **Migrations applied:** `36/36 Payload migrations applied`; pending migrations: `[]` (read-only plan run `32648793013`).
- **Operational boundary:** no production operation or migration execution occurred. The only external mutation was the authorized staging deployment of this candidate.
- **Handoff order:** preserve this evidence as the frozen staging checkpoint. Phase 10 requires separate explicit production authorization.
- **Phase 9.5 authority:** use `docs/release/PHASE_9_5_CURRENT_TRUTH_2026-08-23.md` for current truth and `docs/release/PHASE_9_5_FINAL_IMPLEMENTATION_BACKLOG_2026-08-23.md` for remaining work.
- **Rooms feature candidate — 2026-08-30:** isolated branch `feature/member-portal-rooms`. Deterministic release gate: `pnpm test:release` (`178/178`). This is local/CI validation only and does not constitute staging or production evidence.

<!-- Reconciliation note 2026-08-08: Verify the exact feature tip with `git rev-parse HEAD`. The release manifest contains 164 required gates. The live staging baseline remains `9c045fa5a5c327014c20fe9377f7d5368b550573`; guarded read-only plan run `31215369413` established the clean pre-apply state at reviewed code checkpoint `9e068cc8b0a5ec9573732fee3a78bed9995787a6`. -->

## Historical staging handoff — 2026-08-08 (AUDIT RECORD ONLY)

**Status:** **LAUNCH-SCOPE REPOSITORY IMPLEMENTATION COMPLETE — FINAL PRE-MIGRATION CLOSURE IN PROGRESS**

- **Only permitted branch:** `feature/course-branding-and-preview`.
- **Only permitted staging target:** origin `https://preview.jpvbootcamp.com`, Dokploy slug `clients-jpv-bootcamp-app-tp9xrk`, app ID `I_2Vukga3cc3ZhaG-mUzU`, PostgreSQL `10.0.2.4:5433`, database `jpvbootcamp`, schema `jpvbootcamp_staging`.
- **Current feature tip:** verify the exact operator tip with `git rev-parse HEAD`; pushes validate only and deployment requires explicit guarded dispatch.
- **Deployed staging baseline:** `9c045fa5a5c327014c20fe9377f7d5368b550573`, preview workflow `30853006495`, authenticated staging admin `14/14`. No newer deployment is claimed.
- **Implemented:** agreed launch-scope staging code plus durable account-action reservation/finalization and reversible migration `20260804_050000_member_account_action_reservations`.
- **Applied migration state:** guarded read-only plan run `31215369413` returned `plan_ok`: migration 29 is the sole missing Payload migration, zero unexpected/duplicate/malformed Payload records, and Prisma healthy. Migration 29 is not applied.
- **Next operator action:** finish a CI-green repository checkpoint, rerun the guarded pre-apply plan against that exact SHA, then prepare migration-29 apply authorization. Do not apply migration 29 from this handoff.
- **External gates:** explicit migration authorization, backup evidence, maintenance window, rollback ownership, exact-SHA staging deployment evidence, provider verification, formal smoke, approved content, and stakeholder acceptance remain separate.
- **Deferred/follow-up:** M2-01 and Phases 8–11 are not launch-scope blockers unless explicitly promoted.

## Historical/current-state notes retained for audit — not an execution packet

- Branch: `feature/course-branding-and-preview`
- Version 3.7 current client go-live plan; Version 3.4 is the prior progress baseline
- Version 3.7 client plan: `docs/client/JPV_Bootcamp_Platform_Expansion_Go_Live_Plan_v3_7.docx`
- Codebase alignment assessment: `docs/V3_5_CODEBASE_ALIGNMENT_ASSESSMENT.md`
- Latest completed verification snapshot: SHA `9c045fa5a5c327014c20fe9377f7d5368b550573`, preview workflow `30853006495` — `success`, exact-SHA health confirmed, authenticated admin `14/14`
- Current branch tip: run `git rev-parse HEAD` to confirm; staging health: `https://preview.jpvbootcamp.com/api/health`
- Branch tip verification: verify the current tip with `git log --oneline -1` before operator action
- PR / review URL: `https://github.com/prochattools/jpv-bootcamp/pull/3` (draft)
- Migration inventory: guarded read-only plan run `31215369413` reported migration 29 as the sole missing Payload migration at that historical checkpoint. The current source registry contains 36 names; registration inventory alone is not applied database state. The historical run and migration-29 instructions are retained as audit evidence only and must not be treated as current staging state.
- Post-apply migration verification: the pre-apply `staging:payload-migration-plan` intentionally expects migration 29 to be missing and is not the all-29-applied verifier. After an authorized apply, use the guarded apply runner's post-check plus the general read-only `pnpm staging:migration-status` mechanism (not run against staging at this pre-apply checkpoint) to prove all expected Payload migrations are applied and Prisma remains healthy. Authorized operator evidence remains required before deployment.
- Staging deployment target: this feature branch
- Front-end website go-live milestone: 22 July 2026
- Internal delivery / handover buffer: 23 July 2026
- Client-requested finished-by date: 24 July 2026
- Client content/input due: Wednesday 15 July 2026, now past due as of Friday 17 July 2026
- Client content request: `docs/client/CLIENT_CONTENT_REQUEST_15_JULY.md`
- Front-end content status tracker: `docs/client/FRONTEND_CONTENT_STATUS_TRACKER.md`
- Front-end acceptance evidence template: `docs/client/FRONTEND_ACCEPTANCE_EVIDENCE_TEMPLATE.md`
- Programme content intake template: `docs/client/PROGRAMME_CONTENT_INTAKE_TEMPLATE.md`
- Programme content approval record: `docs/client/PROGRAMME_CONTENT_APPROVAL_RECORD.md`
- Status update procedure: `docs/client/STATUS_UPDATE_PROCEDURE.md`
- Toolchain check: `pnpm toolchain:check`
- Programme content validation: `pnpm content:programme:validate -- <repository-relative-json-path>`
- Programme content acceptance report: `pnpm content:programme:acceptance -- <repository-relative-json-path>`
- Programme content import plan: `pnpm content:programme:import-plan -- <repository-relative-json-path>`
- Decision-readiness check: `pnpm staging:decision-readiness`
- Static preflight: `pnpm staging:static-preflight`
- Migration rehearsal: `pnpm staging:migration-rehearsal`
- Migration rehearsal evidence: `pnpm staging:migration-rehearsal:evidence`
- Provider simulation: `pnpm staging:provider-simulation`
- Local simulated smoke: `pnpm staging:smoke-simulated`
- Evidence artifact generator: `pnpm evidence:create`
- Evidence artifact validator: `pnpm evidence:validate`
- Draft evidence `.md` files under `docs/client/evidence/` are local operator artifacts and must not be committed unless explicitly approved.

## What is complete

- Payload-only Free/Pro refit
- M0-01 through M0-09 implementation
- M1-01 through M1-06 implementation
- Programme-content acceptance and release-candidate tooling: canonical contract, client intake template, non-publishable fixture, validation, acceptance report, import plan, approval record, release-manifest coverage, and preview guards
- Legacy WordPress, Fluent, VIP, exhibitor, and removed member namespace active path removal
- Pro-only checkout hardening with monthly and annual billing options
- Support/pay-it-forward controlled Free semantics and durable support intake
- Support request full lifecycle: member submission → operator Pending/In Review/Resolved → requester acknowledgement email (live staging proof 2026-07-28)
- Transactional email logo: all branded emails use absolute public URL for JPV logo (live staging proof 2026-07-29)
- Operator surface phases 1–6: responsive hardening, operator tools JPV token alignment, Payload dashboard redesign, sidebar information architecture, dashboard hardening, operator experience hardening, and Payload admin usability — all purely presentational, no auth/billing/provider changes
- Canonical `/portal` member portal ownership
- Deterministic release gate: `pnpm test:release` (`172/172`) — the release manifest contains 173 entries including the A6 authenticated-gate contract and one staging-only conditional gate; the default run includes the account-action hardening-status guard, staging migration plan workflow contract, environment configurator dry-run/apply guard test, portal admin source structure and behavioral contract verification, and support requester phone migration safety coverage
- Launch browser E2E: `pnpm test:e2e` (Playwright: 188 collected, 148 passed, 40 skipped; four staging-only spec files not collected; desktop and mobile Chromium)
- Combined release/browser gate: `pnpm test:release:full`
- Decision-readiness summary: `DECISION-READY, EXTERNAL APPROVALS PENDING`
- Static preflight, root TypeScript, production build, both Prisma validations, and production high-severity audit gate
- Repository-owned staging operations contract
- Migration preflight command: `pnpm staging:migration-preflight`
- Migration rehearsal command: `pnpm staging:migration-rehearsal`
- Migration rehearsal evidence command: `pnpm staging:migration-rehearsal:evidence`
- Provider simulation command: `pnpm staging:provider-simulation`
- Staging smoke plan command: `pnpm staging:smoke-plan`
- Local simulated smoke command: `pnpm staging:smoke-simulated`
- Static migration rehearsal passed in repository-only mode
- Migration rehearsal evidence generation passed
- Provider simulation passed `10/10`
- Local simulated smoke passed `5/5`
- Release evidence dry run: `pnpm release:evidence:dry-run`
- Support-request migration runbook
- Rollback-evidence checklist
- Provider verification runbook
- Go / no-go checklist
- Migration approval packet
- Migration approval status tracker
- Migration rehearsal runbook
- Staging smoke checklist
- Staging smoke evidence template
- Provider/email readiness checklist
- Provider/email evidence template
- Static safety tests
- Evidence artifact automation (local-only generator and validator)
- Static preflight automation
- Committed-evidence guard
- Evidence output folder ready

## What is blocked

- Legacy intake is repository-tested only: reviewed bounded WordPress JSON is supported, generic RSS is rejected as non-WXR, and no real source export or import has been executed.
- Representative 8-week programme content approval or explicit placeholder acceptance
- The repository-owned programme content intake, validation, acceptance report, import plan, and approval record are complete; the client package and approval evidence are still required before the representative programme can leave preview-only state
- Final public-copy and front-end content approval
- Migration 29 apply remains pending a fresh guarded `plan_ok` at the final CI-green SHA plus separate explicit operator authorization.
- Apply authorization requires the five dynamic values: expected hostname, operator ID, backup evidence ID, maintenance-window ID, and rollback owner.
- Legacy cutover/table-plan/account-column operations remain separately gated and are not part of the migration-29 apply authorization.
- Rollback planning and rollback execution remain separate decisions with explicit ownership and evidence requirements.
- Provider/email live verification remains pending
- Staging smoke execution remains pending
- Formal go/no-go review
- Production operation remains blocked until every independent gate passes

## Repository-owned staging operations contract

- Status: `DECISION-READY FOR CONTROLLED STAGING APPROVAL`
- Migration runbook: `docs/release/SUPPORT_REQUESTS_MIGRATION_RUNBOOK.md`
- Rollback evidence checklist: `docs/release/ROLLBACK_EVIDENCE_CHECKLIST.md`
- Provider verification runbook: `docs/release/PROVIDER_VERIFICATION_RUNBOOK.md`
- Go / no-go checklist: `docs/release/GO_NO_GO_CHECKLIST.md`
- Decision packets: `docs/decisions/`
- Decision manifest and runner: `scripts/release/decisionManifest.ts`, `pnpm staging:decision-readiness`
- Read-only migration preflight: `pnpm staging:migration-preflight`
- Static-first migration rehearsal: `pnpm staging:migration-rehearsal`
- Migration rehearsal evidence builder: `pnpm staging:migration-rehearsal:evidence`
- Mocked provider simulation: `pnpm staging:provider-simulation`
- Plan-only staging smoke command: `pnpm staging:smoke-plan`
- Local simulated staging smoke: `pnpm staging:smoke-simulated`
- Repository-only release evidence summary: `pnpm release:evidence:dry-run`
- Static rehearsal status: `Passed`
- Provider simulation status: `Passed`
- Local simulated smoke status: `Passed`
- This contract does not mark migration applied, provider verified, staging passed, rollback proven in staging, or go-live approved.

## Exact next operator sequence

1. Review `docs/PREVIEW_RELEASE_READINESS.md` as the current repository-owned readiness source of truth.
2. Confirm the exact branch tip with `git log --oneline -1`, then rerun `pnpm toolchain:check`, `pnpm staging:decision-readiness`, `pnpm staging:migration-preflight`, `pnpm staging:migration-rehearsal`, `pnpm staging:migration-rehearsal:evidence`, `pnpm staging:provider-simulation`, `pnpm staging:smoke-plan`, `pnpm staging:smoke-simulated`, `pnpm release:evidence:dry-run`, `pnpm staging:static-preflight`, `pnpm test:release`, and `pnpm test:e2e` at that tip before any operator execution.
3. Collect and record client content decisions by 15 July using the content request and status tracker; programme remains preview-only until approved content exists.
4. Convert the approved representative programme package into the canonical repository JSON format and run `pnpm content:programme:validate`, `pnpm content:programme:acceptance`, and `pnpm content:programme:import-plan`.
5. Confirm the remaining decision packets in this order before any migration action: table-plan-to-Free approval, account-column rename approval, rollback readiness approval, staging migration approval.
6. Execute staging smoke from the approved deployment target and record evidence in the staging smoke template.
7. Execute provider/email verification separately and record evidence in the provider template.
8. Update `docs/release/GO_NO_GO_CHECKLIST.md` and `docs/decisions/CORE_GO_LIVE_DECISION.md` with real evidence only after migration, provider, staging, and content evidence exists.
9. Hold a formal go/no-go review using the completed repository, staging, provider, migration, rollback, and programme-content evidence.
10. Keep `M2-01` deferred post-core unless explicitly promoted.
11. Do not apply migrations until approval, rehearsal, backup, owner, and rollback evidence are complete.
12. Do not touch `main`.

## Hard stops

- No migrations without written target-environment approval.
- No false approval: `pnpm staging:decision-readiness` must stay `DECISION-READY, EXTERNAL APPROVALS PENDING` until the external evidence actually exists.
- No DB-mutating commands from this handoff.
- No migrations are applied by toolchain or static preflight.
- No live network checks are run by toolchain or static preflight.
- No secrets in docs or evidence.
- No `main` branch work.
