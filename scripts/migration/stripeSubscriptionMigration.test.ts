/**
 * Contract and fake tests for Stripe subscription inventory and executor.
 * No real Stripe calls — all tests use injected fakes.
 * Covers: classification, inventory fetch, dry-run, apply, idempotency,
 * batch limit, env guard, confirmation token, reconciliation mismatch,
 * invoice preview failure, rollback evidence, and resume.
 */

import assert from 'node:assert/strict'

import {
  fetchInventory,
  buildReport,
  redactedReportMarkdown,
  type SubscriptionRecord,
  type RawSubscription,
  type InventoryConfig,
} from './stripeSubscriptionInventory'

import {
  executeSubscriptionMigration,
  rollbackEvidence,
  type AuditEntry,
  type ExecutorConfig,
  type StripeUpdateClient,
} from './stripeSubscriptionExecutor'

// ─── Shared fakes ──────────────────────────────────────────────────────────

const TARGET_PRICES = {
  monthly: 'price_new_monthly',
  annual: 'price_new_annual',
  allowedProducts: ['prod_jpv'],
}

function makeRaw(overrides: Partial<RawSubscription> = {}): RawSubscription {
  return {
    id: 'sub_001',
    customer: 'cus_001',
    status: 'active',
    items: {
      data: [
        {
          price: { id: 'price_legacy_monthly', recurring: { interval: 'month' } },
          quantity: 1,
        },
      ],
    },
    current_period_start: 1720000000,
    current_period_end: 1722592000,
    cancel_at_period_end: false,
    canceled_at: null,
    schedule: null,
    latest_invoice: null,
    metadata: { memberId: 'member-001' },
    discount: null,
    default_payment_method: 'pm_001',
    ...overrides,
  }
}

function makeRecord(overrides: Partial<SubscriptionRecord> = {}): SubscriptionRecord {
  return {
    subscriptionId: 'sub_001',
    customerId: 'cus_001',
    memberId: 'member-001',
    currentPriceId: 'price_legacy_monthly',
    currentCadence: 'monthly',
    subscriptionStatus: 'active',
    paymentStatus: 'active',
    disputeState: 'none',
    cancellationState: 'none',
    scheduleState: 'none',
    itemCount: 1,
    meteredState: 'none',
    identityStatus: 'complete',
    ...overrides,
  }
}

function makeUpdateClient(overrides: Partial<StripeUpdateClient> = {}): StripeUpdateClient {
  return {
    subscriptions: {
      update: async (_id, _params) => ({
        id: _id,
        items: { data: [{ id: 'si_001', price: { id: _params.items[0].price } }] },
      }),
      retrieve: async (id) => ({
        id,
        items: { data: [{ id: 'si_001', price: { id: TARGET_PRICES.monthly } }] },
      }),
    },
    invoices: {
      retrieveUpcoming: async () => ({
        amount_due: 8000,
        currency: 'gbp',
        lines: { data: [] },
      }),
    },
    ...overrides,
  }
}

function makeExecutorConfig(overrides: Partial<ExecutorConfig> = {}): ExecutorConfig {
  return {
    client: makeUpdateClient(),
    targetPrices: TARGET_PRICES,
    runId: 'test_run_001',
    stripeEnv: 'test',
    confirmationToken: 'confirm_abc123',
    expectedConfirmationToken: 'confirm_abc123',
    batchLimit: 50,
    mode: 'dry-run',
    journal: [],
    allowedEnvs: ['test'],
    ...overrides,
  }
}

// ─── Inventory tests ────────────────────────────────────────────────────────

