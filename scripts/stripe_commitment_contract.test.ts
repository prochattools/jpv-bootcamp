import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(path, 'utf8')

const commitment = read('src/lib/stripe-commitment.ts')
const checkoutAction = read('src/lib/actions/startMemberCheckout.ts')
const checkoutComponent = read('src/components/portal/MemberCheckoutButtons.tsx')
const publicCheckout = read('src/app/api/stripe/checkout/route.ts')
const landing = read('src/app/(frontend)/page.tsx')
const provisioning = read('src/lib/provisioning.ts')
const commitmentProjection = read('src/lib/billing/commitmentProjection.ts')
const webhook = read('src/lib/stripe-webhook-handler.ts')
const entitlements = read('src/app/api/entitlements/route.ts')
const billingStatus = read('src/lib/billing/billingStatusHelper.ts')
const portalAction = read('src/lib/actions/openBillingPortal.ts')
const cancellationAction = read('src/lib/actions/requestMembershipCancellation.ts')
const portalPage = read('src/app/(frontend)/portal/[section]/page.tsx')
const stripeConfig = read('src/lib/stripe-config.ts')
const payloadCollection = read('src/collections/billing/Billing.ts')
const payloadAccess = read('src/lib/payloadCourse/accessService.ts')
const payloadShadow = read('src/lib/payloadCourse/stripeShadowSync.ts')
const systemSchema = read('prisma/system.prisma')
const migration = read(
  'prisma/migrations/20260710_214000_add_subscription_commitment_projection/migration.sql',
)

function assertContains(source: string, phrases: string[], label: string): void {
  for (const phrase of phrases) {
    assert.ok(source.includes(phrase), `${label} must contain: ${phrase}`)
  }
}

function testMonthlyCheckoutContract(): void {
  assertContains(
    commitment,
    [
      'PRO_MONTHLY_COMMITMENT_MONTHS = 12',
      'PRO_MONTHLY_PRICE_GBP = 80',
      'PRO_MONTHLY_TOTAL_GBP = 960',
      "end_behavior: 'release'",
      'iterations: PRO_MONTHLY_COMMITMENT_MONTHS',
      'from_subscription: subscription.id',
      'existingScheduleId',
      'reusedExistingSchedule = true',
      'subscriptionSchedules.retrieve(existingScheduleId)',
      'subscriptionSchedules.create',
      "if (!isMonthlyCommitmentMetadata(params.session.metadata)) return null",
    ],
    'commitment helper',
  )

  assertContains(
    checkoutAction,
    [
      "'consent_required'",
      '!consent?.contractAccepted',
      '!consent.immediateAccessRequested',
      'ACTIVE_COMMITMENT_STATUSES',
      "allow_promotion_codes: billing === 'annual'",
      'buildCheckoutContractMetadata',
      "billing === 'annual' ? config.stripe.priceProAnnual : config.stripe.pricePro",
    ],
    'member checkout action',
  )

  assertContains(
    checkoutComponent,
    [
      '£80 each month for an initial 12-month commitment',
      'Total initial commitment: £960',
      'continues at £80 per month until you cancel',
      'Contract acknowledgment',
      'Immediate access request',
      'Start Pro — pay £80 now',
      '£880 upfront for 12 months',
    ],
    'checkout component',
  )

  assertContains(
    publicCheckout,
    [
      "if (billing === 'monthly')",
      '/portal/billing?checkout=consent_required',
      'buildCheckoutContractMetadata',
    ],
    'public checkout route',
  )

  assertContains(
    landing,
    [
      '£80/month',
      'Initial 12-month commitment · £960 total',
      'Continues at £80 month-to-month after the initial term',
      '/portal/billing',
    ],
    'landing pricing',
  )
}

function testProjectionAndAccessContract(): void {
  assertContains(
    provisioning,
    [
      "status: monthlyCommitment ? 'pending_payment' : 'active'",
      "plan: monthlyCommitment ? 'none' : incomingPlan",
      'lastPaidInvoiceId',
      'paymentGraceEnd(occurredAt)',
      "commitmentStatus === 'pending'",
      "? 'active'",
      'monthlyCommitment && paid && providerAllowsAccess',
      'hasVerifiedPaidInvoice',
    ],
    'Prisma provisioning',
  )

  assertContains(
    commitmentProjection,
    [
      'commitmentStartAt: params.schedule.commitmentStartAt',
      'commitmentEndAt: params.schedule.commitmentEndAt',
      "eventType === 'subscription_schedule.completed'",
      "eventType === 'subscription_schedule.released'",
      "eventType === 'subscription_schedule.canceled'",
      "eventType === 'subscription_schedule.aborted'",
      "commitmentStatus: duringCommitment ? 'cancellation_requested'",
      'effectiveAt = duringCommitment',
      ': record.subscriptionCurrentPeriodEnd',
    ],
    'commitment projection',
  )

  assertContains(
    entitlements,
    [
      "subscriptionStatus === 'past_due'",
      'graceActive && storedPlan ? storedPlan :',
      "subscriptionStatus === 'unpaid' || subscriptionStatus === 'canceled'",
      'monthlyPaymentVerified',
      "record?.paymentStatus === 'failed' || record?.paymentStatus === 'action_required'",
    ],
    'entitlement endpoint',
  )

  assertContains(
    billingStatus,
    [
      'withinPaymentGrace',
      "subscriptionStatus === 'past_due'",
      "return withinPaymentGrace ? 'available' : 'billing_hold'",
      'restrictedPortalRequired',
      "commitmentStatus === 'cancellation_requested'",
    ],
    'billing status helper',
  )
}

