import 'server-only'

import type Stripe from 'stripe'

import type {
  PayloadCourseWriteAPI,
  PayloadDocument,
  PayloadId,
} from '@/lib/payloadCourse/accessService'

export const STRIPE_OPERATOR_ACTIONS = [
  'sync_subscription',
  'cancel_at_period_end',
  'resume_subscription',
] as const

export type StripeOperatorAction = (typeof STRIPE_OPERATOR_ACTIONS)[number]
export type StripeOperatorActionStatus = 'completed' | 'skipped'

type StripeOperatorClient = Pick<Stripe, 'subscriptions' | 'customers'>

type StripeOperatorMirror = (
  payload: PayloadCourseWriteAPI,
  event: Stripe.Event,
  options: { stripe: StripeOperatorClient; adminEmail?: string | null },
) => Promise<{ actions: string[] }>

export type StripeOperatorActionDependencies = {
  payload: PayloadCourseWriteAPI
  stripe: StripeOperatorClient
  stripeEnvironment: 'test' | 'live'
  mirrorEvent: StripeOperatorMirror
  adminEmail?: string | null
  now?: () => Date
}

export type StripeOperatorActionResult = {
  status: StripeOperatorActionStatus
  action: StripeOperatorAction
  actionRecordId: string
  memberId: string | null
  payloadSubscriptionId: string
  stripeSubscriptionId: string
  stripeStatus: Stripe.Subscription.Status
  cancelAtPeriodEnd: boolean
  eventId: string
  projectionActions: string[]
}

export class StripeOperatorActionError extends Error {
  constructor(
    readonly code:
      | 'live_mode_forbidden'
      | 'subscription_record_missing'
      | 'billing_account_missing'
      | 'billing_account_not_test'
      | 'stripe_subscription_missing'
      | 'stripe_subscription_live'
      | 'subscription_terminal'
      | 'invalid_operator_action',
    message: string,
  ) {
    super(message)
    this.name = 'StripeOperatorActionError'
  }
}

function relationshipId(value: unknown): PayloadId | null {
  if (typeof value === 'string' || typeof value === 'number') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    return typeof id === 'string' || typeof id === 'number' ? id : null
  }
  return null
}

function stringValue(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

export function isStripeOperatorAction(value: unknown): value is StripeOperatorAction {
  return typeof value === 'string' && STRIPE_OPERATOR_ACTIONS.includes(value as StripeOperatorAction)
}

function isTerminalSubscription(subscription: Stripe.Subscription): boolean {
  return subscription.status === 'canceled' || subscription.status === 'incomplete_expired'
}

function buildManualStripeEvent(params: {
  actionRecordId: string
  subscription: Stripe.Subscription
  now: Date
}): Stripe.Event {
  return {
    id: `operator_subscription_${params.actionRecordId}`,
    object: 'event',
    api_version: '2024-06-20',
    created: Math.floor(params.now.getTime() / 1000),
    data: { object: params.subscription },
    livemode: false,
    pending_webhooks: 0,
    request: null,
    type: 'customer.subscription.updated',
  } as Stripe.Event
}

async function findPayloadSubscription(
  payload: PayloadCourseWriteAPI,
  payloadSubscriptionId: PayloadId,
): Promise<PayloadDocument> {
  try {
    return await payload.findByID({
      collection: 'payload_subscriptions',
      id: payloadSubscriptionId,
      depth: 0,
      overrideAccess: true,
    })
  } catch {
    throw new StripeOperatorActionError(
      'subscription_record_missing',
      'Payload subscription record was not found.',
    )
  }
}

async function findBillingAccount(
  payload: PayloadCourseWriteAPI,
  relationship: unknown,
): Promise<PayloadDocument> {
  const embedded = relationship && typeof relationship === 'object'
    ? relationship as PayloadDocument
    : null
  if (embedded && embedded.id !== undefined && embedded.stripeMode !== undefined) return embedded

  const id = relationshipId(relationship)
  if (id === null) {
    throw new StripeOperatorActionError(
      'billing_account_missing',
      'Subscription has no billing account relationship.',
    )
  }

  try {
    return await payload.findByID({
      collection: 'payload_billing_accounts',
      id,
      depth: 0,
      overrideAccess: true,
    })
  } catch {
    throw new StripeOperatorActionError(
      'billing_account_missing',
      'Payload billing account was not found.',
    )
  }
}

async function retrieveStripeSubscription(
  stripe: StripeOperatorClient,
  subscriptionId: string,
): Promise<Stripe.Subscription> {
  try {
    return await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['items.data.price', 'latest_invoice.payment_intent'],
    })
  } catch {
    throw new StripeOperatorActionError(
      'stripe_subscription_missing',
      'Stripe subscription could not be retrieved.',
    )
  }
}

