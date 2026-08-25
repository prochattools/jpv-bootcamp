import { blockMember } from '@/lib/members/accountStatus'
import type {
  PayloadCourseWriteAPI,
  PayloadDocument,
  PayloadId,
} from '@/lib/payloadCourse/accessService'
import { createAuditEvent } from '@/lib/payloadCourse/events'

export type DelinquencySweepResult = {
  examined: number
  blocked: number
  alreadyBlocked: number
  skippedManualStatus: number
  failed: number
}

function relationshipId(value: unknown): PayloadId | null {
  if (typeof value === 'string' || typeof value === 'number') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    return typeof id === 'string' || typeof id === 'number' ? id : null
  }
  return null
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function isBillingManagedBlock(member: PayloadDocument): boolean {
  return member.accountStatus === 'blocked' && ['past_due', 'payment_failed', 'payment_overdue']
    .includes(text(member.billingHoldReason) ?? '')
}

export async function sweepExpiredPaymentGrace(params: {
  payload: PayloadCourseWriteAPI
  now?: Date
  limit?: number
  adminEmail?: string | null
}): Promise<DelinquencySweepResult> {
  const now = params.now ?? new Date()
  const limit = Math.min(Math.max(params.limit ?? 100, 1), 500)
  const result: DelinquencySweepResult = {
    examined: 0,
    blocked: 0,
    alreadyBlocked: 0,
    skippedManualStatus: 0,
    failed: 0,
  }

  const subscriptions = await params.payload.find({
    collection: 'payload_subscriptions',
    where: {
      and: [
        { status: { in: ['past_due', 'unpaid'] } },
        { paymentGraceEndsAt: { less_than: now.toISOString() } },
      ],
    },
    limit,
    depth: 0,
    overrideAccess: true,
  })

  for (const subscription of subscriptions.docs) {
    result.examined += 1
    const memberId = relationshipId(subscription.member)
    if (memberId === null) {
      result.failed += 1
      continue
    }

    try {
      const member = await params.payload.findByID({
        collection: 'payload_members',
        id: memberId,
        depth: 0,
        overrideAccess: true,
      })
      if (isBillingManagedBlock(member)) {
        result.alreadyBlocked += 1
        continue
      }
      if (member.accountStatus !== 'active') {
        result.skippedManualStatus += 1
        await createAuditEvent(params.payload, {
          actorType: 'system',
          action: 'billing.grace_expired.manual_status_preserved',
          targetCollection: 'payload_members',
          targetId: member.id,
          severity: 'warning',
          metadata: {
            subscriptionId: String(subscription.id),
            stripeSubscriptionId: text(subscription.stripeSubscriptionId),
            accountStatus: member.accountStatus,
          },
        })
        continue
      }

      const eventId = `billing_grace_expired_${String(subscription.id)}_${Math.floor(now.getTime() / 1000)}`
      const change = await blockMember(params.payload, {
        actor: { type: 'system', id: 'billing-delinquency-worker' },
        memberId,
        reason: 'payment_overdue',
        eventId,
        adminEmail: params.adminEmail,
      })
      if (change.changed) result.blocked += 1
      else result.alreadyBlocked += 1
    } catch (error) {
      result.failed += 1
      await createAuditEvent(params.payload, {
        actorType: 'system',
        action: 'billing.grace_expired.failed',
        targetCollection: 'payload_subscriptions',
        targetId: subscription.id,
        severity: 'critical',
        metadata: { error: error instanceof Error ? error.message : 'unknown_error' },
      }).catch((): undefined => undefined)
    }
  }

  return result
}
