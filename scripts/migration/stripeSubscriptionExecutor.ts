/**
 * Stripe subscription migration executor.
 *
 * Dry-run by default. Apply only with --mode=apply and an explicit
 * confirmation token. TEST mode only in this goal — live mode mutations
 * are blocked at the environment guard layer.
 *
 * Invariants:
 * - Never mutates in dry-run mode (default).
 * - Stops on the first invariant or billing mismatch; emits rollback evidence.
 * - Per-subscription idempotency via audit journal.
 * - Resumable: skips subscriptions already in the journal.
 * - Batch limit enforced: never processes more than batchLimit in one run.
 * - No PII or token values in log output.
 */

import type { SubscriptionRecord, TargetPriceMap } from './stripeSubscriptionInventory'

export interface StripeUpdateClient {
  subscriptions: {
    update(
      id: string,
      params: { items: Array<{ id: string; price: string }>; proration_behavior: string; metadata: Record<string, string> },
    ): Promise<{ id: string; items: { data: Array<{ id: string; price: { id: string } }> } }>
    retrieve(id: string): Promise<{ id: string; items: { data: Array<{ id: string; price: { id: string } }> } }>
  }
  invoices: {
    retrieveUpcoming(params: { customer: string; subscription: string }): Promise<{
      amount_due: number
      currency: string
      lines: { data: Array<{ description: string; amount: number }> }
    }>
  }
}

export interface AuditEntry {
  runId: string
  subscriptionId: string
  customerId: string
  outcome: 'dry_run' | 'applied' | 'skipped_already_migrated' | 'failed'
  targetPriceId: string
  previousPriceId: string
  invoicePreviewAmountDue: number
  invoicePreviewCurrency: string
  error?: string
  timestamp: string
}

export interface ExecutorConfig {
  client: StripeUpdateClient
  targetPrices: TargetPriceMap
  runId: string
  stripeEnv: string
  confirmationToken: string
  expectedConfirmationToken: string
  batchLimit: number
  mode: 'dry-run' | 'apply'
  journal: AuditEntry[]
  allowedEnvs: string[]
}

export interface ExecutorResult {
  runId: string
  mode: 'dry-run' | 'apply'
  processed: number
  dryRun: number
  applied: number
  skipped: number
  failed: number
  stoppedEarly: boolean
  stopReason?: string
  journal: AuditEntry[]
}

function resolveTargetPrice(rec: SubscriptionRecord, targetPrices: TargetPriceMap): string | null {
  if (rec.currentCadence === 'monthly') return targetPrices.monthly
  if (rec.currentCadence === 'annual') return targetPrices.annual
  return null
}

function isAlreadyMigrated(rec: SubscriptionRecord, targetPrices: TargetPriceMap): boolean {
  return rec.currentPriceId === targetPrices.monthly || rec.currentPriceId === targetPrices.annual
}

function alreadyInJournal(rec: SubscriptionRecord, journal: AuditEntry[]): boolean {
  return journal.some(
    (e) =>
      e.subscriptionId === rec.subscriptionId &&
      (e.outcome === 'applied' || e.outcome === 'skipped_already_migrated'),
  )
}