function assertTestEnvironmentAndAccount(params: {
  stripeEnvironment: 'test' | 'live'
  billingAccount: PayloadDocument
}) {
  if (params.stripeEnvironment !== 'test') {
    throw new StripeOperatorActionError(
      'live_mode_forbidden',
      'Operator subscription actions are restricted to Stripe test mode.',
    )
  }
  if (params.billingAccount.stripeMode !== 'test') {
    throw new StripeOperatorActionError(
      'billing_account_not_test',
      'Payload billing account is not marked as Stripe test mode.',
    )
  }
}

function assertTestSubscription(subscription: Stripe.Subscription) {
  if (subscription.livemode) {
    throw new StripeOperatorActionError(
      'stripe_subscription_live',
      'Live Stripe subscriptions cannot be changed by this operator action.',
    )
  }
}

async function applyDesiredCancellationState(params: {
  stripe: StripeOperatorClient
  subscription: Stripe.Subscription
  action: Exclude<StripeOperatorAction, 'sync_subscription'>
  actionRecordId: string
}): Promise<{ subscription: Stripe.Subscription; status: StripeOperatorActionStatus }> {
  if (isTerminalSubscription(params.subscription)) {
    throw new StripeOperatorActionError(
      'subscription_terminal',
      'Canceled or expired subscriptions cannot be resumed or scheduled again.',
    )
  }

  const desired = params.action === 'cancel_at_period_end'
  if (params.subscription.cancel_at_period_end === desired) {
    return { subscription: params.subscription, status: 'skipped' }
  }

  const updated = await params.stripe.subscriptions.update(
    params.subscription.id,
    { cancel_at_period_end: desired },
    { idempotencyKey: `jpv-operator-${params.actionRecordId}-${params.action}` },
  )

  return { subscription: updated, status: 'completed' }
}

export async function executeStripeOperatorAction(params: {
  dependencies: StripeOperatorActionDependencies
  actionRecordId: PayloadId
  payloadSubscriptionId: PayloadId
  action: StripeOperatorAction
}): Promise<StripeOperatorActionResult> {
  if (!isStripeOperatorAction(params.action)) {
    throw new StripeOperatorActionError(
      'invalid_operator_action',
      'Unsupported Stripe operator action.',
    )
  }

  const actionRecordId = String(params.actionRecordId)
  const payloadSubscriptionId = String(params.payloadSubscriptionId)
  const record = await findPayloadSubscription(
    params.dependencies.payload,
    params.payloadSubscriptionId,
  )
  const stripeSubscriptionId = stringValue(record.stripeSubscriptionId)
  if (!stripeSubscriptionId || !stripeSubscriptionId.startsWith('sub_')) {
    throw new StripeOperatorActionError(
      'stripe_subscription_missing',
      'Payload subscription has no valid Stripe subscription ID.',
    )
  }

  const billingAccount = await findBillingAccount(
    params.dependencies.payload,
    record.billingAccount,
  )
  assertTestEnvironmentAndAccount({
    stripeEnvironment: params.dependencies.stripeEnvironment,
    billingAccount,
  })

  let subscription = await retrieveStripeSubscription(
    params.dependencies.stripe,
    stripeSubscriptionId,
  )
  assertTestSubscription(subscription)

  let status: StripeOperatorActionStatus = 'completed'
  if (params.action !== 'sync_subscription') {
    const update = await applyDesiredCancellationState({
      stripe: params.dependencies.stripe,
      subscription,
      action: params.action,
      actionRecordId,
    })
    subscription = update.subscription
    status = update.status
  }

  const event = buildManualStripeEvent({
    actionRecordId,
    subscription,
    now: params.dependencies.now?.() ?? new Date(),
  })
  const projection = await params.dependencies.mirrorEvent(
    params.dependencies.payload,
    event,
    {
      stripe: params.dependencies.stripe,
      adminEmail: params.dependencies.adminEmail,
    },
  )

  return {
    status,
    action: params.action,
    actionRecordId,
    memberId: relationshipId(record.member) === null ? null : String(relationshipId(record.member)),
    payloadSubscriptionId,
    stripeSubscriptionId,
    stripeStatus: subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    eventId: event.id,
    projectionActions: projection.actions,
  }
}

