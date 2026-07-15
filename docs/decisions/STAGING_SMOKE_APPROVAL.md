# Staging Smoke Approval

- Decision ID: `staging-smoke`
- Current status: `UNEXECUTED`
- Decision owner role: `Release operator`
- Approver role: `Go-live approver`
- Implementation owner role: `Smoke verification operator`
- Rollback owner role: `Release rollback owner`
- Classification: `external`
- Release impact: `Blocks formal go/no-go.`
- Depends on: `staging-migration-approval, provider-verification, programme-content-publication`
- Required evidence summary: `docs/client/STAGING_SMOKE_CHECKLIST.md`, `docs/client/STAGING_SMOKE_EVIDENCE_TEMPLATE.md`, `pnpm staging:smoke-plan`, and `pnpm staging:smoke-simulated`

## Execution scope

- staging URL identity
- release candidate commit
- migration state at time of smoke
- browser evidence for public, member, and admin/operator routes
- provider evidence links
- blocker list
- rollback readiness check

## Evidence boundary

- Local simulated smoke is not accepted as staging evidence.
- `pnpm staging:smoke-plan` and `pnpm staging:smoke-simulated` remain repository-only preparation.
- No staging or production URL is pre-filled in this record.

## Approval record

- Approval decision: `[TO BE FILLED DURING APPROVAL]`
- Approved / rejected by: `[TO BE FILLED DURING APPROVAL]`
- Approval timestamp: `[TO BE FILLED DURING APPROVAL]`
- Evidence reference: `[TO BE FILLED DURING APPROVAL]`
- Execution owner confirmation: `[TO BE FILLED DURING APPROVAL]`
- Rollback owner confirmation: `[TO BE FILLED DURING APPROVAL]`

