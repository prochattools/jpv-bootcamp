# Operator Handoff Summary

## Current state

- Branch: `feature/course-branding-and-preview`
- Last recorded validated baseline before this status update: `143a6f8 docs: add staging evidence artifact automation`
- Branch tip verification: verify the current tip with `git log --oneline -1` before operator action
- PR / review URL: `https://github.com/prochattools/jpv-bootcamp/pull/2`
- Migrations applied: `No`
- Staging deployment target: this feature branch
- Status update procedure: `docs/client/STATUS_UPDATE_PROCEDURE.md`
- Toolchain check: `pnpm toolchain:check`
- Static preflight: `pnpm staging:static-preflight`
- Evidence artifact generator: `pnpm evidence:create`
- Evidence artifact validator: `pnpm evidence:validate`
- Draft evidence `.md` files under `docs/client/evidence/` are local operator artifacts and must not be committed unless explicitly approved.

## What is complete

- Payload-only Free/Pro refit
- Legacy WordPress, Fluent, VIP, and exhibitor active path removal
- Pro-only checkout hardening
- Support/pay-it-forward controlled Free semantics
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

- Table-plan-to-Free target-environment approval
- Account-column rename approval
- Approved migration path confirmation
- Rollback/recovery review
- Provider/email live verification
- Staging smoke execution

## Exact next operator sequence

1. Review `docs/client/MIGRATION_APPROVAL_PACKET.md`.
2. Update `docs/client/MIGRATION_APPROVAL_STATUS.md` only after real approval.
3. Review `docs/client/STATUS_UPDATE_PROCEDURE.md` before changing any roadmap percentages.
4. Run `pnpm toolchain:check` and `pnpm staging:static-preflight` before manual staging smoke or evidence capture when the shell pnpm version is not already pinned.
5. **Optional:** Run `pnpm evidence:create` to generate draft evidence templates.
6. **During staging smoke:** Complete `docs/client/STAGING_SMOKE_EVIDENCE_TEMPLATE.md` in `docs/client/evidence/`.
7. **During provider/email checks:** Complete `docs/client/PROVIDER_EMAIL_EVIDENCE_TEMPLATE.md` in `docs/client/evidence/`.
8. **Before closing out:** Run `pnpm evidence:validate` to validate completed evidence for safety and consistency.
9. Do not commit unfilled draft evidence files unless explicitly approved.
10. Do not apply migrations until approval is complete.
11. Do not touch `main`.

## Hard stops

- No migrations without written target-environment approval.
- No DB-mutating commands from this handoff.
- No migrations are applied by toolchain or static preflight.
- No live network checks are run by toolchain or static preflight.
- No secrets in docs or evidence.
- No `main` branch work.
