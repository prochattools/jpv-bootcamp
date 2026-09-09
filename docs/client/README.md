# JPV Bootcamp Client Document Inventory

This folder tracks client-facing documents so internal roadmap documentation stays aligned with the latest communicated client truth.

## Current client truth

### Current deployed state — 2026-09-09

Production is live from `main` at commit/image
`c72ad378c6cf43a2d0a474000e3e979f834f784e`. The protected root-domain publish
workflow passed, Dokploy convergence passed, and the live deployment-health
endpoint reports `status=live` and `deploymentEnv=production`. PR #31 contains
the production-hygiene release and PR #32 contains the production image
Bookworm fix; both are merged. No separate production migration workflow was
run for this deployment, and no new feature PR was promoted with it.

The current production release is operational. PR #30 remains a stale,
unmerged hardening branch for separate review; PR #33 is a development-only
dependency update. Historical pre-deployment snapshots below retain their
original commit identities and claims.

**JPV Bootcamp Platform Expansion & Go-Live Plan v3.7** is the current client go-live plan. Version 3.4 is the prior progress baseline.

It supersedes the older Version 2.40 plan for product scope, terminology, progress framing, and launch expectations.

Version 3.7 keeps the front-end website milestone at 22 July 2026, the internal delivery / handover buffer at 23 July 2026, the client-requested finished-by date at 24 July 2026, and notes that client content/input was due Wednesday 15 July 2026 and remains outstanding as of the current reporting date. The 22 July milestone is conditional on P0 hardening and public acceptance. None of these dates authorizes migration execution.

The client go-live plan does not authorize migration execution. No separate
production migration workflow was run for the 2026-09-09 deployment.

The current production release authority is `main` at
`c72ad378c6cf43a2d0a474000e3e979f834f784e`. The canonical staging target is
`https://staging.jpvbootcamp.com`. The 2026-09-09 hygiene candidate and its
Bookworm image fix are now historical merged release inputs.
The older `feature/course-branding-and-preview` deployment wording is retained
only in dated audit records and historical client planning material.
Local toolchain is pinned to `pnpm@10.33.0`; run `pnpm toolchain:check` before operator preflight if your shell pnpm version is not already aligned.

## Review packet

- [JPV Bootcamp Platform Expansion Go-Live Plan v3.7 (DOCX)](./JPV_Bootcamp_Platform_Expansion_Go_Live_Plan_v3_7.docx) — current client-facing plan, status, timeline, and launch gates.
- [Roadmap/code alignment assessment](../V3_5_CODEBASE_ALIGNMENT_ASSESSMENT.md) — internal audit evidence, hardening backlog, and GPT-5.4-mini execution contract.
- [Payload-only Free/Pro Review Packet](./PAYLOAD_ONLY_FREE_PRO_REVIEW_PACKET.md) — historical commit-readiness summary for the Free/Pro refit.
- [JPV Bootcamp Go-Live Plan v3.4 Summary](./JPV_BOOTCAMP_GO_LIVE_PLAN_V3_4_SUMMARY.md) — prior progress baseline.
- [JPV Bootcamp Platform Expansion Go-Live Plan v3.4 (DOCX)](./JPV_Bootcamp_Platform_Expansion_Go_Live_Plan_v3_4.docx) — prior client-facing baseline artifact.
- [Roadmap Progress Status](./ROADMAP_PROGRESS_STATUS.md) — current position, progress table, validation evidence, remaining risks, and next executable tasks.
- [Migration Approval Packet](./MIGRATION_APPROVAL_PACKET.md) — approval-focused summary for the pending migration decision and execution boundary.
- [Migration Approval Status](./MIGRATION_APPROVAL_STATUS.md) — current blocked/approved state for future agents and operators.
- [Migration Rehearsal Runbook](./MIGRATION_REHEARSAL_RUNBOOK.md) — operator-facing static-only runbook for rehearsal preparation and evidence capture.
- [Operator Handoff Summary](./OPERATOR_HANDOFF_SUMMARY.md) — concise operator-facing state summary and next-step handoff.
- [Evidence Review Checklist](./EVIDENCE_REVIEW_CHECKLIST.md) — checklist for reviewing completed staging and provider evidence.
- [Status Update Procedure](./STATUS_UPDATE_PROCEDURE.md) — operator procedure for conservative roadmap updates and drift prevention.
- [Staging Smoke Checklist](./STAGING_SMOKE_CHECKLIST.md) — manual smoke path for the staging / production-staged deployment branch.
- [Staging Smoke Evidence Template](./STAGING_SMOKE_EVIDENCE_TEMPLATE.md) — fillable evidence capture template for smoke verification.
- [Provider and Email Readiness](./PROVIDER_EMAIL_READINESS.md) — provider, email, and Stripe configuration readiness checklist without secrets.
- [Provider and Email Evidence Template](./PROVIDER_EMAIL_EVIDENCE_TEMPLATE.md) — fillable evidence capture template for provider/email verification.
- [Front-End Content Intake Checklist](./FRONTEND_CONTENT_INTAKE_CHECKLIST.md) — operator/client-facing checklist for 22 July front-end website go-live milestone, content dependencies, and acceptance criteria.
- [Front-End Copy Approval Packet](./FRONTEND_COPY_APPROVAL_PACKET.md) — exact public-facing copy, content dependencies, and client approval requirements for the front-end website launch.
- [Client Content Request for 15 July](./CLIENT_CONTENT_REQUEST_15_JULY.md) — client-sendable request for copy/content approval or replacement before the 22 July front-end milestone.
- [Front-End Content Status Tracker](./FRONTEND_CONTENT_STATUS_TRACKER.md) — operator tracker for pending, approved, and replacement content against the 15 July deadline.
- [Front-End Acceptance Evidence Template](./FRONTEND_ACCEPTANCE_EVIDENCE_TEMPLATE.md) — operator template for capturing manual front-end website acceptance after real checks.

