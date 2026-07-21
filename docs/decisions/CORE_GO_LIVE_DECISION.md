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

| Decision | Required state before `GO` | Current state (2026-07-21) |
| --- | --- | --- |
| programme-content-publication | approved | PENDING — awaiting client content |
| table-plan-to-free | approved | PENDING — awaiting approval |
| account-column-rename | approved | PENDING — awaiting approval |
| staging-migration-approval | approved | PENDING — unapproved; 3 schema migrations unapplied |
| rollback-readiness | approved | DOCUMENTED — checklist complete; staging rollback evidence not yet captured |
| provider-verification | approved | **PARTIALLY VERIFIED (2026-07-21):** Stripe TEST ✓, Resend ✓, Bunny CDN ✓; Payload/admin staging login pending |
| staging-smoke | approved | **PARTIALLY EXECUTED (2026-07-21):** HTTP smoke 15/15 PASS; browser session smoke pending |
| REM-01 invitation cohort | approved | **DRY-RUN CONFIRMED:** 21 members in cohort; apply pending authorization |

## Unresolved risks

- Repository simulation alone cannot produce GO.
- 3 schema migrations unapplied (remove_table_plan, rename_account_identity_columns, membership_support_schema); no apply authorization received.
- Browser session smoke (login, portal, billing portal) not yet executed.
- Payload/admin staging login verification not yet executed.
- Client content outstanding; programme remains preview-only.
- M2 remains unstarted and post-core.
- Production remains untouched; production cutover requires separate production authorization.

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
