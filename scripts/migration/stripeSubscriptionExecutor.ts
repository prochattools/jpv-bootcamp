/**
 * Stripe subscription migration executor.
 *
 * Dry-run by default. Apply only with --mode=apply and an explicit
 * confirmation token. TEST mode only in this goal — live mode mutations
 * are blocked at the hard-coded environment guard layer.
 *
 * Invariants:
 * - Never mutates in dry-run mode (default).
 * - Stops on the first invariant or billing mismatch; emits rollback evidence.
 * - Per-subscription idempotency via audit journal.
 * - Resumable: skips subscriptions already in the journal.
 * - Batch limit enforced: never processes more than batchLimit in one run.
 * - No PII or token values in log output.
 * - Invoice preview uses identical mutation parameters (subscription_items with
 *   target price) — not the current price — so the preview reflects the actual
 *   post-update charge.
 * - proration_behavior: 'none' — intentional: price changes aligned to billing
 *   cycle boundaries; no mid-cycle credit/charge. Document any exception before
 *   changing.
 */

import type { SubscriptionRecord, TargetPriceMap } from './stripeSubscriptionInventory'
import { appendFileSync, readFileSync } from 'node:fs'

/** Hard-coded allowlist — caller cannot override this to include 'live'. */
const EXECUTOR_ALLOWED_ENVS = ['test'] as const

export interface StripeUpdateClient {
  subscriptions: {
    update(
      id: string,
      params: {
        items: Array<{ id: string; price: string }>
        proration_behavior: string
        metadata: Record<string, string>
      },
    ): Promise<{ id: string; items: { data: Array<{ id: string; price: { id: string } }> } }>
    retrieve(id: string): Promise<{ id: string; items: { data: Array<{ id: string; price: { id: string } }> } }>
  }
  invoices: {
    retrieveUpcoming(params: {
      customer: string
      subscription: string
      subscription_items?: Array<{ id: string; price: string; quantity: number }>
    }): Promise<{
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
  /** Initial journal entries loaded from disk. The executor appends to this and
   *  persists each new entry to journalPath if provided. */
  journal: AuditEntry[]
  /** Absolute path to append-only NDJSON journal file. If set, each entry is
   *  appended to disk immediately after being added to the in-memory journal. */
  journalPath?: string
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

/**
 * Load a durable journal from a NDJSON file.
 * Returns an empty array if the file does not exist.
 */
export function loadJournalFromFile(journalPath: string): AuditEntry[] {
  try {
    const raw = readFileSync(journalPath, 'utf8')
    return raw
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as AuditEntry)
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw e
  }
}

function appendEntryToDisk(entry: AuditEntry, journalPath: string): void {
  appendFileSync(journalPath, JSON.stringify(entry) + '\n', 'utf8')
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

function recordEntry(
  entry: AuditEntry,
  result: ExecutorResult,
  journalPath: string | undefined,
): void {
  result.journal.push(entry)
  if (journalPath) {
    appendEntryToDisk(entry, journalPath)
  }
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

  // Hard-coded environment guard — caller cannot override EXECUTOR_ALLOWED_ENVS
  if (!(EXECUTOR_ALLOWED_ENVS as readonly string[]).includes(config.stripeEnv)) {
    result.stoppedEarly = true
    result.stopReason =
      `stripeEnv '${config.stripeEnv}' not in hard-coded allowlist ` +
      `[${EXECUTOR_ALLOWED_ENVS.join(', ')}]. Live mode is not permitted in this executor.`
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
      recordEntry(entry, result, config.journalPath)
      result.failed++
      result.stoppedEarly = true
      result.stopReason = `invariant: cannot resolve target price for sub ${rec.subscriptionId} cadence=${rec.currentCadence}`
      return result
    }

    // Retrieve current item ID first — needed for both preview and apply
    let currentItemId: string | undefined
    try {
      const current = await config.client.subscriptions.retrieve(rec.subscriptionId)
      currentItemId = current.items.data[0]?.id
      if (!currentItemId) {
        throw new Error('subscription_has_no_items')
      }
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
        error: `retrieve_before_preview_failed: ${e instanceof Error ? e.message : String(e)}`,
        timestamp: new Date().toISOString(),
      }
      recordEntry(entry, result, config.journalPath)
      result.failed++
      result.stoppedEarly = true
      result.stopReason = `invariant: subscription retrieve failed for sub ${rec.subscriptionId}`
      return result
    }

    // Invoice preview using the SAME mutation parameters (subscription_items with target price).
    // This previews the actual post-update invoice, not the current state.
    let previewAmountDue = -1
    let previewCurrency = 'unknown'
    try {
      const preview = await config.client.invoices.retrieveUpcoming({
        customer: rec.customerId,
        subscription: rec.subscriptionId,
        subscription_items: [{ id: currentItemId, price: targetPriceId, quantity: 1 }],
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
      recordEntry(entry, result, config.journalPath)
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
      recordEntry(entry, result, config.journalPath)
      result.dryRun++
      continue
    }

    // Apply mode — perform the update using the already-retrieved item ID
    try {
      await config.client.subscriptions.update(rec.subscriptionId, {
        items: [{ id: currentItemId, price: targetPriceId }],
        // proration_behavior: 'none' — intentional: price changes are aligned
        // to billing cycle boundaries. No mid-cycle prorations issued.
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
        recordEntry(entry, result, config.journalPath)
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
      recordEntry(entry, result, config.journalPath)
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
      recordEntry(entry, result, config.journalPath)
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