async function testInventoryFetchBasic() {
  const rawSub = makeRaw()
  const fakeClient = {
    subscriptions: {
      list: async () => ({ data: [rawSub], has_more: false }),
    },
    invoices: { retrieveUpcoming: async () => ({ amount_due: 0, currency: 'gbp' }) },
  }
  const config: InventoryConfig = {
    client: fakeClient as never,
    targetPrices: TARGET_PRICES,
    accountAllowlist: [],
    maxSubscriptions: 100,
  }
  const records = await fetchInventory(config)
  assert.equal(records.length, 1, 'Should fetch one subscription')
  assert.equal(records[0].subscriptionId, 'sub_001')
  assert.equal(records[0].currentCadence, 'monthly')
  assert.equal(records[0].identityStatus, 'complete')
}

async function testInventoryFetchAccountAllowlist() {
  const raw1 = makeRaw({ id: 'sub_001', customer: 'cus_001' })
  const raw2 = makeRaw({ id: 'sub_002', customer: 'cus_002' })
  const fakeClient = {
    subscriptions: {
      list: async () => ({ data: [raw1, raw2], has_more: false }),
    },
    invoices: { retrieveUpcoming: async () => ({ amount_due: 0, currency: 'gbp' }) },
  }
  const config: InventoryConfig = {
    client: fakeClient as never,
    targetPrices: TARGET_PRICES,
    accountAllowlist: ['cus_001'],
    maxSubscriptions: 100,
  }
  const records = await fetchInventory(config)
  assert.equal(records.length, 1, 'Should filter by allowlist')
  assert.equal(records[0].customerId, 'cus_001')
}

async function testInventoryPagination() {
  let page = 0
  const fakeClient = {
    subscriptions: {
      list: async (params: { starting_after?: string }) => {
        page++
        if (page === 1) {
          return {
            data: [makeRaw({ id: 'sub_p1' })],
            has_more: true,
          }
        }
        return { data: [makeRaw({ id: 'sub_p2' })], has_more: false }
      },
    },
    invoices: { retrieveUpcoming: async () => ({ amount_due: 0, currency: 'gbp' }) },
  }
  const config: InventoryConfig = {
    client: fakeClient as never,
    targetPrices: TARGET_PRICES,
    accountAllowlist: [],
    maxSubscriptions: 100,
  }
  const records = await fetchInventory(config)
  assert.equal(records.length, 2, 'Should paginate and collect all records')
}

function testBuildReport() {
  const records: SubscriptionRecord[] = [
    makeRecord(),
    makeRecord({ subscriptionId: 'sub_002', identityStatus: 'incomplete' }),
    makeRecord({ subscriptionId: 'sub_003', paymentStatus: 'past_due' }),
  ]
  const report = buildReport('run_001', 'test', records)
  assert.equal(report.eligible.length, 1, 'One eligible')
  assert.equal(report.manualReview.length, 1, 'One manual review (past_due)')
  assert.equal(report.ineligible.length, 1, 'One ineligible (identity incomplete)')
  assert.equal(report.totalFetched, 3)
}

function testRedactedReport() {
  const records = [makeRecord()]
  const report = buildReport('run_001', 'test', records)
  const md = redactedReportMarkdown(report)
  assert.ok(md.includes('# Stripe Subscription Inventory'), 'Has heading')
  assert.ok(md.includes('run_001'), 'Has run ID')
  assert.ok(!md.includes('cus_001'), 'No customer IDs in report')
  assert.ok(!md.includes('member-001'), 'No member IDs in report')
}

// ─── Classification tests ────────────────────────────────────────────────────

function testClassifyIneligibleDispute() {
  const records = [makeRecord({ disputeState: 'open' })]
  const report = buildReport('r', 'test', records)
  assert.equal(report.ineligible.length, 1)
}

function testClassifyIneligibleMissingIdentity() {
  const records = [makeRecord({ identityStatus: 'incomplete' })]
  const report = buildReport('r', 'test', records)
  assert.equal(report.ineligible.length, 1)
}

function testClassifyIneligibleMultiItem() {
  const records = [makeRecord({ itemCount: 3 })]
  const report = buildReport('r', 'test', records)
  assert.equal(report.ineligible.length, 1)
}

