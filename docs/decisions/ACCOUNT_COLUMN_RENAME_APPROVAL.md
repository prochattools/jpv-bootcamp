# Account Column Rename Approval

- Decision ID: `account-column-rename`
- Current status: `AWAITING_APPROVAL`
- Decision owner role: `Platform owner`
- Approver role: `Database owner`
- Implementation owner role: `Migration operator`
- Rollback owner role: `Database rollback owner`
- Classification: `external`
- Release impact: `Blocks staging migration approval and formal go/no-go.`
- Depends on: `none`
- Required evidence summary: `docs/client/MIGRATION_APPROVAL_PACKET.md`, `prisma/migrations/20260707_120000_rename_account_identity_columns/migration.sql`, `prisma/system.prisma`, and `prisma/schema.prisma`

## Current state

- Exact schema paths:
  - `prisma/system.prisma`
  - `prisma/schema.prisma`
- Exact reviewed migration:
  - `prisma/migrations/20260707_120000_rename_account_identity_columns/migration.sql`
- Current canonical application naming:
  - `accountId`
  - `accountEmailHash`
  - `accountName`
  - `claimedByAccountId`
  - `reviewedByAccountId`
- Exact usage examples:
  - `src/lib/partners-handoff-token.ts` uses `account_id`, `account_email`, and `account_name`
  - Payload/Prisma schemas already point to neutral account-owned names
- Ownership:
  - runtime has already adopted neutral naming;
  - the reviewed Prisma migration exists only to rename old database columns and indexes without dropping data.

## Options

### Option A — no rename

- Migration impact: the reviewed Prisma rename migration must not be applied.
- Runtime compatibility: runtime stays on neutral names, but old database column names remain unresolved.
- Rollback safety: simplest operationally, but blocks schema alignment.
- Deployment sequencing: no migration step.
- Data backfill: none.
- Generated types: unchanged.
- API compatibility: unchanged in code; database naming divergence remains.
- Auth/account risk: medium, because schema/runtime drift persists.
- Test impact: readiness remains blocked.
- Operator complexity: medium.
- Repository evidence-based recommendation: not recommended because current schemas already assume neutral names.

### Option B — additive new column with dual-read/dual-write transition

- Migration impact: requires new migration work not present in the repository.
- Runtime compatibility: would need new dual-read/dual-write code.
- Rollback safety: potentially strong, but broader and out of scope for current staging approval.
- Deployment sequencing: multi-step rollout.
- Data backfill: required.
- Generated types: would need another schema/type update.
- API compatibility: would need explicit transitional rules.
- Auth/account risk: high, because this introduces new application behavior.
- Test impact: extensive.
- Operator complexity: high.
- Repository evidence-based recommendation: not justified by current code; it broadens scope.

### Option C — direct rename migration

- Migration impact: matches the reviewed Prisma migration already present in the branch.
- Runtime compatibility: aligns existing neutral runtime names with database column names.
- Rollback safety: reviewed migration uses existence checks and index recreation boundaries.
- Deployment sequencing: can remain within the approved migration window and rollback plan.
- Data backfill: none if rename succeeds as designed.
- Generated types: already aligned with neutral names.
- API compatibility: runtime serializers already use neutral names.
- Auth/account risk: medium; approval is still required because the database shape changes.
- Test impact: current readiness/migration/static coverage already expects this approach.
- Operator complexity: medium.
- Repository evidence-based recommendation: this is the currently prepared repository path, but approval is still external.

### Option D — view/alias compatibility approach

- Migration impact: requires database objects not represented in the current reviewed migration.
- Runtime compatibility: could preserve old column names temporarily.
- Rollback safety: unclear without additional DB-specific design.
- Deployment sequencing: more complex than the reviewed rename.
- Data backfill: possibly none.
- Generated types: unchanged in runtime.
- API compatibility: potentially safe, but DB-specific.
- Auth/account risk: medium-high.
- Test impact: new static safety coverage required.
- Operator complexity: high.
- Repository evidence-based recommendation: not supported by current repository evidence.

### Option E — application-layer naming only

- Migration impact: no rename occurs.
- Runtime compatibility: current code keeps neutral names, but database objects stay legacy-named.
- Rollback safety: no migration risk.
- Deployment sequencing: no migration.
- Data backfill: none.
- Generated types: unchanged.
- API compatibility: unchanged.
- Auth/account risk: medium, because the database layer remains legacy-shaped.
- Test impact: readiness remains blocked.
- Operator complexity: low-medium.
- Repository evidence-based recommendation: viable only if the DB rename is explicitly rejected.

## Current repository consequence while unresolved

- Neutral runtime naming remains canonical.
- No additional rename implementation is authorized from this packet.
- `pnpm staging:decision-readiness` must keep migration approval blocked while this decision is unresolved.

## Approval record

- Approval decision: `[TO BE FILLED DURING APPROVAL]`
- Selected option: `[TO BE FILLED DURING APPROVAL]`
- Approved / rejected by: `[TO BE FILLED DURING APPROVAL]`
- Approval timestamp: `[TO BE FILLED DURING APPROVAL]`
- Evidence reference: `[TO BE FILLED DURING APPROVAL]`
- Execution owner confirmation: `[TO BE FILLED DURING APPROVAL]`
- Rollback owner confirmation: `[TO BE FILLED DURING APPROVAL]`

