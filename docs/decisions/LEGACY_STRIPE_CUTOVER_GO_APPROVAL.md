# Legacy Stripe Cutover GO Approval

- Decision ID: `legacy-stripe-cutover-go`
- Current status: `PENDING`
- Depends on: `production-launch-go` (platform must be live first)
- Gate tier: `LEGACY_STRIPE_CUTOVER_GO` (post-launch; migrates existing Stripe subscriptions to new price IDs)

## Purpose

LEGACY_STRIPE_CUTOVER_GO certifies that existing Stripe subscribers have been
safely migrated to the new JPV Bootcamp Membership price IDs. This is a
separate post-launch gate — new sign-ups are unaffected and can proceed
before this gate.

The executor (`scripts/migration/stripeSubscriptionExecutor.ts`) is dry-run
by default. Live mutations require an explicit confirmation token, TEST-mode
Stripe pilot, then a separate LIVE-mode authorization.

## Required fields before LEGACY_STRIPE_CUTOVER_GO

### Inventory
- [ ] Real read-only Stripe inventory run completed (DI client, TEST mode first)
- [ ] Total subscription count: `[TO BE FILLED]`
- [ ] Eligible (monthly): `[TO BE FILLED]`
- [ ] Eligible (annual): `[TO BE FILLED]`
- [ ] Manual review: `[TO BE FILLED — requires operator decision per record]`
- [ ] Ineligible/excluded: `[TO BE FILLED — reasons listed]`

### Approved mappings
- [ ] Source price ID(s) for monthly: `[TO BE FILLED]`
- [ ] Target price ID monthly (`STRIPE_PRICE_MONTHLY_LIVE`): `[TO BE FILLED]`
- [ ] Source price ID(s) for annual: `[TO BE FILLED]`
- [ ] Target price ID annual (`STRIPE_PRICE_ANNUALLY_LIVE`): `[TO BE FILLED]`
- [ ] Excluded customer IDs or reasons: `[TO BE FILLED — ambiguous/past-due/disputed/multi-item]`
- [ ] Client approval of mappings: `[TO BE FILLED]`

### Invoice preview evidence
- [ ] Dry-run invoice previews reviewed for all eligible subscriptions
- [ ] No unexpected charges flagged
- [ ] Preview report path: `[TO BE FILLED]`

### Executor configuration
- [ ] `allowedEnvs` restricted to `['test']` for pilot; `['live']` only after separate authorization
- [ ] Confirmation token issued: `[TO BE FILLED — never store in git]`
- [ ] Batch limit: `[TO BE FILLED — start with 1-2 for pilot]`
- [ ] Audit journal path: `[TO BE FILLED]`

### Pilot (1–2 subscriptions, TEST mode)
- [ ] TEST-mode pilot completed: `[TO BE FILLED]`
- [ ] Reconciliation confirmed: `[TO BE FILLED]`
- [ ] Rollback evidence from pilot: `[TO BE FILLED]`

### Live-mode authorization (separate approval required)
- [ ] Separate explicit LIVE-mode authorization: `[MUST NOT be assumed from TEST pilot]`
- [ ] Live batch limit: `[TO BE FILLED]`
- [ ] Monitoring owner during cutover: `[TO BE FILLED]`
- [ ] Rollback owner: `[TO BE FILLED]`
- [ ] Abort threshold: `[TO BE FILLED]`

## Executor module

- Inventory: `scripts/migration/stripeSubscriptionInventory.ts`
- Executor: `scripts/migration/stripeSubscriptionExecutor.ts`
- Tests: `scripts/migration/stripeSubscriptionMigration.test.ts` (24/24 PASS)

Tests cover: classification, DI inventory fetch, dry-run (no mutations),
confirmation token guard, env allowlist guard, idempotency, batch limit,
invoice preview failure stops run, reconciliation mismatch stops run,
rollback evidence document generation.

## Current status

The executor and inventory are built and test-verified. No live Stripe calls
have been made. Real inventory requires:
1. Operator provides `STRIPE_SECRET_KEY_TEST` (or LIVE after authorization)
2. Run `STAGING_MEMBER_EMAIL=... npx tsx scripts/migration/stripeSubscriptionInventory.ts --mode=inventory`
3. Review redacted report (no PII in output)
4. Obtain client approval on mappings and exclusions
5. Then proceed to dry-run executor with batch limit = 1

## LEGACY_STRIPE_CUTOVER_GO decision

- GO: `[REQUIRES: inventory reviewed, mappings approved, dry-run complete, TEST pilot complete, separate LIVE authorization]`
- NO-GO: `Current default`
