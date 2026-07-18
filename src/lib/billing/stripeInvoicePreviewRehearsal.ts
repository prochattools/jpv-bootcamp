import 'server-only'
import Stripe from 'stripe'
import type {
  MigrationCandidateInput,
  ClassifiedMigrationCandidate,
  StripeInvoicePreviewRequest,
} from '@/lib/billing/membershipMigrationPreview'
import { buildStripeInvoicePreviewRequest } from '@/lib/billing/membershipMigrationPreview'

export type StripeInvoicePreviewResult = {
  customerId: string
  subscriptionId: string
  email: string
  previewRequest: StripeInvoicePreviewRequest
  response: Stripe.Invoice
  extracted: {
    lines: number
    subtotal: number
    taxAmount: number
    discountAmount: number
    currency: string
    amountDue: number
    nextRenewalDate: string | null
  }
}

export type ReconciliationResult = {
  candidate: ClassifiedMigrationCandidate
  preview: StripeInvoicePreviewResult | null
  errors: string[]
  reconciliation: {
    creditsMatched: boolean
    chargesMatched: boolean
    taxMatched: boolean
    amountDueMatched: boolean
    billingAnchorMatched: boolean
    nextRenewalMatched: boolean
    overallMatched: boolean
    reconciliationState: 'matched' | 'mismatch' | 'failed'
    mismatches: string[]
  }
}

export type RehearseReport = {
  timestamp: string
  environment: 'test-mode' | 'live-mode'
  cohortSize: number
  eligibleCount: number
  previewsAttempted: number
  previewsSucceeded: number
  previewsFailed: number
  reconciliationsMatched: number
  reconciliationsMismatched: number
  reconciliationsFailed: number
  totalCreditsApplied: number
  totalChargesExpected: number
  totalTaxExpected: number
  totalAmountDue: number
  errors: Array<{ email: string; reason: string }>
  webhookProjection: {
    expectedInvoicePaidCount: number
    expectedInvoicePaymentFailedCount: number
    expectedSubscriptionUpdatedCount: number
  }
}