## Evidence artifact automation

Local-only helper scripts for creating and validating evidence draft files:

- [`scripts/create_staging_evidence_artifacts.ts`](../../scripts/create_staging_evidence_artifacts.ts) — generates DRAFT evidence templates under [`evidence/`](./evidence/) without applying migrations or touching secrets. Operator fills evidence manually during actual staging smoke and provider checks.
- [`scripts/validate_staging_evidence_artifacts.ts`](../../scripts/validate_staging_evidence_artifacts.ts) — validates evidence files for safety, secret-leakage, and branch consistency. Does not connect to database or network.
- [`scripts/toolchain_preflight.ts`](../../scripts/toolchain_preflight.ts) — static local check for the pinned pnpm and Node toolchain; prints the Corepack and fallback commands but does not apply migrations, touch the database, or run network checks.
- `pnpm evidence:create` — generates draft evidence files locally.
- `pnpm evidence:validate` — validates evidence files locally.
- `pnpm toolchain:check` — verifies the pinned local toolchain before operator preflight.
- `pnpm staging:static-preflight` — runs the approved local-only static preflight checks, starting with the toolchain check and including a committed-evidence guard, before manual staging smoke and evidence capture.
- [Evidence folder](./evidence/) — stores completed evidence artifacts after operator verification. `.gitkeep` placeholder indicates folder is ready but evidence may not exist yet.

**Important:** Generated draft files do not prove any checks passed. Draft evidence `.md` files under `docs/client/evidence/` are local operator artifacts and must not be committed unless explicitly approved. `pnpm evidence:create` is separate from static preflight. Operator must complete evidence during actual staging/provider verification. No migrations are applied by these scripts.
- PR / review URL: `https://github.com/prochattools/jpv-bootcamp/pull/2`

## Current terminology

- **Free** — controlled non-paid access for approved support, pay-it-forward recipients, staff/test access, migration outcomes, or administrator-created access.
- **Pro** — the single paid subscription. Pro has two payment options: monthly with no minimum commitment and annual upfront with the approved discount.
- Removed historical paid tiers and non-Pro payment products must not be described as target tiers, public offers, checkout options, transition states, archived strategy, or future product labels in this feature branch.

## Internal alignment rule

`docs/PAYLOAD_INTEGRATION_PLAN.md` is the canonical internal roadmap and implementation plan. It must remain aligned with the current client truth and subordinate feature specifications.

Do not create a second general roadmap. Update the canonical plan first, then update feature specifications and client-facing summaries.

## Historical documents

- `JPV_Minimal_Payload_Course_Plan_v2_40` remains useful for historical staging progress and earlier scope comparison.
- Earlier v2.x client documents must not be used as current scope unless the client explicitly re-approves that older scope.

## Consistency checklist

Before a client or internal roadmap update is considered clean:

- public offer uses Free and Pro only;
- Pro is the only paid subscription;
- support/pay-it-forward is voucher-funded or pay-it-forward-funded membership, not a third tier;
- removed paid-tier and external-integration language does not appear in active docs, source, scripts, schema, or public copy, except where a data-preserving rename migration must reference old database column names;
- public launch page, billing automation, representative 8-week course, partner tracking, community previews, data reconciliation, and go-live approval are represented;
- static prototypes are not counted as operational deliverables until persistence, authorization, error handling, and tests pass;
- P0 hardening is complete before new feature work is promoted into the launch scope;
- post-core work is clearly separated from first core go-live work.
- staging smoke, migration approval, approval status, migration rehearsal, operator handoff, evidence review, staging/provider evidence templates, provider/email readiness, and roadmap documents stay linked from this index and the review packet.
