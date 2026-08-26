import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import {
  BILLING_PAYMENT_DISPUTED_TEMPLATE_KEY,
  BILLING_PAYMENT_REFUNDED_TEMPLATE_KEY,
  getSystemEmailTemplate,
} from '../src/lib/payloadCourse/systemEmailTemplates'

async function main() {
  const refundTemplate = getSystemEmailTemplate(BILLING_PAYMENT_REFUNDED_TEMPLATE_KEY)
  const disputeTemplate = getSystemEmailTemplate(BILLING_PAYMENT_DISPUTED_TEMPLATE_KEY)

  assert.ok(refundTemplate)
  assert.ok(disputeTemplate)
  assert.match(String(refundTemplate.subject), /refunded/i)
  assert.match(String(refundTemplate.textBody), /does not change your account access/i)
  assert.match(String(disputeTemplate.subject), /under review/i)
  assert.match(String(disputeTemplate.textBody), /does not change your account access/i)
  assert.doesNotMatch(JSON.stringify(refundTemplate), /stripeCustomerId|stripeChargeId|paymentIntent/i)
  assert.doesNotMatch(JSON.stringify(disputeTemplate), /stripeCustomerId|stripeChargeId|paymentIntent/i)

  const [shadowSync, webhook, helper, page, schema, migration] = await Promise.all([
    readFile('src/lib/payloadCourse/stripeShadowSync.ts', 'utf8'),
    readFile('src/lib/stripe-webhook-handler.ts', 'utf8'),
    readFile('src/lib/billing/billingStatusHelper.ts', 'utf8'),
    readFile('src/app/(frontend)/portal/[section]/page.tsx', 'utf8'),
    readFile('prisma/system.prisma', 'utf8'),
    readFile('prisma/migrations/20260703_140000_add_refund_dispute_projection/migration.sql', 'utf8'),
  ])

  const adjustmentSync = shadowSync.slice(
    shadowSync.indexOf('async function syncRefundOrDispute'),
    shadowSync.indexOf('async function syncCheckoutSession'),
  )
  assert.match(adjustmentSync, /billing-payment-refunded:/)
  assert.match(adjustmentSync, /billing-payment-disputed:/)
  assert.match(adjustmentSync, /billing_payment_refunded/)
  assert.match(adjustmentSync, /billing_payment_disputed/)
  assert.match(adjustmentSync, /billing_dispute_resolved/)
  assert.doesNotMatch(adjustmentSync, /syncMemberBillingHold|blockMember|restoreMember/)
  assert.doesNotMatch(adjustmentSync, /subscriptions\.retrieve|customers\.retrieve/)

  for (const eventType of [
    'charge.refunded',
    'charge.dispute.created',
    'charge.dispute.closed',
  ]) {
    assert.match(webhook, new RegExp(eventType.replaceAll('.', '\\.')))
    assert.match(shadowSync, new RegExp(eventType.replaceAll('.', '\\.')))
  }

  assert.match(helper, /showRefundNotice: paymentStatus === 'refunded'/)
  assert.match(helper, /showDisputeNotice: paymentStatus === 'disputed'/)
  assert.match(page, /Refund recorded/)
  assert.match(page, /Payment under review/)

  for (const field of [
    'paymentRefundedAt',
    'paymentDisputeStatus',
    'paymentDisputedAt',
    'paymentDisputeResolvedAt',
    'paymentLastChargeId',
    'paymentLastPaymentIntentId',
  ]) {
    assert.match(schema, new RegExp(field))
  }

  for (const column of [
    'payment_refunded_at',
    'payment_dispute_status',
    'payment_disputed_at',
    'payment_dispute_resolved_at',
    'payment_last_charge_id',
    'payment_last_payment_intent_id',
  ]) {
    assert.match(migration, new RegExp(`ADD COLUMN IF NOT EXISTS "${column}"`))
  }
  assert.doesNotMatch(migration, /\bDROP\b|\bDELETE\b|\bTRUNCATE\b|\bUPDATE\b/i)

  console.log('billing refund and dispute tests passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