export async function rehearseStripeInvoicePreviewsForCohort(
  candidates: ClassifiedMigrationCandidate[],
  config: {
    stripe: Stripe
    dryRun?: boolean
    targetPriceId: string
    subscriptionItemId: string
    now?: Date
  },
): Promise<{
  rehearsal: ReconciliationResult[]
  report: RehearseReport
}> {
  const now = config.now ?? new Date()
  const rehearsal: ReconciliationResult[] = []
  const errors: Array<{ email: string; reason: string }> = []

  const eligible = candidates.filter((c) => c.eligibility === 'eligible')

  for (const candidate of eligible) {
    const result: ReconciliationResult = {
      candidate,
      preview: null,
      errors: [],
      reconciliation: {
        creditsMatched: false,
        chargesMatched: false,
        taxMatched: false,
        amountDueMatched: false,
        billingAnchorMatched: false,
        nextRenewalMatched: false,
        overallMatched: false,
        reconciliationState: 'failed',
        mismatches: [],
      },
    }

    try {
      // Build preview request
      let previewRequest: StripeInvoicePreviewRequest
      try {
        previewRequest = buildStripeInvoicePreviewRequest({
          candidate,
          subscriptionItemId: config.subscriptionItemId,
          targetPriceId: config.targetPriceId,
        })
      } catch (e) {
        result.errors.push(`Failed to build preview request: ${e instanceof Error ? e.message : String(e)}`)
        errors.push({
          email: candidate.normalizedEmail,
          reason: result.errors[result.errors.length - 1],
        })
        rehearsal.push(result)
        continue
      }

      // Call Stripe invoice preview (test mode)
      let invoice: Stripe.Invoice
      try {
        invoice = await (config.stripe.invoices as any).preview(previewRequest)
      } catch (e) {
        result.errors.push(`Stripe preview failed: ${e instanceof Error ? e.message : String(e)}`)
        errors.push({
          email: candidate.normalizedEmail,
          reason: result.errors[result.errors.length - 1],
        })
        rehearsal.push(result)
        continue
      }

      // Extract invoice details
      const lines = invoice.lines?.data?.length ?? 0
      const subtotal = invoice.subtotal ?? 0
      const taxAmount = invoice.tax ?? 0
      const discountAmount = Math.abs(invoice.total_discount_amounts?.reduce((sum, d) => sum + (d.amount ?? 0), 0) ?? 0)
      const amountDue = invoice.amount_due ?? 0
      const currency = invoice.currency ?? 'unknown'
      const nextRenewalDate = invoice.period_end ? new Date(invoice.period_end * 1000).toISOString() : null

      result.preview = {
        customerId: previewRequest.customer,
        subscriptionId: previewRequest.subscription,
        email: candidate.normalizedEmail,
        previewRequest,
        response: invoice,
        extracted: {
          lines,
          subtotal,
          taxAmount,
          discountAmount,
          currency,
          amountDue,
          nextRenewalDate,
        },
      }

      // Verify against candidate projections
      const candidatePreview = candidate.preview
      if (!candidatePreview) {
        result.reconciliation.mismatches.push('no_expected_preview_data')
        result.reconciliation.reconciliationState = 'mismatch'
      } else {
        const mismatches: string[] = []

        // Check credits
        const expectedCredit = candidatePreview.unusedTimeCredit ?? 0
        if (Math.abs(expectedCredit - discountAmount) > 1) {
          mismatches.push(`credit_mismatch: expected ${expectedCredit}, got ${discountAmount}`)
          result.reconciliation.creditsMatched = false
        } else {
          result.reconciliation.creditsMatched = true
        }

        // Check charges
        const expectedCharge = candidatePreview.remainingTimeCharge ?? 0
        if (Math.abs(expectedCharge - subtotal) > 1) {
          mismatches.push(`charge_mismatch: expected ${expectedCharge}, got ${subtotal}`)
          result.reconciliation.chargesMatched = false
        } else {
          result.reconciliation.chargesMatched = true
        }

        // Check tax
        const expectedTax = candidatePreview.expectedTaxAmount ?? candidatePreview.taxAmount ?? 0
        if (Math.abs(expectedTax - taxAmount) > 1) {
          mismatches.push(`tax_mismatch: expected ${expectedTax}, got ${taxAmount}`)
          result.reconciliation.taxMatched = false
        } else {
          result.reconciliation.taxMatched = true
        }

        // Check amount due
        const expectedAmountDue = candidatePreview.expectedAmountDue ?? candidatePreview.amountDue ?? 0
        if (Math.abs(expectedAmountDue - amountDue) > 1) {
          mismatches.push(`amount_due_mismatch: expected ${expectedAmountDue}, got ${amountDue}`)
          result.reconciliation.amountDueMatched = false
        } else {
          result.reconciliation.amountDueMatched = true
        }

        // Check next renewal date
        if (candidatePreview.nextRenewalDate) {
          if (nextRenewalDate && nextRenewalDate !== candidatePreview.nextRenewalDate.toISOString()) {
            mismatches.push(
              `next_renewal_mismatch: expected ${candidatePreview.nextRenewalDate.toISOString()}, got ${nextRenewalDate}`,
            )
            result.reconciliation.nextRenewalMatched = false
          } else {
            result.reconciliation.nextRenewalMatched = true
          }
        }

        // Check billing anchor (subscription property)
        if (candidatePreview.expectedBillingAnchor && candidate.stripeSubscriptionProjection.billingCycleAnchor) {
          if (candidatePreview.expectedBillingAnchor !== candidate.stripeSubscriptionProjection.billingCycleAnchor) {
            mismatches.push(
              `billing_anchor_mismatch: expected ${candidatePreview.expectedBillingAnchor}, got ${candidate.stripeSubscriptionProjection.billingCycleAnchor}`,
            )
            result.reconciliation.billingAnchorMatched = false
          } else {
            result.reconciliation.billingAnchorMatched = true
          }
        }

        result.reconciliation.mismatches = mismatches
        result.reconciliation.reconciliationState = mismatches.length === 0 ? 'matched' : 'mismatch'
        result.reconciliation.overallMatched = mismatches.length === 0
      }
    } catch (e) {
      result.errors.push(`Unexpected error: ${e instanceof Error ? e.message : String(e)}`)
      errors.push({
        email: candidate.normalizedEmail,
        reason: result.errors[result.errors.length - 1],
      })
    }

    rehearsal.push(result)
  }

  // Build report
  const previewsSucceeded = rehearsal.filter((r) => r.preview !== null).length
  const previewsFailed = eligible.length - previewsSucceeded
  const reconciliationsMatched = rehearsal.filter((r) => r.reconciliation.reconciliationState === 'matched').length
  const reconciliationsMismatched = rehearsal.filter((r) => r.reconciliation.reconciliationState === 'mismatch').length
  const reconciliationsFailed = rehearsal.filter((r) => r.reconciliation.reconciliationState === 'failed').length

  const totalCreditsApplied = rehearsal.reduce((sum, r) => sum + (r.preview?.extracted.discountAmount ?? 0), 0)
  const totalChargesExpected = rehearsal.reduce((sum, r) => sum + (r.preview?.extracted.subtotal ?? 0), 0)
  const totalTaxExpected = rehearsal.reduce((sum, r) => sum + (r.preview?.extracted.taxAmount ?? 0), 0)
  const totalAmountDue = rehearsal.reduce((sum, r) => sum + (r.preview?.extracted.amountDue ?? 0), 0)

  const report: RehearseReport = {
    timestamp: now.toISOString(),
    environment: 'test-mode',
    cohortSize: eligible.length,
    eligibleCount: eligible.length,
    previewsAttempted: eligible.length,
    previewsSucceeded,
    previewsFailed,
    reconciliationsMatched,
    reconciliationsMismatched,
    reconciliationsFailed,
    totalCreditsApplied,
    totalChargesExpected,
    totalTaxExpected,
    totalAmountDue,
    errors,
    webhookProjection: {
      expectedInvoicePaidCount: reconciliationsMatched,
      expectedInvoicePaymentFailedCount: reconciliationsMismatched,
      expectedSubscriptionUpdatedCount: eligible.length,
    },
  }

  return { rehearsal, report }
}