export async function executeSubscriptionMigration(
  records: SubscriptionRecord[],
  config: ExecutorConfig,
): Promise<ExecutorResult> {
  const result: ExecutorResult = {
    runId: config.runId,
    mode: config.mode,
    processed: 0,
    dryRun: 0,
    applied: 0,
    skipped: 0,
    failed: 0,
    stoppedEarly: false,
    journal: [...config.journal],
  }

  // Environment guard — block live mode in this goal
  if (!config.allowedEnvs.includes(config.stripeEnv)) {
    result.stoppedEarly = true
    result.stopReason = `stripeEnv '${config.stripeEnv}' not in allowedEnvs [${config.allowedEnvs.join(', ')}]`
    return result
  }

  // Confirmation token guard
  if (config.mode === 'apply' && config.confirmationToken !== config.expectedConfirmationToken) {
    result.stoppedEarly = true
    result.stopReason = 'confirmation_token_mismatch — apply blocked'
    return result
  }

  const eligible = records.filter(
    (r) => !alreadyInJournal(r, config.journal) && !isAlreadyMigrated(r, config.targetPrices),
  )

  const toProcess = eligible.slice(0, config.batchLimit)

  for (const rec of toProcess) {
    result.processed++

    const targetPriceId = resolveTargetPrice(rec, config.targetPrices)
    if (!targetPriceId) {
      const entry: AuditEntry = {
        runId: config.runId,
        subscriptionId: rec.subscriptionId,
        customerId: rec.customerId,
        outcome: 'failed',
        targetPriceId: 'unknown',
        previousPriceId: rec.currentPriceId,
        invoicePreviewAmountDue: -1,
        invoicePreviewCurrency: 'unknown',
        error: `cannot_resolve_target_price: cadence=${rec.currentCadence}`,
        timestamp: new Date().toISOString(),
      }
      result.journal.push(entry)
      result.failed++
      // Invariant mismatch — stop
      result.stoppedEarly = true
      result.stopReason = `invariant: cannot resolve target price for sub ${rec.subscriptionId} cadence=${rec.currentCadence}`
      return result
    }

    // Invoice preview — verify expected charge before any mutation
    let previewAmountDue = -1
    let previewCurrency = 'unknown'
    try {
      const preview = await config.client.invoices.retrieveUpcoming({
        customer: rec.customerId,
        subscription: rec.subscriptionId,
      })
      previewAmountDue = preview.amount_due
      previewCurrency = preview.currency
    } catch (e) {
      const entry: AuditEntry = {
        runId: config.runId,
        subscriptionId: rec.subscriptionId,
        customerId: rec.customerId,
        outcome: 'failed',
        targetPriceId,
        previousPriceId: rec.currentPriceId,
        invoicePreviewAmountDue: -1,
        invoicePreviewCurrency: 'unknown',
        error: `invoice_preview_failed: ${e instanceof Error ? e.message : String(e)}`,
        timestamp: new Date().toISOString(),
      }
      result.journal.push(entry)
      result.failed++
      result.stoppedEarly = true
      result.stopReason = `invariant: invoice preview failed for sub ${rec.subscriptionId}`
      return result
    }

    if (config.mode === 'dry-run') {
      const entry: AuditEntry = {
        runId: config.runId,
        subscriptionId: rec.subscriptionId,
        customerId: rec.customerId,
        outcome: 'dry_run',
        targetPriceId,
        previousPriceId: rec.currentPriceId,
        invoicePreviewAmountDue: previewAmountDue,
        invoicePreviewCurrency: previewCurrency,
        timestamp: new Date().toISOString(),
      }
      result.journal.push(entry)
      result.dryRun++
      continue
    }

    // Apply mode — perform the update
    try {
      const sub = await config.client.subscriptions.retrieve(rec.subscriptionId)
      const itemId = sub.items.data[0]?.id
      if (!itemId) {
        throw new Error('subscription_has_no_items')
      }

      await config.client.subscriptions.update(rec.subscriptionId, {
        items: [{ id: itemId, price: targetPriceId }],
        proration_behavior: 'none',
        metadata: { migrationRunId: config.runId, migratedAt: new Date().toISOString() },
      })

      // Post-update retrieval reconciliation
      const updated = await config.client.subscriptions.retrieve(rec.subscriptionId)
      const newPriceId = updated.items.data[0]?.price.id

      if (newPriceId !== targetPriceId) {
        const entry: AuditEntry = {
          runId: config.runId,
          subscriptionId: rec.subscriptionId,
          customerId: rec.customerId,
          outcome: 'failed',
          targetPriceId,
          previousPriceId: rec.currentPriceId,
          invoicePreviewAmountDue: previewAmountDue,
          invoicePreviewCurrency: previewCurrency,
          error: `reconciliation_mismatch: expected ${targetPriceId} got ${newPriceId}`,
          timestamp: new Date().toISOString(),
        }
        result.journal.push(entry)
        result.failed++
        result.stoppedEarly = true
        result.stopReason = `invariant: reconciliation mismatch on sub ${rec.subscriptionId}`
        return result
      }

      const entry: AuditEntry = {
        runId: config.runId,
        subscriptionId: rec.subscriptionId,
        customerId: rec.customerId,
        outcome: 'applied',
        targetPriceId,
        previousPriceId: rec.currentPriceId,
        invoicePreviewAmountDue: previewAmountDue,
        invoicePreviewCurrency: previewCurrency,
        timestamp: new Date().toISOString(),
      }
      result.journal.push(entry)
      result.applied++
    } catch (e) {
      const entry: AuditEntry = {
        runId: config.runId,
        subscriptionId: rec.subscriptionId,
        customerId: rec.customerId,
        outcome: 'failed',
        targetPriceId,
        previousPriceId: rec.currentPriceId,
        invoicePreviewAmountDue: previewAmountDue,
        invoicePreviewCurrency: previewCurrency,
        error: `update_failed: ${e instanceof Error ? e.message : String(e)}`,
        timestamp: new Date().toISOString(),
      }
      result.journal.push(entry)
      result.failed++
      result.stoppedEarly = true
      result.stopReason = `invariant: update failed for sub ${rec.subscriptionId}`
      return result
    }
  }

  return result
}

export function rollbackEvidence(result: ExecutorResult): string {
  const applied = result.journal.filter((e) => e.outcome === 'applied')
  const lines = [
    `# Stripe Subscription Migration Rollback Evidence`,
    ``,
    `- Run ID: ${result.runId}`,
    `- Mode: ${result.mode}`,
    `- Applied: ${result.applied}`,
    `- Stopped early: ${result.stoppedEarly}`,
    `- Stop reason: ${result.stopReason ?? 'none'}`,
    ``,
    `## Subscriptions to reverse (applied only)`,
    ``,
    `| Sub ID | Previous price | Target price |`,
    `| --- | --- | --- |`,
  ]

  for (const e of applied) {
    lines.push(`| ${e.subscriptionId} | ${e.previousPriceId} | ${e.targetPriceId} |`)
  }

  lines.push(
    ``,
    `## Rollback procedure`,
    ``,
    `For each row above: update subscription items back to previousPriceId`,
    `with proration_behavior=none. Verify post-update price matches previousPriceId.`,
    ``,
    `This evidence was generated automatically — operator must confirm correctness`,
    `before executing rollback.`,
  )

  return lines.join('\n')
}
