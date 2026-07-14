# Operator Handoff Summary

## Current state

- Branch: `feature/course-branding-and-preview`
- Version 3.5 current client go-live plan; Version 3.4 is the prior progress baseline
- Version 3.5 client plan: `docs/client/JPV_Bootcamp_Platform_Expansion_Go_Live_Plan_v3_5.docx`
- Codebase alignment assessment: `docs/V3_5_CODEBASE_ALIGNMENT_ASSESSMENT.md`
- Current local readiness baseline: `1e5c4ed feat: complete M1-06 launch content views`
- Branch tip verification: verify the current tip with `git log --oneline -1` before operator action
- PR / review URL: `https://github.com/prochattools/jpv-bootcamp/pull/2`
- Migrations applied: `No`
- Staging deployment target: this feature branch
- Front-end website go-live milestone: 22 July 2026
- Internal delivery / handover buffer: 23 July 2026
- Client-requested finished-by date: 24 July 2026
- Client content/input due: Wednesday 15 July 2026
- Client content request: `docs/client/CLIENT_CONTENT_REQUEST_15_JULY.md`
- Front-end content status tracker: `docs/client/FRONTEND_CONTENT_STATUS_TRACKER.md`
- Front-end acceptance evidence template: `docs/client/FRONTEND_ACCEPTANCE_EVIDENCE_TEMPLATE.md`
- Status update procedure: `docs/client/STATUS_UPDATE_PROCEDURE.md`
- Toolchain check: `pnpm toolchain:check`
- Static preflight: `pnpm staging:static-preflight`
- Evidence artifact generator: `pnpm evidence:create`
- Evidence artifact validator: `pnpm evidence:validate`
- Draft evidence `.md` files under `docs/client/evidence/` are local operator artifacts and must not be committed unless explicitly approved.

## What is complete

- Payload-only Free/Pro refit
- M0-01 through M0-09 implementation
- M1-01 through M1-06 implementation
- Legacy WordPress, Fluent, VIP, exhibitor, and removed member namespace active path removal
- Pro-only checkout hardening with monthly and annual billing options
- Support/pay-it-forward controlled Free semantics and durable support intake
- Canonical `/portal` member portal ownership
- Deterministic non-browser release gate: `pnpm test:release` (`116/116`)
- Launch browser E2E: `pnpm test:e2e` (`56/56`)
- Combined release/browser gate: `pnpm test:release:full`
- Static preflight, root TypeScript, production build, both Prisma validations, and production high-severity audit gate
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
- Final public-copy and front-end content approval
- Support-request migration remains unapplied pending the normal release migration process
- Table-plan-to-Free target-environment approval
- Account-column rename approval
- Approved migration path confirmation
- Rollback/recovery review and execution ownership
- Provider/email live verification remains pending
- Staging smoke execution remains pending
- Formal go/no-go review
- Production operation remains blocked until every independent gate passes

## Exact next operator sequence

1. Review `docs/PREVIEW_RELEASE_READINESS.md` as the current repository-owned readiness source of truth.
2. Confirm the exact branch tip with `git log --oneline -1`, then rerun `pnpm toolchain:check`, `pnpm staging:static-preflight`, `pnpm test:release`, and `pnpm test:e2e` at that tip before any operator execution.
3. Collect and record client content decisions by 15 July using the content request and status tracker; programme remains preview-only until approved content exists.
4. Confirm migration approval, rehearsal ownership, rollback ownership, and exact apply path before any migration action.
5. Execute staging smoke from the approved deployment target and record evidence in the staging smoke template.
6. Execute provider/email verification separately and record evidence in the provider template.
7. Hold a formal go/no-go review using the completed repository, staging, provider, and migration evidence.
8. Keep `M2-01` deferred post-core unless explicitly promoted.
9. Do not apply migrations until approval, rehearsal, backup, owner, and rollback evidence are complete.
10. Do not touch `main`.

## Hard stops

- No migrations without written target-environment approval.
- No DB-mutating commands from this handoff.
- No migrations are applied by toolchain or static preflight.
- No live network checks are run by toolchain or static preflight.
- No secrets in docs or evidence.
- No `main` branch work.
