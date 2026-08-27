import 'server-only'

import type Stripe from 'stripe'

import type {
  PayloadCourseWriteAPI,
  PayloadDocument,
  PayloadId,
} from '@/lib/payloadCourse/accessService'
import { relationshipId } from '@/lib/domain/relationships'

export const STRIPE_OPERATOR_ACTIONS = [
  'reconcile_all',
  'sync_subscription',
  'cancel_at_period_end',
  'resume_subscription',
  'pause_subscription',
  'resume_paused_subscription',
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
  liveOperatorMutationsEnabled?: boolean
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

export type StripeBulkReconciliationResult = {
  status: 'completed' | 'failed'
  action: 'reconcile_all'
  actionRecordId: string
  runId: string
  totals: Record<string, number>
  checkpoint: { phase: 'subscriptions' | 'invoices'; startingAfter: string | null } | null
}

export class StripeOperatorActionError extends Error {
  constructor(
    readonly code:
      | 'live_mutation_disabled'
      | 'live_mutation_reason_required'
      | 'subscription_record_missing'
      | 'billing_account_missing'
      | 'billing_account_mode_mismatch'
      | 'stripe_subscription_missing'
      | 'stripe_subscription_mode_mismatch'
      | 'subscription_terminal'
      | 'invalid_operator_action',
    message: string,
  ) {
    super(message)
    this.name = 'StripeOperatorActionError'
  }
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
    livemode: params.subscription.livemode,
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

function assertEnvironmentAndAccount(params: {
  stripeEnvironment: 'test' | 'live'
  billingAccount: PayloadDocument
}) {
  if (params.billingAccount.stripeMode !== params.stripeEnvironment) {
    throw new StripeOperatorActionError(
      'billing_account_mode_mismatch',
      'Payload billing account mode does not match the configured Stripe environment.',
    )
  }
}

function assertSubscriptionMode(
  subscription: Stripe.Subscription,
  stripeEnvironment: 'test' | 'live',
) {
  if (subscription.livemode !== (stripeEnvironment === 'live')) {
    throw new StripeOperatorActionError(
      'stripe_subscription_mode_mismatch',
      'Stripe subscription mode does not match the configured Stripe environment.',
    )
  }
}

function assertLiveMutationAuthorized(params: {
  action: StripeOperatorAction
  stripeEnvironment: 'test' | 'live'
  enabled: boolean
  operatorReason: string | null
}) {
  if (params.action === 'sync_subscription' || params.stripeEnvironment !== 'live') return
  if (!params.enabled) {
    throw new StripeOperatorActionError(
      'live_mutation_disabled',
      'Live subscription changes are disabled until STRIPE_LIVE_OPERATOR_ACTIONS_ENABLED=true.',
    )
  }
  if (!params.operatorReason) {
    throw new StripeOperatorActionError(
      'live_mutation_reason_required',
      'A reason or change-ticket reference is required for live subscription changes.',
    )
  }
}

async function applyDesiredCancellationState(params: {
  stripe: StripeOperatorClient
  subscription: Stripe.Subscription
  action: Exclude<StripeOperatorAction, 'sync_subscription' | 'reconcile_all' | 'pause_subscription' | 'resume_paused_subscription'>
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

async function applyPauseState(params: {
  stripe: StripeOperatorClient
  subscription: Stripe.Subscription
  action: 'pause_subscription' | 'resume_paused_subscription'
  actionRecordId: string
}): Promise<{ subscription: Stripe.Subscription; status: StripeOperatorActionStatus }> {
  if (isTerminalSubscription(params.subscription)) {
    throw new StripeOperatorActionError('subscription_terminal', 'Canceled or expired subscriptions cannot be paused or resumed.')
  }

  const shouldPause = params.action === 'pause_subscription'
  const isPaused = Boolean(params.subscription.pause_collection)
  if (shouldPause === isPaused) return { subscription: params.subscription, status: 'skipped' }

  const updated = await params.stripe.subscriptions.update(
    params.subscription.id,
    { pause_collection: shouldPause ? { behavior: 'void' } : null },
    { idempotencyKey: `jpv-operator-${params.actionRecordId}-${params.action}` },
  )
  return { subscription: updated, status: 'completed' }
}

export async function executeStripeOperatorAction(params: {
  dependencies: StripeOperatorActionDependencies
  actionRecordId: PayloadId
  payloadSubscriptionId: PayloadId
  action: StripeOperatorAction
  operatorReason?: string | null
}): Promise<StripeOperatorActionResult> {
  if (params.action === 'reconcile_all') {
    throw new StripeOperatorActionError(
      'invalid_operator_action',
      'Bulk reconciliation must use the bulk action executor.',
    )
  }
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
  assertEnvironmentAndAccount({
    stripeEnvironment: params.dependencies.stripeEnvironment,
    billingAccount,
  })

  let subscription = await retrieveStripeSubscription(
    params.dependencies.stripe,
    stripeSubscriptionId,
  )
  assertSubscriptionMode(subscription, params.dependencies.stripeEnvironment)
  assertLiveMutationAuthorized({
    action: params.action,
    stripeEnvironment: params.dependencies.stripeEnvironment,
    enabled: params.dependencies.liveOperatorMutationsEnabled === true,
    operatorReason: stringValue(params.operatorReason),
  })

  let status: StripeOperatorActionStatus = 'completed'
  if (params.action !== 'sync_subscription') {
    const update = params.action === 'pause_subscription' || params.action === 'resume_paused_subscription'
      ? await applyPauseState({
          stripe: params.dependencies.stripe,
          subscription,
          action: params.action,
          actionRecordId,
        })
      : await applyDesiredCancellationState({
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
  if (!administrator?.id || administrator.collection !== 'payload_users') {
    return params.doc
  }

  const [{ getStripe }, { getStripeConfig }, { mirrorStripeEventToPayload }, { reconcileStripeToPayload }] = await Promise.all([
    import('@/lib/stripe'),
    import('@/lib/stripe-config'),
    import('@/lib/payloadCourse/stripeShadowSync'),
    import('@/lib/billing/stripePayloadReconciliation'),
  ])

  try {
    const stripeConfig = getStripeConfig()
    if (params.doc.actionType === 'reconcile_all') {
      const runId = `operator_${String(params.doc.id)}`
      const report = await reconcileStripeToPayload({
        payload: params.req.payload,
        stripe: getStripe(),
        mode: 'apply',
        livemode: stripeConfig.env === 'live',
        runId,
        adminEmail: stringValue((administrator as { email?: unknown }).email),
        maxObjects: 10_000,
        pageSize: 100,
      })
      const status = report.totals.failed === 0 && report.checkpoint === null ? 'completed' : 'failed'
      return await params.req.payload.update({
        collection: 'payload_billing_actions',
        id: params.doc.id,
        data: {
          displayName: `Reconcile all Stripe billing ${runId}`,
          requestedBy: administrator.id,
          status,
          completedAt: new Date().toISOString(),
          result: { runId, totals: report.totals, checkpoint: report.checkpoint },
          metadata: { operatorAction: true, bulkReconciliation: true, runId },
        },
        overrideAccess: true,
        overrideLock: true,
      })
    }
    if (subscriptionId === null) {
      throw new StripeOperatorActionError(
        'subscription_record_missing',
        'A Payload subscription record is required.',
      )
    }
    const result = await executeStripeOperatorAction({
      dependencies: {
        payload: params.req.payload,
        stripe: getStripe(),
        stripeEnvironment: stripeConfig.env,
        mirrorEvent: mirrorStripeEventToPayload,
        adminEmail: administrator.collection === 'payload_users'
          ? stringValue((administrator as { email?: unknown }).email)
          : null,
        liveOperatorMutationsEnabled: process.env.STRIPE_LIVE_OPERATOR_ACTIONS_ENABLED === 'true',
      },
      actionRecordId: params.doc.id,
      payloadSubscriptionId: subscriptionId,
      action: params.doc.actionType,
      operatorReason: stringValue(params.doc.notes),
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
