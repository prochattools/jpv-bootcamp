import { readFile } from 'node:fs/promises'

import { BILLING_PORTAL_DEFAULT_RETURN_URL, describeBillingPortalReturnUrl } from '@/lib/billing-portal-return'

export type BillingReadinessCode =
  | 'STRIPE_SECRET_KEY_MISSING'
  | 'STRIPE_WEBHOOK_SECRET_MISSING'
  | 'STRIPE_PRICE_PRO_MISSING'
  | 'STRIPE_PRICE_PRO_ANNUAL_MISSING'
  | 'STRIPE_PRICE_MATCH'
  | 'PREVIEW_PUBLIC_URL_MISSING'
  | 'PREVIEW_PUBLIC_URL_INVALID'
  | 'CHECKOUT_URL_UNTRUSTED'
  | 'PORTAL_RETURN_URL_UNTRUSTED'
  | 'PORTAL_CUSTOMER_OWNERSHIP_UNCONFIRMED'
  | 'WEBHOOK_ROUTE_UNIDENTIFIED'
  | 'WEBHOOK_EVENT_MISSING'
  | 'MIGRATION_SOURCE_MISSING'

export type BillingReadinessSection = {
  ready: boolean
  codes: BillingReadinessCode[]
}

export type BillingReadinessReport = {
  repositoryReady: boolean
  configurationReady: boolean
  liveVerificationPending: boolean
  checks: {
    stripeSecretKey: { present: boolean }
    webhookSecrets: { present: boolean; count: number }
    priceIds: { proMonthlyPresent: boolean; proAnnualPresent: boolean; distinct: boolean }
    previewPublicUrl: {
      present: boolean
      validHttps: boolean
      host: string | null
    }
    checkoutUrls: { successTrusted: boolean; cancelTrusted: boolean }
    portalReturnUrl: { trusted: boolean; host: string | null }
    portalCustomerOwnership: { requiresOwnedCustomer: boolean }
    webhookRoute: { canonical: string | null }
    requiredEvents: { present: string[]; missing: string[] }
    migrations: {
      subscriptionProjectionSourcePresent: boolean
      refundDisputeProjectionSourcePresent: boolean
      emailMigrationSourcesPresent: boolean
      emailMigrationSourcesMissing: string[]
    }
  }
  sections: {
    configuration: BillingReadinessSection
    routeSafety: BillingReadinessSection
    migrationInventory: BillingReadinessSection
    eventCoverage: BillingReadinessSection
  }
}

const REQUIRED_WEBHOOK_EVENTS = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
  'charge.refunded',
  'charge.dispute.created',
  'charge.dispute.closed',
] as const

const BILLING_WEBHOOK_ROUTE = '/api/webhook/stripe'

function clean(value: string | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function getStripeEnv(env: NodeJS.ProcessEnv): 'test' | 'live' | null {
  const value = clean(env.STRIPE_ENV)?.toLowerCase()
  if (value === 'test' || value === 'live') return value
  return null
}

function splitSecrets(raw: string | undefined): string[] {
  return clean(raw)
    ?.split(',')
    .map((value) => value.trim())
    .filter(Boolean) ?? []
}

function safeHttpsUrl(raw: string | undefined): { present: boolean; validHttps: boolean; host: string | null } {
  const value = clean(raw)
  if (!value) return { present: false, validHttps: false, host: null }
  try {
    const url = new URL(value)
    return {
      present: true,
      validHttps: url.protocol === 'https:',
      host: url.hostname || null,
    }
  } catch {
    return { present: true, validHttps: false, host: null }
  }
}

function isTrustedReturnUrl(raw: string | null | undefined) {
  const info = describeBillingPortalReturnUrl(raw)
  return { trusted: info.valid, host: info.host ?? null }
}

function sectionFromCodes(codes: BillingReadinessCode[]): BillingReadinessSection {
  return { ready: codes.length === 0, codes }
}

async function readText(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, 'utf8')
  } catch {
    return null
  }
}

function hasEvents(handlerSource: string | null) {
  const present: string[] = []
  const missing: string[] = []

  for (const eventName of REQUIRED_WEBHOOK_EVENTS) {
    const matched = handlerSource ? handlerSource.includes(`'${eventName}'`) || handlerSource.includes(`"${eventName}"`) : false
    ;(matched ? present : missing).push(eventName)
  }

  return { present, missing }
}

async function readMigrationInventory() {
  const subscriptionProjection = await readText('prisma/migrations/20260703_120000_add_subscription_projection/migration.sql')
  const refundDisputeProjection = await readText('prisma/migrations/20260703_140000_add_refund_dispute_projection/migration.sql')
  const emailMigrationOne = await readText('prisma/migrations/20260701_201500_member_email_verification/migration.sql')
  const emailMigrationTwo = await readText('prisma/migrations/20260702_001500_member_account_action_purposes/migration.sql')

  return {
    subscriptionProjectionSourcePresent: Boolean(subscriptionProjection),
    refundDisputeProjectionSourcePresent: Boolean(refundDisputeProjection),
    emailMigrationSourcesPresent: Boolean(emailMigrationOne && emailMigrationTwo),
    emailMigrationSourcesMissing: [
      ...(emailMigrationOne ? [] : ['20260701_201500_member_email_verification']),
      ...(emailMigrationTwo ? [] : ['20260702_001500_member_account_action_purposes']),
    ],
  }
}