function testClassifyManualReviewPastDue() {
  const records = [makeRecord({ paymentStatus: 'past_due' })]
  const report = buildReport('r', 'test', records)
  assert.equal(report.manualReview.length, 1)
}

function testClassifyManualReviewScheduledCancellation() {
  const records = [makeRecord({ cancellationState: 'scheduled' })]
  const report = buildReport('r', 'test', records)
  assert.equal(report.manualReview.length, 1)
}

function testClassifyIneligibleEffectiveCancellation() {
  const records = [makeRecord({ cancellationState: 'effective' })]
  const report = buildReport('r', 'test', records)
  assert.equal(report.ineligible.length, 1)
}

// ─── Executor tests ──────────────────────────────────────────────────────────

async function testDryRunProducesNoCalls() {
  const calls: string[] = []
  const client = makeUpdateClient({
    subscriptions: {
      update: async (id) => { calls.push('update:' + id); return { id, items: { data: [] } } },
      retrieve: async (id) => { calls.push('retrieve:' + id); return { id, items: { data: [{ id: 'si_001', price: { id: TARGET_PRICES.monthly } }] } } },
    },
  })
  const config = makeExecutorConfig({ client, mode: 'dry-run' })
  const result = await executeSubscriptionMigration([makeRecord()], config)
  assert.equal(result.dryRun, 1, 'Should record dry-run')
  assert.equal(result.applied, 0, 'Should not apply')
  assert.ok(!calls.some((c) => c.startsWith('update:')), 'Must not call update in dry-run')
}

async function testDryRunJournalEntry() {
  const config = makeExecutorConfig({ mode: 'dry-run' })
  const result = await executeSubscriptionMigration([makeRecord()], config)
  assert.equal(result.journal.length, 1)
  assert.equal(result.journal[0].outcome, 'dry_run')
  assert.equal(result.journal[0].targetPriceId, TARGET_PRICES.monthly)
  assert.equal(result.journal[0].previousPriceId, 'price_legacy_monthly')
}

async function testApplyRequiresConfirmationToken() {
  const config = makeExecutorConfig({
    mode: 'apply',
    confirmationToken: 'wrong_token',
    expectedConfirmationToken: 'correct_token',
  })
  const result = await executeSubscriptionMigration([makeRecord()], config)
  assert.ok(result.stoppedEarly, 'Should stop early on bad token')
  assert.ok(result.stopReason?.includes('confirmation_token_mismatch'))
  assert.equal(result.applied, 0)
}

async function testApplyBlockedInLiveEnv() {
  const config = makeExecutorConfig({
    mode: 'apply',
    stripeEnv: 'live',
    allowedEnvs: ['test'],
  })
  const result = await executeSubscriptionMigration([makeRecord()], config)
  assert.ok(result.stoppedEarly)
  assert.ok(result.stopReason?.includes('not in allowedEnvs'))
}

async function testApplySuccess() {
  const config = makeExecutorConfig({ mode: 'apply' })
  const result = await executeSubscriptionMigration([makeRecord()], config)
  assert.equal(result.applied, 1)
  assert.equal(result.failed, 0)
  assert.ok(!result.stoppedEarly)
  assert.equal(result.journal[0].outcome, 'applied')
}

async function testIdempotency() {
  const existingJournal: AuditEntry[] = [
    {
      runId: 'prior_run',
      subscriptionId: 'sub_001',
      customerId: 'cus_001',
      outcome: 'applied',
      targetPriceId: TARGET_PRICES.monthly,
      previousPriceId: 'price_legacy_monthly',
      invoicePreviewAmountDue: 8000,
      invoicePreviewCurrency: 'gbp',
      timestamp: new Date().toISOString(),
    },
  ]
  const config = makeExecutorConfig({ mode: 'apply', journal: existingJournal })
  const result = await executeSubscriptionMigration([makeRecord()], config)
  assert.equal(result.applied, 0, 'Should skip already-applied subscription')
  assert.equal(result.skipped, 0, 'Idempotency skips before processing')
}

