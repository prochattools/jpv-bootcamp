import 'server-only'

import type Stripe from 'stripe'

import prisma from '@/libs/prisma'
import { normalizeEmail } from '@/lib/normalize-email'
import type { MonthlyCommitmentScheduleResult } from '@/lib/stripe-commitment'

export type CommitmentProjectionResult = {
  updated: boolean
  commitmentStatus: string | null
  commitmentStartAt: Date | null
  commitmentEndAt: Date | null
}

function relationshipId(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    return typeof id === 'string' && id.trim() ? id : null
  }
  return null
}

function phaseDates(schedule: Stripe.SubscriptionSchedule): {
  startAt: Date | null
  endAt: Date | null
} {
  const phase = schedule.current_phase ?? schedule.phases[0] ?? null
  return {
    startAt: phase ? new Date(phase.start_date * 1000) : null,
    endAt: phase ? new Date(phase.end_date * 1000) : null,
  }
}

function commitmentStatusForEvent(
  eventType: string,
  existingStatus: string | null,
  hasPaidInvoice: boolean,
): string {
  if (eventType === 'subscription_schedule.completed' || eventType === 'subscription_schedule.released') {
    return 'completed'
  }
  if (
    eventType === 'subscription_schedule.canceled' ||
    eventType === 'subscription_schedule.aborted'
  ) {
    return 'terminated'
  }
  if (existingStatus === 'cancellation_requested') return existingStatus
  return hasPaidInvoice ? 'active' : 'pending'
}

export async function projectSubscriptionSchedule(params: {
  schedule: Stripe.SubscriptionSchedule
  eventId: string
  eventType: string
}): Promise<CommitmentProjectionResult> {
  const scheduleId = params.schedule.id
  const subscriptionId = relationshipId(params.schedule.subscription)
  const customerId = relationshipId(params.schedule.customer)
  const whereOr: Array<Record<string, unknown>> = [
    { stripeSubscriptionScheduleId: scheduleId },
  ]
  if (subscriptionId) whereOr.push({ stripeSubscriptionId: subscriptionId })
  if (customerId) whereOr.push({ stripeCustomerId: customerId })

  const existing = await prisma.customerProvisioning.findFirst({
    where: { OR: whereOr },
    select: {
      id: true,
      commitmentStatus: true,
      commitmentStartAt: true,
      commitmentEndAt: true,
      lastPaidInvoiceId: true,
    },
  })
  if (!existing) {
    return {
      updated: false,
      commitmentStatus: null,
      commitmentStartAt: null,
      commitmentEndAt: null,
    }
  }

  const dates = phaseDates(params.schedule)
  const status = commitmentStatusForEvent(
    params.eventType,
    existing.commitmentStatus,
    Boolean(existing.lastPaidInvoiceId),
  )
  const terminal = status === 'completed' || status === 'terminated'

  await prisma.customerProvisioning.update({
    where: { id: existing.id },
    data: {
      stripeSubscriptionScheduleId: scheduleId,
      billingCadence: 'monthly_commitment',
      commitmentStatus: status,
      commitmentStartAt: existing.commitmentStartAt ?? dates.startAt,
      commitmentEndAt: existing.commitmentEndAt ?? dates.endAt,
      cancellationEffectiveAt:
        existing.commitmentStatus === 'cancellation_requested'
          ? existing.commitmentEndAt ?? dates.endAt
          : undefined,
      lastEventId: params.eventId,
      status: terminal && status === 'terminated' ? 'inactive' : undefined,
      plan: terminal && status === 'terminated' ? 'none' : undefined,
      currentPlan: terminal && status === 'terminated' ? 'none' : undefined,
    },
  })

  return {
    updated: true,
    commitmentStatus: status,
    commitmentStartAt: existing.commitmentStartAt ?? dates.startAt,
    commitmentEndAt: existing.commitmentEndAt ?? dates.endAt,
  }
}

export async function projectCheckoutCommitment(params: {
  session: Stripe.Checkout.Session
  schedule: MonthlyCommitmentScheduleResult
  eventId: string
}): Promise<CommitmentProjectionResult> {
  const subscriptionId = relationshipId(params.session.subscription) ?? params.schedule.subscriptionId
  const customerId = relationshipId(params.session.customer)
  const whereOr: Array<Record<string, unknown>> = [
    { stripeCheckoutSessionId: params.session.id },
    { stripeSubscriptionId: subscriptionId },
  ]
  if (customerId) whereOr.push({ stripeCustomerId: customerId })

  const existing = await prisma.customerProvisioning.findFirst({
    where: { OR: whereOr },
    select: { id: true, lastPaidInvoiceId: true },
  })
  if (!existing) {
    return {
      updated: false,
      commitmentStatus: null,
      commitmentStartAt: null,
      commitmentEndAt: null,
    }
  }

  const commitmentStatus = existing.lastPaidInvoiceId ? 'active' : 'pending'
  await prisma.customerProvisioning.update({
    where: { id: existing.id },
    data: {
      stripeCheckoutSessionId: params.session.id,
      stripeSubscriptionId: subscriptionId,
      stripeSubscriptionScheduleId: params.schedule.scheduleId,
      billingCadence: 'monthly_commitment',
      commitmentStatus,
      commitmentStartAt: params.schedule.commitmentStartAt,
      commitmentEndAt: params.schedule.commitmentEndAt,
      lastEventId: params.eventId,
    },
  })

  return {
    updated: true,
    commitmentStatus,
    commitmentStartAt: params.schedule.commitmentStartAt,
    commitmentEndAt: params.schedule.commitmentEndAt,
  }
}