export async function buildBillingReadinessReport(env: NodeJS.ProcessEnv = process.env): Promise<BillingReadinessReport> {
  const stripeEnv = getStripeEnv(env)
  const suffix = stripeEnv === 'test' ? 'TEST' : stripeEnv === 'live' ? 'LIVE' : null
  const secretKey = suffix ? clean(env[`STRIPE_SECRET_KEY_${suffix}`]) : null
  const pricePro = suffix ? clean(env[`STRIPE_PRICE_PRO_${suffix}`]) : null
  const priceProAnnual = suffix ? clean(env[`STRIPE_PRICE_PRO_ANNUAL_${suffix}`]) : null
  const webhookSecrets = suffix ? splitSecrets(env[`STRIPE_WEBHOOK_SECRET_${suffix}`]) : []
  const webhookRouteSource = await readText('src/app/api/webhook/stripe/route.ts')
  const checkoutSource = await readText('src/app/api/stripe/checkout/route.ts')
  const portalRouteSource = await readText('src/app/(frontend)/billing/portal/route.ts')
  const webhookHandlerSource = await readText('src/lib/stripe-webhook-handler.ts')
  const migrationInventory = await readMigrationInventory()

  const previewPublicUrl = safeHttpsUrl(
    clean(env.APP_PUBLIC_URL) ??
      clean(env.NEXT_PUBLIC_APP_URL) ??
      clean(env.PAYLOAD_SERVER_URL) ??
      clean(env.NEXT_PUBLIC_SERVER_URL) ??
      clean(env.APP_BASE_URL) ??
      null,
  )
  const portalReturn = isTrustedReturnUrl(BILLING_PORTAL_DEFAULT_RETURN_URL)
  const checkoutSuccessTrusted = Boolean(
    checkoutSource?.includes('successUrl') &&
      checkoutSource?.includes('cancelUrl') &&
      checkoutSource?.includes('stripeConfig.stripe.successUrl') &&
      checkoutSource?.includes('stripeConfig.stripe.cancelUrl'),
  )
  const checkoutCancelTrusted = checkoutSuccessTrusted
  const requiredEvents = hasEvents(
    [webhookRouteSource, checkoutSource, portalRouteSource, webhookHandlerSource]
      .filter((value): value is string => Boolean(value))
      .join('\n'),
  )

  const configurationCodes: BillingReadinessCode[] = []
  if (!secretKey) {
    configurationCodes.push('STRIPE_SECRET_KEY_MISSING')
  }
  if (webhookSecrets.length === 0) configurationCodes.push('STRIPE_WEBHOOK_SECRET_MISSING')
  if (!pricePro) configurationCodes.push('STRIPE_PRICE_PRO_MISSING')
  if (!priceProAnnual) configurationCodes.push('STRIPE_PRICE_PRO_ANNUAL_MISSING')
  if (pricePro && priceProAnnual && pricePro === priceProAnnual) {
    configurationCodes.push('STRIPE_PRICE_MATCH')
  }
  if (!previewPublicUrl.present) configurationCodes.push('PREVIEW_PUBLIC_URL_MISSING')
  if (previewPublicUrl.present && !previewPublicUrl.validHttps) configurationCodes.push('PREVIEW_PUBLIC_URL_INVALID')
  if (!checkoutSuccessTrusted || !checkoutCancelTrusted) configurationCodes.push('CHECKOUT_URL_UNTRUSTED')
  if (!portalReturn.trusted) configurationCodes.push('PORTAL_RETURN_URL_UNTRUSTED')

  const routeCodes: BillingReadinessCode[] = []
  if (!portalRouteSource?.includes('stripe.billingPortal.sessions.create')) {
    routeCodes.push('PORTAL_CUSTOMER_OWNERSHIP_UNCONFIRMED')
  }
  if (!webhookRouteSource?.includes(BILLING_WEBHOOK_ROUTE)) {
    routeCodes.push('WEBHOOK_ROUTE_UNIDENTIFIED')
  }

  const migrationCodes: BillingReadinessCode[] = []
  if (!migrationInventory.subscriptionProjectionSourcePresent || !migrationInventory.refundDisputeProjectionSourcePresent) {
    migrationCodes.push('MIGRATION_SOURCE_MISSING')
  }

  const eventCodes: BillingReadinessCode[] = requiredEvents.missing.length > 0 ? ['WEBHOOK_EVENT_MISSING'] : []

  const configurationReady = configurationCodes.length === 0
  const repositoryReady = routeCodes.length === 0 && migrationCodes.length === 0 && eventCodes.length === 0

  return {
    repositoryReady,
    configurationReady,
    liveVerificationPending: true,
    checks: {
      stripeSecretKey: { present: Boolean(secretKey) },
      webhookSecrets: { present: webhookSecrets.length > 0, count: webhookSecrets.length },
      priceIds: {
        proMonthlyPresent: Boolean(pricePro),
        proAnnualPresent: Boolean(priceProAnnual),
        distinct: pricePro !== priceProAnnual,
      },
      previewPublicUrl,
      checkoutUrls: {
        successTrusted: checkoutSuccessTrusted,
        cancelTrusted: checkoutCancelTrusted,
      },
      portalReturnUrl: portalReturn,
      portalCustomerOwnership: { requiresOwnedCustomer: true },
      webhookRoute: { canonical: webhookRouteSource?.includes(BILLING_WEBHOOK_ROUTE) ? BILLING_WEBHOOK_ROUTE : null },
      requiredEvents,
      migrations: migrationInventory,
    },
    sections: {
      configuration: sectionFromCodes(configurationCodes),
      routeSafety: sectionFromCodes(routeCodes),
      migrationInventory: sectionFromCodes(migrationCodes),
      eventCoverage: sectionFromCodes(eventCodes),
    },
  }
}
