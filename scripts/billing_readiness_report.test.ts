import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import { buildBillingReadinessReport } from '../src/lib/billingReadiness'

const readyEnv = {
  STRIPE_ENV: 'test',
  STRIPE_SECRET_KEY_TEST: 'sk_test_ready',
  STRIPE_WEBHOOK_SECRET_TEST: 'whsec_ready_a,whsec_ready_b',
  STRIPE_PRICE_PRO_TEST: 'price_pro_ready',
  STRIPE_PRICE_PRO_ANNUAL_TEST: 'price_pro_annual_ready',
  APP_PUBLIC_URL: 'https://preview.example.test',
}

async function main() {
  const [report, readinessSource, checkoutSource, portalSource, webhookSource] =
    await Promise.all([
      buildBillingReadinessReport(readyEnv as unknown as NodeJS.ProcessEnv),
      readFile('src/lib/billingReadiness.ts', 'utf8'),
      readFile('src/app/api/stripe/checkout/route.ts', 'utf8'),
      readFile('src/app/(frontend)/billing/portal/route.ts', 'utf8'),
      readFile('src/lib/stripe-webhook-handler.ts', 'utf8'),
    ])

  assert.equal(report.repositoryReady, true)
  assert.equal(report.configurationReady, true)
  assert.equal(report.liveVerificationPending, true)
  assert.deepEqual(report.sections.configuration.codes, [])
  assert.deepEqual(report.sections.routeSafety.codes, [])
  assert.deepEqual(report.sections.migrationInventory.codes, [])
  assert.deepEqual(report.sections.eventCoverage.codes, [])
  assert.equal(report.checks.stripeSecretKey.present, true)
  assert.equal(report.checks.webhookSecrets.present, true)
  assert.equal(report.checks.webhookSecrets.count, 2)
  assert.equal(report.checks.priceIds.proMonthlyPresent, true)
  assert.equal(report.checks.priceIds.proAnnualPresent, true)
  assert.equal(report.checks.priceIds.distinct, true)
  assert.equal(report.checks.previewPublicUrl.validHttps, true)
  assert.equal(report.checks.checkoutUrls.successTrusted, true)
  assert.equal(report.checks.checkoutUrls.cancelTrusted, true)
  assert.equal(report.checks.portalReturnUrl.trusted, true)
  assert.equal(report.checks.portalCustomerOwnership.requiresOwnedCustomer, true)
  assert.equal(report.checks.webhookRoute.canonical, '/api/webhook/stripe')
  assert.deepEqual(report.checks.requiredEvents.missing, [])
  assert.equal(report.checks.migrations.subscriptionProjectionSourcePresent, true)
  assert.equal(report.checks.migrations.refundDisputeProjectionSourcePresent, true)
  assert.equal(report.checks.migrations.emailMigrationSourcesMissing.length, 2)
  assert.equal(JSON.stringify(report).includes('sk_test_ready'), false)
  assert.equal(JSON.stringify(report).includes('whsec_ready_a'), false)
  assert.equal(JSON.stringify(report).includes('price_pro_ready'), false)
  assert.equal(JSON.stringify(report).includes('price_pro_annual_ready'), false)
  assert.equal(JSON.stringify(report).includes('https://preview.example.test'), false)

  const missingSecret = await buildBillingReadinessReport({
    ...readyEnv,
    STRIPE_SECRET_KEY_TEST: undefined,
  } as unknown as NodeJS.ProcessEnv)
  assert.equal(missingSecret.configurationReady, false)
  assert.equal(missingSecret.sections.configuration.codes.includes('STRIPE_SECRET_KEY_MISSING'), true)

  const missingWebhook = await buildBillingReadinessReport({
    ...readyEnv,
    STRIPE_WEBHOOK_SECRET_TEST: undefined,
  } as unknown as NodeJS.ProcessEnv)
  assert.equal(missingWebhook.sections.configuration.codes.includes('STRIPE_WEBHOOK_SECRET_MISSING'), true)

  const mismatchedPrices = await buildBillingReadinessReport({
    ...readyEnv,
    STRIPE_PRICE_PRO_ANNUAL_TEST: 'price_pro_ready',
  } as unknown as NodeJS.ProcessEnv)
  assert.equal(mismatchedPrices.sections.configuration.codes.includes('STRIPE_PRICE_MATCH'), true)

  const invalidUrl = await buildBillingReadinessReport({
    ...readyEnv,
    APP_PUBLIC_URL: 'http://preview.example.test',
  } as unknown as NodeJS.ProcessEnv)
  assert.equal(invalidUrl.sections.configuration.codes.includes('PREVIEW_PUBLIC_URL_INVALID'), true)

  assert.match(readinessSource, /buildBillingReadinessReport/)
  assert.doesNotMatch(readinessSource, /\bfetch\(|\baxios\b|\bgetStripe\(/i)
  assert.match(checkoutSource, /checkout\.sessions\.create/)
  assert.match(checkoutSource, /return value === 'pro'/)
  assert.match(checkoutSource, /mode: 'subscription'/)
  assert.doesNotMatch(checkoutSource, /mode:\s*'payment'/)
  assert.doesNotMatch(checkoutSource, /STRIPE_PRICE_TABLE/)
  assert.match(checkoutSource, /billingParam/)
  assert.match(checkoutSource, /billing=monthly\|annual/)
  assert.match(checkoutSource, /priceProAnnual/)
  assert.match(portalSource, /billingPortal\.sessions\.create/)
  for (const eventName of [
    'checkout.session.completed',
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted',
    'invoice.paid',
    'invoice.payment_failed',
    'charge.refunded',
    'charge.dispute.created',
    'charge.dispute.closed',
  ]) {
    assert.match(webhookSource, new RegExp(eventName.replaceAll('.', '\\.')))
  }

  console.log('billing readiness report tests passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
