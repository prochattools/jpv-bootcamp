# JPV Bootcamp - Roadmap Progress Status

Current status for `feature/course-branding-and-preview`, using the 10 July 2026 audit at `236227c fix: require portal auth for member content` as the historical baseline, `af6de62 docs: record core go-live readiness` as the previous readiness baseline, and `d55229f test: enforce programme content readiness` as the current validated baseline.

Current client truth: `docs/client/JPV_Bootcamp_Platform_Expansion_Go_Live_Plan_v3_6.docx`. Version 3.4 is the prior progress baseline. Canonical execution plan: `docs/PAYLOAD_INTEGRATION_PLAN.md`. Detailed audit evidence: `docs/V3_5_CODEBASE_ALIGNMENT_ASSESSMENT.md`.

Status update procedure: `docs/client/STATUS_UPDATE_PROCEDURE.md`.

## Current position

**Position:** Core go-live implementation and deterministic local validation are complete. The repository is ready to accept programme content and ready for controlled staging operations documentation and preflight, but the branch is still **not ready for the controlled staging release process** because representative 8-week programme content remains unapproved, the support-request migration remains unapplied, provider/email verification and staging smoke remain unexecuted, and the formal go/no-go decision has not happened.

**Next task:** Execute the controlled staging release process prerequisites using the repository-owned contracts: content approval, migration approval and rehearsal confirmation, provider/email verification, staging smoke evidence, and formal go/no-go review. `M2-01` remains deferred post-core unless explicitly promoted.

**Front-end schedule:** The 22 July front-end milestone is achievable only if immediate public blockers and the billing decision close by 13 July, all launch-scoped P0 implementation closes by 17 July, and client content, pricing/commitment language, legal wording, and course input arrive or placeholders are explicitly approved by 15 July. The 23 July handover buffer and 24 July client finished-by date remain.

**Cutover schedule:** Full platform cutover on 22-24 July is conditional and at risk. It requires approved migrations, rehearsal and rollback evidence, provider/email verification, complete browser smoke evidence, and explicit go-live approval.

**Hard stops:** Do not apply migrations. Do not touch `main`. Do not describe static prototypes as operational workflows.

## Branch and deployment state

| Field | Value |
| --- | --- |
| Branch | `feature/course-branding-and-preview` |
| Staging target | This feature branch is the staging / production-staged deployment branch |
| Historical audit baseline | `236227c fix: require portal auth for member content` |
| Previous readiness baseline | `af6de62 docs: record core go-live readiness` |
| Current validated readiness baseline | `d55229f test: enforce programme content readiness` |
| PR / review | `https://github.com/prochattools/jpv-bootcamp/pull/2` |
| Migrations applied | None |
| Migration approval | Blocked pending table-plan-to-Free, account-column rename, path, backup, rollback, and owner approval |
| Provider/email acceptance | Pending operator verification |
| Complete staging/browser smoke | Local browser validation passed; staging smoke pending |

No migrations have been applied on this branch.

## Audited readiness

These figures are the 10 July audited baseline, not the final current-state gate status. Since that audit, the repository has completed the launch-scoped M0/M1 implementation packets and passed the deterministic local release/browser/build/Prisma/audit gates. Live cutover status remains blocked by non-local approvals and operator execution.

| Area | Version 3.4 estimate | Version 3.5 audited | Evidence | Main blocker |
| --- | ---: | ---: | --- | --- |
| Expanded platform | ~73-75% | ~68% | Core services are substantial; recent MVP routes exist | Several MVPs are placeholders or client-only; release blockers remain |
| Core staging/code | ~97% | ~82% | Auth, account security, entitlements, billing projection, migrations, and CI build are mature | Public operator route, route duplication, endpoint hardening, dependency advisories |
| Build foundation | ~89-95% | ~86% | Most domains have typed services and focused tests | Starter/template residue and remaining hardening/test gaps |
| Testing/release | ~94-99% | ~76% (historical audit baseline) | 10 July audit evidence before M1-02/M1-03/M1-06 completion | Current branch now has `test:release`, browser E2E, `test:release:full`, and static preflight; staging/provider/go-no-go evidence still pending |
| Migration | ~55% | ~55% | Sources, inventory, approvals packet, runbook, and safety tests exist | No approval, rehearsal, rollback evidence, or application |
| Live cutover | ~20% | ~20% | Handoff/evidence templates exist | No migrations, full smoke, provider/email acceptance, content acceptance, or go-live approval |

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
- `pnpm staging:migration-preflight`
- `pnpm staging:smoke-plan`
- `pnpm release:evidence:dry-run`

These assets make the repository ready for controlled staging operations without claiming live migration, provider verification, staging acceptance, or go-live approval.

## Timeline and decision gates

| Date | Gate |
| --- | --- |
| 10-13 July 2026 | M0-01 through M0-04 complete, M0-05 billing decision obtained, dependency triage complete |
| 15 July 2026 | Client content, pricing/commitment wording, legal copy, and course input approved or placeholders accepted |
| 14-17 July 2026 | M0-06 through M0-09 complete; M1-01 complete if support intake is in core go-live |
| 18-20 July 2026 | Launch-scoped M1 packets, full release/browser tests, approved staging smoke, provider/email verification, migration rehearsal, and rollback evidence |
| 21 July 2026 | Formal go/no-go; zero unresolved P0 blockers |
| 22 July 2026 | Front-end milestone if public acceptance passes |
| 23 July 2026 | Handover buffer and non-migration corrections |
| 24 July 2026 | Client finished-by date; full cutover only if every independent gate passes |

## Test and security evidence

- `git diff --check` passed.
- `pnpm test:release` passed `121/121`.
- `pnpm test:e2e` passed `58/58` across desktop and mobile Chromium projects.
- Programme contract, path-safety, import-plan, readiness, acceptance-report, and preview-only browser checks passed.
- `pnpm test:release:full` passed.
- `pnpm staging:static-preflight` passed.
- `pnpm staging:migration-preflight` passed.
- `pnpm staging:smoke-plan` passed.
- `pnpm release:evidence:dry-run` produced a deterministic repository-only summary.
- root TypeScript passed.
- production build passed.
- both Prisma schema validations passed.
- production audit high-severity gate passed; remaining advisories are `2 moderate`.
- `scripts/no_legacy_learn_namespace.test.ts` passed.
- Feature-branch CI type-checks and builds the application and Docker image without publishing from the validation job.
- Repository inventory now includes deterministic release-manifest coverage and Playwright launch browser E2E.
- Graph analysis found an import cycle between `communityFiles.ts` and `communityModeration.ts`.
- `pnpm audit --prod --audit-level high` now passes the release gate.
- Global application security headers are not defined in `next.config.js`.

## Migration warning

The Payload migration `20260707_130000_remove_table_plan_from_payload_enums` maps legacy table-plan subscription values to `free`. The Prisma migration `20260707_120000_rename_account_identity_columns` renames old account-reference columns/indexes to neutral names. Neither migration has been applied.

Do not apply migrations until the target-environment owner approves the business mapping, exact database/schema, backup, operator, maintenance window, apply path, verification, and rollback procedure.