async function testBatchLimit() {
  const records = Array.from({ length: 10 }, (_, i) =>
    makeRecord({ subscriptionId: `sub_00${i}`, customerId: `cus_00${i}` }),
  )
  const config = makeExecutorConfig({ mode: 'dry-run', batchLimit: 3 })
  const result = await executeSubscriptionMigration(records, config)
  assert.equal(result.dryRun, 3, 'Should respect batch limit')
}

async function testInvoicePreviewFailureStops() {
  const client = makeUpdateClient({
    invoices: {
      retrieveUpcoming: async () => { throw new Error('invoice_preview_timeout') },
    },
  })
  const config = makeExecutorConfig({ client, mode: 'apply' })
  const result = await executeSubscriptionMigration([makeRecord()], config)
  assert.ok(result.stoppedEarly, 'Should stop on invoice preview failure')
  assert.equal(result.failed, 1)
  assert.ok(result.journal[0].error?.includes('invoice_preview_failed'))
}

async function testReconciliationMismatchStops() {
  const client = makeUpdateClient({
    subscriptions: {
      update: async (id, params) => ({
        id,
        items: { data: [{ id: 'si_001', price: { id: params.items[0].price } }] },
      }),
      retrieve: async (id) => ({
        id,
        // Simulate wrong price returned after update
        items: { data: [{ id: 'si_001', price: { id: 'price_unexpected' } }] },
      }),
    },
  })
  const config = makeExecutorConfig({ client, mode: 'apply' })
  const result = await executeSubscriptionMigration([makeRecord()], config)
  assert.ok(result.stoppedEarly, 'Should stop on reconciliation mismatch')
  assert.ok(result.journal[0].error?.includes('reconciliation_mismatch'))
}

async function testUnknownCadenceStops() {
  const config = makeExecutorConfig({ mode: 'apply' })
  const result = await executeSubscriptionMigration(
    [makeRecord({ currentCadence: 'unknown' })],
    config,
  )
  // unknown cadence → manual_review via buildReport, but executor still stops
  assert.ok(result.stoppedEarly, 'Should stop on unknown cadence in apply mode')
  assert.equal(result.failed, 1)
}

async function testSkipsAlreadyMigrated() {
  const alreadyMigratedRecord = makeRecord({ currentPriceId: TARGET_PRICES.monthly })
  const config = makeExecutorConfig({ mode: 'dry-run' })
  const result = await executeSubscriptionMigration([alreadyMigratedRecord], config)
  assert.equal(result.dryRun, 0, 'Should skip already-migrated subscriptions')
  assert.equal(result.processed, 0)
}

async function testResumeFromJournal() {
  const existingJournal: AuditEntry[] = [
    {
      runId: 'run_001',
      subscriptionId: 'sub_001',
      customerId: 'cus_001',
      outcome: 'applied',
      targetPriceId: TARGET_PRICES.monthly,
      previousPriceId: 'price_legacy_monthly',
      invoicePreviewAmountDue: 8000,
      invoicePreviewCurrency: 'gbp',
      timestamp: new Date().toISOString(),
    },
  ]
  const records = [
    makeRecord({ subscriptionId: 'sub_001' }),
    makeRecord({ subscriptionId: 'sub_002', customerId: 'cus_002' }),
  ]
  const config = makeExecutorConfig({ mode: 'dry-run', journal: existingJournal })
  const result = await executeSubscriptionMigration(records, config)
  assert.equal(result.dryRun, 1, 'Should only process sub_002 (sub_001 already journaled)')
}

