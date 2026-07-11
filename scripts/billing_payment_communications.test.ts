import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import {
  BILLING_PAYMENT_DISPUTED_TEMPLATE_KEY,
  BILLING_PAYMENT_FAILED_TEMPLATE_KEY,
  BILLING_PAYMENT_RECOVERED_TEMPLATE_KEY,
  BILLING_PAYMENT_REFUNDED_TEMPLATE_KEY,
  getSystemEmailTemplate,
} from '../src/lib/payloadCourse/systemEmailTemplates'

async function main() {
  const failedTemplate = getSystemEmailTemplate(BILLING_PAYMENT_FAILED_TEMPLATE_KEY)
  const recoveredTemplate = getSystemEmailTemplate(BILLING_PAYMENT_RECOVERED_TEMPLATE_KEY)
  const refundedTemplate = getSystemEmailTemplate(BILLING_PAYMENT_REFUNDED_TEMPLATE_KEY)
  const disputedTemplate = getSystemEmailTemplate(BILLING_PAYMENT_DISPUTED_TEMPLATE_KEY)

  assert.ok(failedTemplate)
  assert.ok(recoveredTemplate)
  assert.ok(refundedTemplate)
  assert.ok(disputedTemplate)
  assert.match(String(failedTemplate.subject), /payment needs attention/i)
  assert.match(String(failedTemplate.textBody), /account access has not been changed/i)
  assert.match(String(recoveredTemplate.subject), /payment was received/i)
  assert.match(String(refundedTemplate.subject), /payment was refunded/i)
  assert.match(String(refundedTemplate.textBody), /does not change your account access/i)
  assert.match(String(disputedTemplate.subject), /payment is under review/i)
  assert.match(String(disputedTemplate.textBody), /does not change your account access/i)
  for (const template of [failedTemplate, recoveredTemplate, refundedTemplate, disputedTemplate]) {
    assert.doesNotMatch(JSON.stringify(template), /stripeInvoiceId|stripeCustomerId|paymentIntent|chargeId|disputeId/i)
  }

  const [shadowSync, webhook, helper, page, schema, paymentMigration, refundDisputeMigration] = await Promise.all([
    readFile('src/lib/payloadCourse/stripeShadowSync.ts', 'utf8'),
    readFile('src/lib/stripe-webhook-handler.ts', 'utf8'),
    readFile('src/lib/billing/billingStatusHelper.ts', 'utf8'),
    readFile('src/app/(frontend)/portal/[section]/page.tsx', 'utf8'),
    readFile('prisma/system.prisma', 'utf8'),
    readFile('prisma/migrations/20260703_130000_add_payment_state_projection/migration.sql', 'utf8'),
    readFile('prisma/migrations/20260703_140000_add_refund_dispute_projection/migration.sql', 'utf8'),
  ])

  const invoiceSync = shadowSync.slice(
    shadowSync.indexOf('async function syncInvoice'),
    shadowSync.indexOf('async function syncCheckoutSession'),
  )
  assert.match(invoiceSync, /billing-payment-\$\{paymentStatus\}:/)
  assert.match(invoiceSync, /billing-payment-recovered:/)
  assert.match(invoiceSync, /queueEmailEvent/)
  assert.match(invoiceSync, /billing_payment_failed/)
  assert.match(invoiceSync, /billing_payment_recovered/)
  assert.match(invoiceSync, /syncMemberBillingHold/)
  assert.match(shadowSync, /decideBillingAccessTransition/)
  assert.match(shadowSync, /manual_status/)
  assert.match(shadowSync, /pending_member/)

  assert.match(webhook, /case 'invoice\.payment_failed'/)
  assert.match(webhook, /case 'invoice\.payment_action_required'/)
  assert.match(webhook, /case 'invoice\.paid'/)
  assert.match(webhook, /case 'charge\.refunded'/)
  assert.match(webhook, /case 'charge\.dispute\.created'/)
  assert.match(webhook, /case 'charge\.dispute\.closed'/)
  assert.match(webhook, /projectInvoicePaymentState/)
  assert.match(shadowSync, /syncRefundOrDispute/)
  assert.match(shadowSync, /billing-payment-refunded:/)
  assert.match(shadowSync, /billing-payment-disputed:/)
  assert.doesNotMatch(shadowSync.slice(shadowSync.indexOf('async function syncRefundOrDispute'), shadowSync.indexOf('async function syncCheckoutSession')), /syncMemberBillingHold|blockMember|restoreMember/)
  assert.match(helper, /paymentStatus === 'failed'/)
  assert.match(helper, /paymentStatus === 'action_required'/)
  assert.match(helper, /showRefundNotice: paymentStatus === 'refunded'/)
  assert.match(helper, /showDisputeNotice: paymentStatus === 'disputed'/)
  assert.match(helper, /billingAccessState/)
  assert.match(page, /Payment needs attention/)
  assert.match(page, /Refund recorded/)
  assert.match(page, /Payment under review/)
  assert.match(page, /Membership access/)
  assert.match(page, /On billing hold/)

  for (const field of [
    'paymentStatus',
    'paymentFailedAt',
    'paymentRecoveredAt',
    'paymentUpdatedAt',
    'paymentLastEventId',
    'paymentLastInvoiceId',
  ]) {
    assert.match(schema, new RegExp(field))
  }

  for (const column of [
    'payment_status',
    'payment_failed_at',
    'payment_recovered_at',
    'payment_updated_at',
    'payment_last_event_id',
    'payment_last_invoice_id',
  ]) {
    assert.match(paymentMigration, new RegExp(`ADD COLUMN IF NOT EXISTS "${column}"`))
  }
  for (const column of [
    'payment_refunded_at',
    'payment_dispute_status',
    'payment_disputed_at',
    'payment_dispute_resolved_at',
    'payment_last_charge_id',
    'payment_last_payment_intent_id',
  ]) {
    assert.match(refundDisputeMigration, new RegExp(`ADD COLUMN IF NOT EXISTS "${column}"`))
  }
  assert.doesNotMatch(paymentMigration, /\bDROP\b|\bDELETE\b|\bTRUNCATE\b/i)
  assert.doesNotMatch(refundDisputeMigration, /\bDROP\b|\bDELETE\b|\bTRUNCATE\b/i)

  console.log('billing payment communication tests passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