export function buildRehearseReportMarkdown(result: {
  rehearsal: ReconciliationResult[]
  report: RehearseReport
}): string {
  const { rehearsal, report } = result
  const lines = [
    '# Stripe Invoice Preview Rehearsal Report',
    '',
    '## Summary',
    '',
    `- **Timestamp:** ${report.timestamp}`,
    `- **Environment:** ${report.environment}`,
    `- **Cohort size:** ${report.cohortSize}`,
    `- **Previews succeeded:** ${report.previewsSucceeded}/${report.previewsAttempted}`,
    `- **Previews failed:** ${report.previewsFailed}`,
    `- **Reconciliations matched:** ${report.reconciliationsMatched}`,
    `- **Reconciliations mismatched:** ${report.reconciliationsMismatched}`,
    `- **Reconciliations failed:** ${report.reconciliationsFailed}`,
    '',
    '## Financial Totals (Test Mode)',
    '',
    `- **Total credits applied:** ${(report.totalCreditsApplied / 100).toFixed(2)}`,
    `- **Total charges expected:** ${(report.totalChargesExpected / 100).toFixed(2)}`,
    `- **Total tax expected:** ${(report.totalTaxExpected / 100).toFixed(2)}`,
    `- **Total amount due:** ${(report.totalAmountDue / 100).toFixed(2)}`,
    '',
    '## Webhook Projection',
    '',
    `- **Expected invoice.paid events:** ${report.webhookProjection.expectedInvoicePaidCount}`,
    `- **Expected invoice.payment_failed events:** ${report.webhookProjection.expectedInvoicePaymentFailedCount}`,
    `- **Expected subscription.updated events:** ${report.webhookProjection.expectedSubscriptionUpdatedCount}`,
    '',
    '## Reconciliation Results',
    '',
    '| Email | Eligibility | Preview | Reconciliation | Credits | Charges | Tax | Amount Due | Issues |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...rehearsal.map((result) => [
      result.candidate.normalizedEmail,
      result.candidate.eligibility,
      result.preview ? '✓' : '✗',
      result.reconciliation.reconciliationState,
      result.reconciliation.creditsMatched ? '✓' : '✗',
      result.reconciliation.chargesMatched ? '✓' : '✗',
      result.reconciliation.taxMatched ? '✓' : '✗',
      result.reconciliation.amountDueMatched ? '✓' : '✗',
      result.reconciliation.mismatches.join('; ') || result.errors.join('; ') || 'none',
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |')),
    '',
  ]

  if (report.errors.length > 0) {
    lines.push('## Errors', '')
    for (const error of report.errors) {
      lines.push(`- **${error.email}:** ${error.reason}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}
