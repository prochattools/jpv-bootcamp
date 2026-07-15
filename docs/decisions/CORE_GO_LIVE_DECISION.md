# Core Go-Live Decision

- Decision ID: `core-go-live`
- Current status: `NO-GO`
- Decision owner role: `Release operator`
- Approver role: `Formal go-live approver`
- Implementation owner role: `Release operator`
- Rollback owner role: `Release rollback owner`
- Classification: `mixed`
- Release impact: `Final release decision record.`
- Depends on: `programme-content-publication, table-plan-to-free, account-column-rename, staging-migration-approval, rollback-readiness, provider-verification, staging-smoke`
- Required evidence summary: `docs/release/GO_NO_GO_CHECKLIST.md`, `pnpm staging:decision-readiness`, and formal approval evidence`

## Identity

- Release candidate commit: `[TO BE FILLED DURING APPROVAL]`
- Decision date: `[TO BE FILLED DURING APPROVAL]`
- Decision owner: `Release operator`
- Approvers: `[TO BE FILLED DURING APPROVAL]`
- Rollback owner: `Release rollback owner`
- Monitoring owner: `[TO BE FILLED DURING APPROVAL]`
- Communication owner: `[TO BE FILLED DURING APPROVAL]`

## Gate matrix

| Decision | Required state before `GO` | Current repository state |
| --- | --- | --- |
| programme-content-publication | approved | awaiting client content |
| table-plan-to-free | approved | awaiting approval |
| account-column-rename | approved | awaiting approval |
| staging-migration-approval | approved | not approved |
| rollback-readiness | approved | documented but incomplete |
| provider-verification | approved | unexecuted |
| staging-smoke | approved | unexecuted |

## Unresolved risks

- Repository simulation alone cannot produce GO.
- No migration has been applied.
- No live provider verification has been executed.
- No staging smoke evidence exists yet.
- M2 remains unstarted and post-core.

## Decision

- GO: `[TO BE FILLED DURING APPROVAL]`
- CONDITIONAL GO: `[TO BE FILLED DURING APPROVAL]`
- NO-GO: `Current default`
- Conditions: `[TO BE FILLED DURING APPROVAL]`

## Approval record

- Approval decision: `[TO BE FILLED DURING APPROVAL]`
- Approved / rejected by: `[TO BE FILLED DURING APPROVAL]`
- Approval timestamp: `[TO BE FILLED DURING APPROVAL]`
- Evidence reference: `[TO BE FILLED DURING APPROVAL]`
- Execution owner confirmation: `[TO BE FILLED DURING APPROVAL]`
- Rollback owner confirmation: `[TO BE FILLED DURING APPROVAL]`
