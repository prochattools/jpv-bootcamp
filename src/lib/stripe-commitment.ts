import 'server-only'

import type Stripe from 'stripe'

export const PRO_MONTHLY_CONTRACT_VERSION = '2026-07-10'
export const PRO_MONTHLY_COMMITMENT_MONTHS = 12
export const PRO_MONTHLY_PRICE_GBP = 80
export const PRO_MONTHLY_TOTAL_GBP = 960
export {
  PAYMENT_GRACE_DAYS,
  isWithinPaymentGrace,
  paymentGraceEnd,
} from '@/lib/billing/commitmentPolicy'

export type BillingCadence = 'monthly_commitment' | 'annual'
export type CommitmentStatus =
  | 'pending'
  | 'active'
  | 'cancellation_requested'
  | 'completed'
  | 'terminated'

export type MonthlyCheckoutConsent = {
  contractAccepted: boolean
  immediateAccessRequested: boolean
  acceptedAt: Date
}

export function buildCheckoutContractMetadata(params: {
  billing: 'monthly' | 'annual'
  source: string
  consent?: MonthlyCheckoutConsent | null
}): Record<string, string> {
  const base = {
    plan: 'jpv_bootcamp_membership',
    billing: params.billing,
    billing_cadence: params.billing === 'monthly' ? 'monthly_commitment' : 'annual',
    source: params.source,
  }

  if (params.billing !== 'monthly') return base
  if (!params.consent?.contractAccepted || !params.consent.immediateAccessRequested) {
    throw new Error('monthly_commitment_consent_required')
  }

  const acceptedAt = params.consent.acceptedAt.toISOString()
  return {
    ...base,
    contract_version: PRO_MONTHLY_CONTRACT_VERSION,
    contract_accepted_at: acceptedAt,
    immediate_access_consent_at: acceptedAt,
  }
}

export function isMonthlyCommitmentMetadata(
  metadata: Stripe.Metadata | Record<string, string> | null | undefined,
): boolean {
  return metadata?.billing_cadence === 'monthly_commitment' || metadata?.billing === 'monthly'
}

function relationshipId(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    return typeof id === 'string' && id.trim() ? id : null
  }
  return null
}

function firstSubscriptionItem(subscription: Stripe.Subscription): Stripe.SubscriptionItem {
  const item = subscription.items.data[0]
  if (!item) throw new Error('monthly_commitment_subscription_item_missing')
  return item
}

export type MonthlyCommitmentScheduleResult = {
  scheduleId: string
  subscriptionId: string
  commitmentStartAt: Date
  commitmentEndAt: Date
  reusedExistingSchedule: boolean
}

type CommitmentStripeClient = Pick<Stripe, 'subscriptions' | 'subscriptionSchedules'>

export async function ensureMonthlyCommitmentSchedule(params: {
  stripe: CommitmentStripeClient
  session: Stripe.Checkout.Session
}): Promise<MonthlyCommitmentScheduleResult | null> {
  if (!isMonthlyCommitmentMetadata(params.session.metadata)) return null

  const subscriptionId = relationshipId(params.session.subscription)
  if (!subscriptionId) throw new Error('monthly_commitment_subscription_missing')

  const subscription = await params.stripe.subscriptions.retrieve(subscriptionId)
  const item = firstSubscriptionItem(subscription)
  const existingScheduleId = relationshipId(
    (subscription as Stripe.Subscription & { schedule?: unknown }).schedule,
  )

  let schedule: Stripe.SubscriptionSchedule
  let reusedExistingSchedule = false

  if (existingScheduleId) {
    schedule = await params.stripe.subscriptionSchedules.retrieve(existingScheduleId)
    reusedExistingSchedule = true
  } else {
    schedule = await params.stripe.subscriptionSchedules.create({
      from_subscription: subscription.id,
    })
  }

  const commitmentStart = schedule.current_phase?.start_date ?? subscription.current_period_start
  const updatedSchedule = await params.stripe.subscriptionSchedules.update(schedule.id, {
    end_behavior: 'release',
    phases: [
      {
        start_date: commitmentStart,
        iterations: PRO_MONTHLY_COMMITMENT_MONTHS,
        items: [
          {
            price: item.price.id,
            quantity: item.quantity ?? 1,
          },
        ],
        metadata: {
          contract_version: PRO_MONTHLY_CONTRACT_VERSION,
          billing_cadence: 'monthly_commitment',
        },
      },
    ],
    metadata: {
      contract_version: PRO_MONTHLY_CONTRACT_VERSION,
      billing_cadence: 'monthly_commitment',
      checkout_session_id: params.session.id,
    },
  })

  const phase = updatedSchedule.phases[0]
  if (!phase) throw new Error('monthly_commitment_schedule_phase_missing')

  return {
    scheduleId: updatedSchedule.id,
    subscriptionId,
    commitmentStartAt: new Date(phase.start_date * 1000),
    commitmentEndAt: new Date(phase.end_date * 1000),
    reusedExistingSchedule,
  }
}