function testRollbackEvidence() {
  const journal: AuditEntry[] = [
    {
      runId: 'run_001',
      subscriptionId: 'sub_001',
      customerId: 'cus_001',
      outcome: 'applied',
      targetPriceId: TARGET_PRICES.monthly,
      previousPriceId: 'price_legacy_monthly',
      invoicePreviewAmountDue: 8000,
      invoicePreviewCurrency: 'gbp',
      timestamp: new Date().toISOString(),
    },
  ]
  const evidence = rollbackEvidence({
    runId: 'run_001',
    mode: 'apply',
    processed: 1,
    dryRun: 0,
    applied: 1,
    skipped: 0,
    failed: 0,
    stoppedEarly: false,
    journal,
  })
  assert.ok(evidence.includes('run_001'), 'Has run ID')
  assert.ok(evidence.includes('sub_001'), 'Has subscription ID')
  assert.ok(evidence.includes('price_legacy_monthly'), 'Has previous price')
  assert.ok(evidence.includes(TARGET_PRICES.monthly), 'Has target price')
  assert.ok(evidence.includes('operator must confirm'), 'Has safety warning')
}

// ─── Runner ─────────────────────────────────────────────────────────────────

const tests = [
  { name: 'inventory: basic fetch', fn: testInventoryFetchBasic },
  { name: 'inventory: account allowlist filter', fn: testInventoryFetchAccountAllowlist },
  { name: 'inventory: pagination', fn: testInventoryPagination },
  { name: 'inventory: build report cohorts', fn: testBuildReport },
  { name: 'inventory: redacted markdown has no PII', fn: testRedactedReport },
  { name: 'classify: ineligible dispute', fn: testClassifyIneligibleDispute },
  { name: 'classify: ineligible missing identity', fn: testClassifyIneligibleMissingIdentity },
  { name: 'classify: ineligible multi-item', fn: testClassifyIneligibleMultiItem },
  { name: 'classify: manual review past due', fn: testClassifyManualReviewPastDue },
  { name: 'classify: manual review scheduled cancellation', fn: testClassifyManualReviewScheduledCancellation },
  { name: 'classify: ineligible effective cancellation', fn: testClassifyIneligibleEffectiveCancellation },
  { name: 'executor: dry-run produces no mutations', fn: testDryRunProducesNoCalls },
  { name: 'executor: dry-run journal entry', fn: testDryRunJournalEntry },
  { name: 'executor: apply requires confirmation token', fn: testApplyRequiresConfirmationToken },
  { name: 'executor: apply blocked in live env', fn: testApplyBlockedInLiveEnv },
  { name: 'executor: apply success with reconciliation', fn: testApplySuccess },
  { name: 'executor: idempotency skips already-applied', fn: testIdempotency },
  { name: 'executor: batch limit enforced', fn: testBatchLimit },
  { name: 'executor: invoice preview failure stops run', fn: testInvoicePreviewFailureStops },
  { name: 'executor: reconciliation mismatch stops run', fn: testReconciliationMismatchStops },
  { name: 'executor: unknown cadence stops run', fn: testUnknownCadenceStops },
  { name: 'executor: skips already-migrated subscriptions', fn: testSkipsAlreadyMigrated },
  { name: 'executor: resume skips journaled entries', fn: testResumeFromJournal },
  { name: 'executor: rollback evidence document', fn: testRollbackEvidence },
]

async function runTests() {
  let passed = 0
  let failed = 0
  const errors: string[] = []

  for (const t of tests) {
    try {
      await t.fn()
      console.log(`✓ ${t.name}`)
      passed++
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.log(`✗ ${t.name}: ${msg}`)
      errors.push(`${t.name}: ${msg}`)
      failed++
    }
  }

  console.log(`\n─────────────────────────────────────────`)
  console.log(`Stripe Migration Tests: ${passed} passed, ${failed} failed`)
  console.log(`─────────────────────────────────────────`)

  if (errors.length > 0) {
    console.log('\nErrors:')
    for (const err of errors) console.log(`  - ${err}`)
    process.exit(1)
  }
}

runTests()
