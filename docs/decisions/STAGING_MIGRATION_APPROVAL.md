# Staging Migration Approval

- Decision ID: `staging-migration-approval`
- Current status: `NOT_APPROVED`
- Decision owner role: `Release operator`
- Approver role: `Database owner`
- Implementation owner role: `Migration operator`
- Rollback owner role: `Rollback owner`
- Classification: `mixed`
- Release impact: `Blocks any approved migration execution and staging verification.`
- Depends on: `table-plan-to-free, account-column-rename, rollback-readiness`
- Required evidence summary: `docs/release/SUPPORT_REQUESTS_MIGRATION_RUNBOOK.md`, `docs/release/ROLLBACK_EVIDENCE_CHECKLIST.md`, `pnpm staging:migration-preflight`, `pnpm staging:migration-rehearsal`, and `pnpm staging:migration-rehearsal:evidence`

## Identity

- Branch: `feature/course-branding-and-preview`
- Commit: `[TO BE FILLED DURING APPROVAL]`
- Migration path: `approved database migration path only`
- Checksum / release packet reference: `[TO BE FILLED DURING APPROVAL]`
- Target environment: `[TO BE FILLED DURING APPROVAL]`
- Requested execution date: `[TO BE FILLED DURING APPROVAL]`

## Preconditions

- Static rehearsal passed.
- Rollback evidence checklist exists and remains repository-owned until external evidence is captured.
- Backup or snapshot requirement is defined before execution.
- Staging environment identity is confirmed before execution.
- Provider dependencies remain separate and must not be called from this approval record.
- Application compatibility must match the approved branch tip and reviewed migration inventory.
- Operator, database owner, rollback owner, and communication owner must all be assigned.

## Approval

- Approval decision: `[TO BE FILLED DURING APPROVAL]`
- Approved / rejected by: `[TO BE FILLED DURING APPROVAL]`
- Approval timestamp: `[TO BE FILLED DURING APPROVAL]`
- Evidence reference: `[TO BE FILLED DURING APPROVAL]`
- Allowed environment: `[TO BE FILLED DURING APPROVAL]`
- Exact migration command: `[TO BE FILLED DURING APPROVAL]`
- Exact rollback strategy: `[TO BE FILLED DURING APPROVAL]`
- Execution owner confirmation: `[TO BE FILLED DURING APPROVAL]`
- Rollback owner confirmation: `[TO BE FILLED DURING APPROVAL]`

## Abort conditions

- unexpected HEAD or branch tip
- dirty Prisma schema or migration state
- missing backup or snapshot reference
- missing owner assignment
- missing rollback evidence
- provider dependency unavailable for the later verification phase
- ambiguous staging identity
- failed migration preflight

## Current repository consequence while unresolved

- `pnpm staging:decision-readiness` must keep this item `NOT_APPROVED`.
- The support-request migration remains unapplied.
- No environment is implicitly authorized from this document.

## Approval record

- Approval decision: `[TO BE FILLED DURING APPROVAL]`
- Approved / rejected by: `[TO BE FILLED DURING APPROVAL]`
- Approval timestamp: `[TO BE FILLED DURING APPROVAL]`
- Evidence reference: `[TO BE FILLED DURING APPROVAL]`
- Execution owner confirmation: `[TO BE FILLED DURING APPROVAL]`
- Rollback owner confirmation: `[TO BE FILLED DURING APPROVAL]`

