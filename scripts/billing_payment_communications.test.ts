import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import {
  BILLING_PAYMENT_FAILED_TEMPLATE_KEY,
  BILLING_PAYMENT_RECOVERED_TEMPLATE_KEY,
  getSystemEmailTemplate,
} from '../src/lib/payloadCourse/systemEmailTemplates'

async function main() {
  const failedTemplate = getSystemEmailTemplate(BILLING_PAYMENT_FAILED_TEMPLATE_KEY)
  const recoveredTemplate = getSystemEmailTemplate(BILLING_PAYMENT_RECOVERED_TEMPLATE_KEY)

  assert.ok(failedTemplate)
  assert.ok(recoveredTemplate)
  assert.match(String(failedTemplate.subject), /payment needs attention/i)
  assert.match(String(failedTemplate.textBody), /account access has not been changed/i)
  assert.match(String(recoveredTemplate.subject), /payment was received/i)
  assert.doesNotMatch(JSON.stringify(failedTemplate), /stripeInvoiceId|stripeCustomerId|paymentIntent/i)
  assert.doesNotMatch(JSON.stringify(recoveredTemplate), /stripeInvoiceId|stripeCustomerId|paymentIntent/i)

  const [shadowSync, webhook, helper, page, schema, migration] = await Promise.all([
    readFile('src/lib/payloadCourse/stripeShadowSync.ts', 'utf8'),
    readFile('src/lib/stripe-webhook-handler.ts', 'utf8'),
    readFile('src/lib/billing/billingStatusHelper.ts', 'utf8'),
    readFile('src/app/(frontend)/portal/[section]/page.tsx', 'utf8'),
    readFile('prisma/system.prisma', 'utf8'),
    readFile('prisma/migrations/20260703_130000_add_payment_state_projection/migration.sql', 'utf8'),
  ])

  const invoiceSync = shadowSync.slice(
    shadowSync.indexOf('async function syncInvoice'),
    shadowSync.indexOf('async function syncCheckoutSession'),
  )
  assert.match(invoiceSync, /billing-payment-failed:/)
  assert.match(invoiceSync, /billing-payment-recovered:/)
  assert.match(invoiceSync, /queueEmailEvent/)
  assert.match(invoiceSync, /billing_payment_failed/)
  assert.match(invoiceSync, /billing_payment_recovered/)
  assert.doesNotMatch(invoiceSync, /syncMemberBillingHold/)
  assert.doesNotMatch(invoiceSync, /access_blocked|access_restored/)

  assert.match(webhook, /case 'invoice\.payment_failed'/)
  assert.match(webhook, /case 'invoice\.paid'/)
  assert.match(webhook, /projectInvoicePaymentState/)
  assert.match(helper, /showPaymentWarning: paymentStatus === 'failed'/)
  assert.match(page, /Payment needs attention/)

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
    assert.match(migration, new RegExp(`ADD COLUMN IF NOT EXISTS "${column}"`))
  }
  assert.doesNotMatch(migration, /\bDROP\b|\bDELETE\b|\bTRUNCATE\b/i)

  console.log('billing payment communication tests passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
