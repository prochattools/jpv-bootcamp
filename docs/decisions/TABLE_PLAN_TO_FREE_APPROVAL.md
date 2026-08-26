# Table Plan to Free Approval

- Decision ID: `table-plan-to-free`
- Current status: `AWAITING_APPROVAL`
- Decision owner role: `Platform owner`
- Approver role: `JPV Bootcamp business owner`
- Implementation owner role: `Migration operator`
- Rollback owner role: `Release rollback owner`
- Classification: `external`
- Release impact: `Blocks staging migration approval and formal go/no-go.`
- Depends on: `none`
- Required evidence summary: `docs/client/MIGRATION_APPROVAL_PACKET.md`, `src/migrations/20260707_130000_remove_table_plan_from_payload_enums.ts`, and `scripts/migration_readiness_static.test.ts`

## Context

- Current plan model: runtime treats `free` as controlled non-paid access and `pro` as the only paid subscription.
- Current data source: the reviewed Payload enum migration is `src/migrations/20260707_130000_remove_table_plan_from_payload_enums.ts`.
- Current entitlement behavior: `src/lib/plans.ts` normalizes only `pro`; non-Pro legacy values do not resolve to an active paid plan.
- Current billing behavior: `src/lib/stripe-checkout-config.ts` accepts only `plan=pro` with `billing=monthly|annual`.
- Current UI labels: active plan/billing copy is Free/Pro only; no table/exhibitor public offer remains.
- Current tests: `scripts/migration_readiness_static.test.ts`, `scripts/member_checkout.test.ts`, `scripts/billing_readiness_report.test.ts`, and `scripts/payload_entitlement_evaluator.test.ts`.

## Decision options

### Option A — map the existing table-plan value to canonical Free

- Runtime impact: preserves Free/Pro-only runtime behavior.
- Billing impact: no third paid checkout path returns.
- Stripe impact: no new product or price lookup is required.
- Entitlement impact: legacy table-plan records become controlled Free access.
- Portal UI impact: no new member-facing tier copy is introduced.
- Migration/data impact: matches the existing reviewed Payload enum migration.
- Backwards compatibility: historical records remain represented, but no longer as a paid plan.
- Reporting impact: historical reporting must treat legacy table-plan records as migrated-to-Free.
- Test changes: retain static migration/readiness coverage and no-third-plan checks.
- Rollback path: use the reviewed down migration or restore-based rollback only through the approved migration path.
- Risk level: medium, because it changes business meaning at data level.
- Repository evidence-based recommendation: this is the currently implemented migration intent, but it still requires explicit business approval.

### Option B — preserve the existing plan value as a separate legacy/internal tier

- Runtime impact: would require reintroducing non-Free/non-Pro plan handling or dual semantics.
- Billing impact: risks recreating a hidden third membership state.
- Stripe impact: may require legacy product interpretation or operator-only handling.
- Entitlement impact: ongoing dual-plan logic would need new tests and UI explanations.
- Portal UI impact: operator-only or legacy labels would need hard boundaries.
- Migration/data impact: current reviewed Payload enum narrowing would need revision before execution.
- Backwards compatibility: preserves historical distinction but increases long-term complexity.
- Reporting impact: legacy-tier analytics stay distinct.
- Test changes: plan normalization, billing readiness, and entitlement suites would need expansion.
- Rollback path: pause migration approval, revert to pre-approval state, and rewrite the migration plan.
- Risk level: high.
- Repository evidence-based recommendation: not preferred; it contradicts the Free/Pro refit and would require new implementation work.

### Option C — migrate or normalize existing records through an approved data step

- Runtime impact: runtime remains Free/Pro only, but a separate approved data operation could prepare records before the reviewed migration.
- Billing impact: public billing remains unchanged.
- Stripe impact: no public product change, but staging migration sequencing becomes more complex.
- Entitlement impact: depends on the approved mapping rules.
- Portal UI impact: unchanged if the data step lands before public use.
- Migration/data impact: requires a new approved migration or operator-owned data step beyond the current repository state.
- Backwards compatibility: can be safer for audit/reporting if the business needs explicit intermediate evidence.
- Reporting impact: can preserve a clearer audit trail.
- Test changes: new static validation and migration evidence tests would be required before execution.
- Rollback path: restore-based rollback plus any approved intermediate data-step rollback.
- Risk level: medium-high.
- Repository evidence-based recommendation: only use if the business rejects direct mapping but still wants Free/Pro runtime truth.

### Option D — reject the change

- Runtime impact: repository/runtime would remain out of alignment with target business rules.
- Billing impact: staging migration approval remains blocked.
- Stripe impact: none immediately.
- Entitlement impact: legacy table-plan data cannot be resolved through the reviewed target model.
- Portal UI impact: none immediately.
- Migration/data impact: the reviewed Payload enum migration must not be applied.
- Backwards compatibility: preserves pre-migration ambiguity.
- Reporting impact: unresolved legacy semantics remain.
- Test changes: readiness docs and blockers stay pending.
- Rollback path: no migration action occurs.
- Risk level: medium.
- Repository evidence-based recommendation: valid only if the target business rule changes; otherwise it blocks launch.

## Current repository consequence while unresolved

- `pnpm staging:decision-readiness` must continue to report this item as awaiting external approval.
- `docs/PREVIEW_RELEASE_READINESS.md` and `docs/client/OPERATOR_HANDOFF_SUMMARY.md` must continue to show release `NO-GO`.
- No migration or data mapping is executed from this record.

## Approval record

- Approval decision: `[TO BE FILLED DURING APPROVAL]`
- Selected option: `[TO BE FILLED DURING APPROVAL]`
- Approved / rejected by: `[TO BE FILLED DURING APPROVAL]`
- Approval timestamp: `[TO BE FILLED DURING APPROVAL]`
- Evidence reference: `[TO BE FILLED DURING APPROVAL]`
- Execution owner confirmation: `[TO BE FILLED DURING APPROVAL]`
- Rollback owner confirmation: `[TO BE FILLED DURING APPROVAL]`