function safeFailure(error: unknown): { code: string; message: string } {
  if (error instanceof StripeOperatorActionError) {
    return { code: error.code, message: error.message }
  }
  return {
    code: 'stripe_operator_action_failed',
    message: 'Stripe operator action failed. Review server logs and Stripe test-mode state.',
  }
}

export async function processPayloadBillingAction(params: {
  doc: PayloadDocument
  operation: 'create' | 'update'
  req: {
    payload: PayloadCourseWriteAPI
    user?: { id?: PayloadId; collection?: string } | null
  }
}): Promise<PayloadDocument> {
  if (params.operation !== 'create' || !isStripeOperatorAction(params.doc.actionType)) {
    return params.doc
  }

  const administrator = params.req.user
  const subscriptionId = relationshipId(params.doc.subscription)
  if (!administrator?.id || administrator.collection !== 'payload_users' || subscriptionId === null) {
    return params.doc
  }

  const [{ getStripe }, { getStripeConfig }, { mirrorStripeEventToPayload }] = await Promise.all([
    import('@/lib/stripe'),
    import('@/lib/stripe-config'),
    import('@/lib/payloadCourse/stripeShadowSync'),
  ])

  try {
    const stripeConfig = getStripeConfig()
    const result = await executeStripeOperatorAction({
      dependencies: {
        payload: params.req.payload,
        stripe: getStripe(),
        stripeEnvironment: stripeConfig.env,
        mirrorEvent: mirrorStripeEventToPayload,
        adminEmail: administrator.collection === 'payload_users'
          ? stringValue((administrator as { email?: unknown }).email)
          : null,
      },
      actionRecordId: params.doc.id,
      payloadSubscriptionId: subscriptionId,
      action: params.doc.actionType,
    })

    return await params.req.payload.update({
      collection: 'payload_billing_actions',
      id: params.doc.id,
      data: {
        displayName: `${result.action} ${result.stripeSubscriptionId}`,
        member: result.memberId ?? undefined,
        requestedBy: administrator.id,
        status: result.status,
        sourceEventId: result.eventId,
        completedAt: new Date().toISOString(),
        result,
        metadata: {
          operatorAction: true,
          payloadSubscriptionId: result.payloadSubscriptionId,
          stripeSubscriptionId: result.stripeSubscriptionId,
          projectionActions: result.projectionActions,
        },
      },
      overrideAccess: true,
      overrideLock: true,
    })
  } catch (error) {
    const failure = safeFailure(error)
    console.error('stripe_operator_action_failed', {
      actionRecordId: String(params.doc.id),
      actionType: params.doc.actionType,
      code: failure.code,
    })

    return await params.req.payload.update({
      collection: 'payload_billing_actions',
      id: params.doc.id,
      data: {
        requestedBy: administrator.id,
        status: 'failed',
        completedAt: new Date().toISOString(),
        result: failure,
        metadata: {
          operatorAction: true,
          failureCode: failure.code,
        },
      },
      overrideAccess: true,
      overrideLock: true,
    })
  }
}