function testWebhookContract(): void {
  const requiredEvents = [
    'checkout.session.completed',
    'checkout.session.async_payment_succeeded',
    'checkout.session.async_payment_failed',
    'invoice.paid',
    'invoice.payment_failed',
    'invoice.payment_action_required',
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted',
    'subscription_schedule.created',
    'subscription_schedule.updated',
    'subscription_schedule.expiring',
    'subscription_schedule.completed',
    'subscription_schedule.released',
    'subscription_schedule.canceled',
    'subscription_schedule.aborted',
    'refund.created',
    'refund.updated',
    'refund.failed',
    'charge.refunded',
    'charge.dispute.created',
    'charge.dispute.updated',
    'charge.dispute.closed',
  ]
  assertContains(webhook, requiredEvents, 'primary webhook handler')
  assertContains(payloadShadow, requiredEvents, 'Payload webhook shadow')

  assertContains(
    webhook,
    [
      'ensureMonthlyCommitmentSchedule',
      'projectCheckoutCommitment',
      'projectAsyncCheckoutFailure',
      'projectSubscriptionSchedule',
      "paymentStatus: 'action_required'",
      'subscriptionSchedules.retrieve(eventSchedule.id)',
      'hasProcessed(event.id)',
      'markProcessed({',
    ],
    'webhook authority handling',
  )
}

function testPortalAndCancellationContract(): void {
  assertContains(
    stripeConfig,
    [
      'STRIPE_PORTAL_COMMITMENT_CONFIGURATION_ID_',
      'commitmentPortalConfigurationId',
      'Stripe commitment portal configuration',
    ],
    'Stripe portal config',
  )
  assertContains(
    portalAction,
    [
      'restrictedPortalRequired',
      'commitmentPortalConfigurationId',
      "'restricted_portal_unavailable'",
      'if (!portalConfigurationId)',
    ],
    'billing portal action',
  )
  assertContains(
    cancellationAction,
    ['recordCancellationRequest', 'cancellation_requested=1', 'cancellation_effective_at'],
    'cancellation action',
  )
  assertContains(
    portalPage,
    [
      'commitmentStartAt',
      'commitmentEndAt',
      'cancellationEffectiveAt',
      'Request end-of-term cancellation',
      'Billing and access continue while payments',
      'remain current, and cancellation takes effect',
    ],
    'billing portal page',
  )
}

function testPayloadAndSchemaContract(): void {
  assertContains(
    payloadCollection,
    [
      "name: 'stripeSubscriptionScheduleId'",
      "name: 'billingCadence'",
      "name: 'commitmentStatus'",
      "name: 'commitmentStartAt'",
      "name: 'commitmentEndAt'",
      "name: 'cancellationEffectiveAt'",
      "name: 'paymentGraceEndsAt'",
      "value: 'action_required'",
    ],
    'Payload billing collections',
  )
  assertContains(
    payloadAccess,
    [
      'paymentGraceEndsAt',
      'withinPaymentGrace',
      "rawStatus === 'past_due'",
      "subscription.canceledAt",
    ],
    'Payload access evaluator',
  )
  assert.equal(
    payloadAccess.includes('subscription.cancelAtPeriodEnd || subscription.canceledAt'),
    false,
    'scheduled cancellation must not immediately block Payload access',
  )
  assertContains(
    payloadShadow,
    [
      'paymentGraceEnd(new Date(event.created * 1000))',
      "paymentStatus === 'action_required'",
      'syncSubscriptionSchedule',
      "commitmentStatus === 'cancellation_requested'",
    ],
    'Payload shadow sync',
  )

  const fields = [
    'stripeSubscriptionScheduleId',
    'stripeCheckoutSessionId',
    'billingCadence',
    'commitmentStatus',
    'commitmentStartAt',
    'commitmentEndAt',
    'cancellationRequestedAt',
    'cancellationEffectiveAt',
    'paymentGraceEndsAt',
    'lastPaidInvoiceId',
    'lastPaymentFailureAt',
    'contractVersion',
    'contractAcceptedAt',
    'immediateAccessConsentAt',
    'earlyTerminationReason',
    'earlyTerminationApprovedBy',
  ]
  assertContains(systemSchema, fields, 'system Prisma schema')
  for (const field of fields) {
    const snake = field.replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`)
    assert.ok(migration.includes(`"${snake}"`), `migration must include ${snake}`)
  }
}

try {
  testMonthlyCheckoutContract()
  testProjectionAndAccessContract()
  testWebhookContract()
  testPortalAndCancellationContract()
  testPayloadAndSchemaContract()
  console.log('stripe commitment contract tests passed')
} catch (error) {
  console.error(
    'stripe commitment contract tests failed',
    error instanceof Error ? error.message : error,
  )
  process.exitCode = 1
}