export async function projectAsyncCheckoutFailure(params: {
  session: Stripe.Checkout.Session
  eventId: string
  occurredAt: Date
}): Promise<boolean> {
  const subscriptionId = relationshipId(params.session.subscription)
  const customerId = relationshipId(params.session.customer)
  const whereOr: Array<Record<string, unknown>> = [
    { stripeCheckoutSessionId: params.session.id },
  ]
  if (subscriptionId) whereOr.push({ stripeSubscriptionId: subscriptionId })
  if (customerId) whereOr.push({ stripeCustomerId: customerId })

  const existing = await prisma.customerProvisioning.findFirst({
    where: { OR: whereOr },
    select: { id: true, commitmentStatus: true },
  })
  if (!existing) return false

  await prisma.customerProvisioning.update({
    where: { id: existing.id },
    data: {
      stripeCheckoutSessionId: params.session.id,
      paymentStatus: 'failed',
      lastPaymentFailureAt: params.occurredAt,
      paymentFailedAt: params.occurredAt,
      status: 'pending_payment',
      commitmentStatus: existing.commitmentStatus ?? 'pending',
      lastEventId: params.eventId,
    },
  })
  return true
}

export type CancellationRequestResult =
  | { ok: true; effectiveAt: Date; duringCommitment: boolean; stripeScheduled: boolean }
  | { ok: false; error: 'invalid_email' | 'billing_record_missing' | 'effective_date_missing' | 'stripe_env_live' }

export async function recordCancellationRequest(params: {
  memberEmail: string
  requestedAt?: Date
}): Promise<CancellationRequestResult> {
  const normalizedEmail = normalizeEmail(params.memberEmail)
  if (!normalizedEmail) return { ok: false, error: 'invalid_email' }

  const record = await prisma.customerProvisioning.findUnique({
    where: { normalizedEmail },
    select: {
      id: true,
      billingCadence: true,
      commitmentStatus: true,
      commitmentEndAt: true,
      subscriptionCurrentPeriodEnd: true,
      stripeSubscriptionId: true,
    },
  })
  if (!record) return { ok: false, error: 'billing_record_missing' }

  const requestedAt = params.requestedAt ?? new Date()
  const duringCommitment =
    record.billingCadence === 'monthly_commitment' &&
    record.commitmentStatus !== 'completed' &&
    record.commitmentStatus !== 'terminated' &&
    Boolean(record.commitmentEndAt && record.commitmentEndAt > requestedAt)
  const effectiveAt = duringCommitment
    ? record.commitmentEndAt
    : record.subscriptionCurrentPeriodEnd

  if (!effectiveAt) return { ok: false, error: 'effective_date_missing' }

  await prisma.customerProvisioning.update({
    where: { id: record.id },
    data: {
      cancellationRequestedAt: requestedAt,
      cancellationEffectiveAt: effectiveAt,
      subscriptionCancelAtPeriodEnd: true,
      commitmentStatus: duringCommitment ? 'cancellation_requested' : record.commitmentStatus,
    },
  })

  let stripeScheduled = false
  if (record.stripeSubscriptionId) {
    try {
      const { getStripeConfig } = await import('@/lib/stripe-config')
      const cfg = getStripeConfig()
      if (cfg.env === 'live') {
        console.error('cancellation_blocked: STRIPE_ENV=live — refusing to cancel live subscription', {
          subscriptionId: record.stripeSubscriptionId,
        })
        return { ok: false, error: 'stripe_env_live' }
      }
      const { getStripe } = await import('@/lib/stripe')
      const stripe = getStripe()
      if (duringCommitment && record.commitmentEndAt) {
        await stripe.subscriptions.update(record.stripeSubscriptionId, {
          cancel_at: Math.floor(record.commitmentEndAt.getTime() / 1000),
        })
      } else {
        await stripe.subscriptions.update(record.stripeSubscriptionId, {
          cancel_at_period_end: true,
        })
      }
      stripeScheduled = true
    } catch (stripeError) {
      console.error('cancellation_stripe_api_failed', {
        subscriptionId: record.stripeSubscriptionId,
        message: (stripeError as Error).message,
      })
    }
  }

  return { ok: true, effectiveAt, duringCommitment, stripeScheduled }
}
