# Status Update Procedure

Procedure for future agents and operators who update roadmap progress and related status docs for `feature/course-branding-and-preview`.

Version 3.7 is the current client go-live plan. Version 3.4 is the prior progress baseline. Current truth is `docs/client/JPV_Bootcamp_Platform_Expansion_Go_Live_Plan_v3_7.docx`; audit evidence is `docs/V3_5_CODEBASE_ALIGNMENT_ASSESSMENT.md`.

## Purpose

This procedure prevents status drift. It keeps roadmap percentages, migration readiness, staging readiness, and evidence language aligned with the actual branch state and the approved operator record.

## Required pre-checks

Before updating any status text:

1. Verify the branch is `feature/course-branding-and-preview`.
2. Verify the worktree is clean.
3. Verify local and upstream branches are in sync.
4. Verify the exact current branch tip with `git log --oneline -1`.
5. Migrations applied remains `No` unless a separate approved migration record exists.
6. Verify the latest recorded operator evidence or handoff note is still current.
7. Run `pnpm toolchain:check` before `pnpm staging:static-preflight` if your local pnpm version is not already pinned to `pnpm@10.33.0`.

Historical audit baseline for roadmap percentages: `236227c fix: require portal auth for member content`.

Do not treat this document's commit reference as approval to run migrations. Always verify the branch tip directly before operator action.

## How to update progress

1. Update `docs/client/ROADMAP_PROGRESS_STATUS.md` first.
2. Keep percentage changes conservative and evidence-based.
3. Explain exactly what evidence supports each percentage change.
4. Do not raise live cutover readiness for documentation-only work unless the work directly supports live cutover evidence or operator readiness.
5. Never mark migration readiness as execution-ready until target-environment approval and rehearsal evidence exist.
6. Never mark live cutover complete until migrations, staging smoke, provider/email verification, and content checks are actually complete.
7. Keep blocker language explicit when approval, rehearsal, or operator evidence is still pending.
8. Count a workflow as operational only when persistence, authorization, failure behavior, focused tests, and required runtime evidence exist. A route, static model, or source file alone is not completion evidence.
9. Do not raise testing/release readiness from test-file count. Record which suite runs the test, whether build/browser checks exist, and whether operator evidence is complete.

## Required cross-link checks

Before publishing a status update, verify these links are present and correct:

- `docs/client/ROADMAP_PROGRESS_STATUS.md`
- `docs/client/MIGRATION_APPROVAL_PACKET.md`
- `docs/client/MIGRATION_APPROVAL_STATUS.md`
- `docs/client/MIGRATION_REHEARSAL_RUNBOOK.md`
- `docs/client/OPERATOR_HANDOFF_SUMMARY.md`
- `docs/client/EVIDENCE_REVIEW_CHECKLIST.md`
- `docs/client/STAGING_SMOKE_CHECKLIST.md`
- `docs/client/STAGING_SMOKE_EVIDENCE_TEMPLATE.md`
- `docs/client/PROVIDER_EMAIL_READINESS.md`
- `docs/client/PROVIDER_EMAIL_EVIDENCE_TEMPLATE.md`
- `docs/client/JPV_Bootcamp_Platform_Expansion_Go_Live_Plan_v3_7.docx`
- `docs/V3_5_CODEBASE_ALIGNMENT_ASSESSMENT.md`
- `docs/client/JPV_BOOTCAMP_GO_LIVE_PLAN_V3_4_SUMMARY.md` (prior baseline only)
- `docs/client/FRONTEND_COPY_APPROVAL_PACKET.md`
- `docs/client/CLIENT_CONTENT_REQUEST_15_JULY.md`
- `docs/client/FRONTEND_CONTENT_STATUS_TRACKER.md`
- `docs/client/FRONTEND_ACCEPTANCE_EVIDENCE_TEMPLATE.md`
- `docs/client/FRONTEND_CONTENT_INTAKE_CHECKLIST.md`
- `pnpm staging:static-preflight` (local-only static preflight; no migrations, no DB access, no live network checks, includes committed-evidence guard)
- `pnpm toolchain:check` (local-only toolchain preflight; no migrations, no DB access, no live network checks)
- `scripts/create_staging_evidence_artifacts.ts`
- `scripts/validate_staging_evidence_artifacts.ts`
- `docs/client/evidence/`
- `pnpm evidence:create` (local-only draft generator)
- `pnpm evidence:validate` (local-only validator)

Also keep the review packet and README index aligned:

- `docs/client/PAYLOAD_ONLY_FREE_PRO_REVIEW_PACKET.md`
- `docs/client/README.md`

## Required validation

Run the following checks after any status or cross-link update:

```bash
git diff --check
./node_modules/.bin/tsc --noEmit --pretty false --incremental false
./node_modules/.bin/prisma validate --schema=prisma/system.prisma
./node_modules/.bin/prisma validate --schema=prisma/schema.prisma
```

Run the focused static docs tests that cover the current handoff and evidence set:

```bash
./node_modules/.bin/tsx scripts/preview_migration_inventory.test.ts
./node_modules/.bin/tsx scripts/migration_readiness_static.test.ts
./node_modules/.bin/tsx scripts/migration_rehearsal_safety.test.ts
./node_modules/.bin/tsx scripts/staging_evidence_static.test.ts
./node_modules/.bin/tsx scripts/operator_handoff_static.test.ts
./node_modules/.bin/tsx scripts/status_docs_consistency.test.ts
./node_modules/.bin/tsx scripts/evidence_artifact_automation.test.ts
./node_modules/.bin/tsx scripts/evidence_package_scripts.test.ts
./node_modules/.bin/tsx scripts/staging_static_preflight_package.test.ts
./node_modules/.bin/tsx scripts/billing_readiness_report.test.ts
./node_modules/.bin/tsx scripts/member_checkout.test.ts
```

## Hard stops

- Do not touch `main`.
- Do not apply migrations.
- Do not run DB-mutating commands.
- Do not paste secrets into docs or evidence.
- Do not commit unfilled draft evidence files unless explicitly approved.
- Do not claim staging smoke, provider/email, or live cutover are done unless the operator evidence files are actually completed.
- Do not increase migration readiness or live cutover readiness beyond the evidence that exists.
- Do not claim `pnpm staging:static-preflight` proves operator approval, staging smoke, or provider/email verification.
- Do not claim `pnpm toolchain:check` applies migrations, touches the database, or performs live network checks.

## Recommended update pattern

When status changes, update the roadmap and operator handoff together so the numbers, blockers, and next task match. Keep the 15/22/23/24 July dates visible, but mark the 22 July milestone conditional while any P0 hardening or public-acceptance blocker remains. The milestone does not authorize migration execution.

Use wording that stays valid after future documentation-only commits:

- `Current branch tip must be verified with git log --oneline -1 before operator action.`
- `Run pnpm staging:static-preflight, then operator completes approval, staging smoke, and provider/email evidence without applying migrations.`
- `Draft evidence .md files under docs/client/evidence/ are local operator artifacts and must not be committed unless explicitly approved.`
- `Last recorded validated baseline before this status update: <commit>`
- `No migrations have been applied.`

## Follow-up

If a status update implies approval, rehearsal, or operator evidence that is not yet present, stop and record the blocker instead of inflating the percentages.
