# Operator Handoff Summary

## Current state

- Branch: `feature/course-branding-and-preview`
- Version 3.7 current client go-live plan; Version 3.4 is the prior progress baseline
- Version 3.7 client plan: `docs/client/JPV_Bootcamp_Platform_Expansion_Go_Live_Plan_v3_7.docx`
- Codebase alignment assessment: `docs/V3_5_CODEBASE_ALIGNMENT_ASSESSMENT.md`
- Current validated readiness baseline: `d55229f test: enforce programme content readiness`
- Branch tip verification: verify the current tip with `git log --oneline -1` before operator action
- PR / review URL: `https://github.com/prochattools/jpv-bootcamp/pull/2`
- Migrations applied: `No`
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
- Canonical `/portal` member portal ownership
- Deterministic non-browser release gate: `pnpm test:release` (`148/148`)
- Launch browser E2E: `pnpm test:e2e` (`58/58`, desktop and mobile Chromium)
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

- Representative 8-week programme content approval or explicit placeholder acceptance
- The repository-owned programme content intake, validation, acceptance report, import plan, and approval record are complete; the client package and approval evidence are still required before the representative programme can leave preview-only state
- Final public-copy and front-end content approval
- Support-request migration remains unapplied pending the normal release migration process
- Table-plan-to-Free target-environment approval
- Account-column rename approval
- Approved migration path, owner, and rollback confirmation
- Disposable localhost-only migration rehearsal has not been executed in this branch work beyond the static repository rehearsal unless separately evidenced
- Rollback/recovery review and execution ownership
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
