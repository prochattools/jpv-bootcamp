import { createHash } from 'node:crypto'

import type Stripe from 'stripe'

import type { PayloadCourseWriteAPI, PayloadDocument, PayloadId } from '@/lib/payloadCourse/accessService'
import { getMembershipReadModel, type MembershipReadModel } from '@/lib/billing/membershipReadModel'
import { createAuditEvent } from '@/lib/payloadCourse/events'
import {
  mirrorStripeEventToPayload,
  type PayloadBillingShadowSyncResult,
} from '@/lib/payloadCourse/stripeShadowSync'

export type StripePayloadReconciliationMode = 'dry-run' | 'apply'
export type StripePayloadDisposition =
  | 'would_sync'
  | 'synced'
  | 'deduped'
  | 'review_required'
  | 'skipped'
  | 'failed'

export type StripePayloadReconciliationRow = {
  objectType: 'subscription' | 'invoice'
  stripeId: string
  customerId: string | null
  status: string
  disposition: StripePayloadDisposition
  reason: string
  eventId: string | null
}

export type StripePayloadReconciliationCheckpoint = {
  phase: 'subscriptions' | 'invoices'
  startingAfter: string | null
}

export type StripePayloadReconciliationReport = {
  runId: string
  mode: StripePayloadReconciliationMode
  livemode: boolean
  startedAt: string
  completedAt: string
  rows: StripePayloadReconciliationRow[]
  totals: {
    subscriptions: number
    invoices: number
    wouldSync: number
    synced: number
    deduped: number
    reviewRequired: number
    skipped: number
    failed: number
  }
  checkpoint: StripePayloadReconciliationCheckpoint | null
  readModel: MembershipReadModel | null
}

export type StripePayloadReconciliationClient = Pick<Stripe, 'subscriptions' | 'invoices' | 'customers'>

type Mirror = (
  payload: PayloadCourseWriteAPI,
  event: Stripe.Event,
  options: {
    stripe: Pick<Stripe, 'subscriptions' | 'customers'>
    adminEmail?: string | null
    suppressCommunications?: boolean
    strictIdentityResolution?: boolean
  },
) => Promise<PayloadBillingShadowSyncResult>

export type ReconcileStripeToPayloadOptions = {
  payload: PayloadCourseWriteAPI
  stripe: StripePayloadReconciliationClient
  mode?: StripePayloadReconciliationMode
  livemode: boolean
  runId: string
  adminEmail?: string | null
  suppressCommunications?: boolean
  checkpoint?: StripePayloadReconciliationCheckpoint | null
  maxObjects?: number
  pageSize?: number
  now?: () => Date
  mirror?: Mirror
  onCheckpoint?: (checkpoint: StripePayloadReconciliationCheckpoint) => Promise<void> | void
}

function relationshipId(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    return typeof id === 'string' && id.trim() ? id : null
  }
  return null
}

function payloadRelationshipId(value: unknown): PayloadId | null {
  if (typeof value === 'string' || typeof value === 'number') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    return typeof id === 'string' || typeof id === 'number' ? id : null
  }
  return null
}

async function findOne(
  payload: PayloadCourseWriteAPI,
  collection: string,
  where: Record<string, unknown>,
): Promise<PayloadDocument | null> {
  const result = await payload.find({ collection, where, limit: 1, depth: 0, overrideAccess: true })
  return result.docs[0] ?? null
}

type ReconciliationIdentityResolution =
  | { kind: 'matched'; memberId: PayloadId; match: 'stripe_customer_id' | 'normalized_email' }
  | { kind: 'review'; reason: string; memberId?: PayloadId | null; email?: string | null }

type ReconciliationIdentityIndex = {
  membersByEmail: Map<string, PayloadDocument[]>
  billingAccountsByCustomer: Map<string, PayloadDocument[]>
  billingAccountsByMember: Map<string, PayloadDocument[]>
}

async function findAll(
  payload: PayloadCourseWriteAPI,
  collection: string,
): Promise<PayloadDocument[]> {
  if (typeof payload.find !== 'function') return []
  const docs: PayloadDocument[] = []
  let page = 1
  do {
    const result = await payload.find({
      collection,
      limit: 100,
      page,
      depth: 0,
      overrideAccess: true,
    })
    docs.push(...(result.docs as PayloadDocument[]))
    if (!result.hasNextPage) break
    page += 1
    if (page > 1000) throw new Error(`stripe_reconciliation_${collection}_page_limit_exceeded`)
  } while (true)
  return docs
}

async function buildIdentityIndex(payload: PayloadCourseWriteAPI): Promise<ReconciliationIdentityIndex | null> {
  if (typeof payload.find !== 'function') return null
  const [members, billingAccounts] = await Promise.all([
    findAll(payload, 'payload_members'),
    findAll(payload, 'payload_billing_accounts'),
  ])
  const membersByEmail = new Map<string, PayloadDocument[]>()
  for (const member of members) {
    const email = typeof member.email === 'string' ? member.email.trim().toLowerCase() : ''
    if (!email) continue
    membersByEmail.set(email, [...(membersByEmail.get(email) ?? []), member])
  }
  const billingAccountsByCustomer = new Map<string, PayloadDocument[]>()
  const billingAccountsByMember = new Map<string, PayloadDocument[]>()
  for (const account of billingAccounts) {
    const customerId = typeof account.stripeCustomerId === 'string' ? account.stripeCustomerId : ''
    if (customerId) billingAccountsByCustomer.set(customerId, [...(billingAccountsByCustomer.get(customerId) ?? []), account])
    const memberId = payloadRelationshipId(account.member)
    if (memberId !== null) {
      const key = String(memberId)
      billingAccountsByMember.set(key, [...(billingAccountsByMember.get(key) ?? []), account])
    }
  }
  return { membersByEmail, billingAccountsByCustomer, billingAccountsByMember }
}

function subscriptionEmail(subscription: Stripe.Subscription): string | null {
  const customer = subscription.customer
  if (!customer || typeof customer !== 'object' || !('email' in customer)) return null
  const email = customer.email
  return typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : null
}

function ambiguousEmails(subscriptions: Stripe.Subscription[]): Set<string> {
  const byEmail = new Map<string, Set<string>>()
  for (const subscription of subscriptions.filter((item) => !['canceled', 'incomplete_expired'].includes(item.status))) {
    const email = subscriptionEmail(subscription)
    if (!email) continue
    const ids = byEmail.get(email) ?? new Set<string>()
    ids.add(subscription.id)
    byEmail.set(email, ids)
  }
  return new Set([...byEmail.entries()].filter(([, ids]) => ids.size > 1).map(([email]) => email))
}

function resolveReconciliationIdentity(params: {
  index: ReconciliationIdentityIndex
  subscription: Stripe.Subscription
  ambiguousCustomers: Set<string>
  ambiguousEmails: Set<string>
}): ReconciliationIdentityResolution {
  const customerId = relationshipId(params.subscription.customer)
  const email = subscriptionEmail(params.subscription)
  if (customerId && params.ambiguousCustomers.has(customerId)) {
    return { kind: 'review', reason: 'multiple_subscriptions_for_customer_id', email }
  }
  if (email && params.ambiguousEmails.has(email)) {
    return { kind: 'review', reason: 'multiple_subscriptions_for_normalized_email', email }
  }

  if (customerId) {
    const accounts = params.index.billingAccountsByCustomer.get(customerId) ?? []
    if (accounts.length > 1) return { kind: 'review', reason: 'duplicate_payload_billing_accounts', email }
    if (accounts.length === 1) {
      const memberId = payloadRelationshipId(accounts[0]?.member)
      if (memberId !== null) return { kind: 'matched', memberId, match: 'stripe_customer_id' }
      return { kind: 'review', reason: 'billing_account_missing_member_link', email }
    }
  }

  if (!email) return { kind: 'review', reason: 'missing_customer_email_and_payload_customer_link' }
  const members = params.index.membersByEmail.get(email) ?? []
  if (members.length === 0) return { kind: 'review', reason: 'unmatched_normalized_email', email }
  if (members.length > 1) return { kind: 'review', reason: 'duplicate_payload_members_for_normalized_email', email }
  const memberId = members[0]?.id
  if (memberId === undefined) return { kind: 'review', reason: 'matched_member_missing_id', email }

  const existingAccounts = params.index.billingAccountsByMember.get(String(memberId)) ?? []
  if (existingAccounts.some((account) => String(account.stripeCustomerId ?? '') !== String(customerId ?? ''))) {
    return { kind: 'review', reason: 'payload_member_already_linked_to_different_stripe_customer', memberId, email }
  }
  return { kind: 'matched', memberId, match: 'normalized_email' }
}

async function ensureMemberProfile(
  payload: PayloadCourseWriteAPI,
  memberId: PayloadId,
): Promise<void> {
  if (typeof payload.find !== 'function' || typeof payload.findByID !== 'function') return
  const existing = await findOne(payload, 'payload_member_profiles', { member: { equals: memberId } })
  if (existing) return
  const member = await payload.findByID({ collection: 'payload_members', id: memberId, depth: 0, overrideAccess: true })
  const email = typeof member?.email === 'string' ? member.email : `Member ${String(memberId)}`
  await payload.create({
    collection: 'payload_member_profiles',
    data: {
      member: memberId,
      displayName: typeof member?.displayName === 'string' && member.displayName.trim() ? member.displayName : email,
      transactionalEmailConsent: true,
    },
    overrideAccess: true,
  })
}

async function recordIdentityReview(params: {
  payload: PayloadCourseWriteAPI
  runId: string
  customerId: string | null
  email?: string | null
  reason: string
  memberId?: PayloadId | null
  stripeIds: string[]
}): Promise<void> {
  const identityKey = params.customerId || params.email || 'missing-identity'
  const displayName = `Stripe identity review ${identityKey}`
  const data: Record<string, unknown> = {
    displayName,
    member: params.memberId ?? undefined,
    queueState: 'needs_review',
    queueReason: 'webhook_mismatch',
    priority: 10,
    resolvedAt: undefined,
    notes: 'Stripe data was not assigned automatically. Resolve the identity before applying the subscription projection.',
    metadata: {
      source: 'stripe_payload_reconciliation',
      runId: params.runId,
      stripeCustomerId: params.customerId,
      normalizedEmail: params.email ?? null,
      stripeSubscriptionIds: params.stripeIds,
      reason: params.reason,
    },
  }
  const existing = await findOne(params.payload, 'payload_membership_review_queue_items', { displayName: { equals: displayName } })
  if (existing) {
    await params.payload.update({ collection: 'payload_membership_review_queue_items', id: existing.id, data, overrideAccess: true })
  } else {
    await params.payload.create({ collection: 'payload_membership_review_queue_items', data, overrideAccess: true })
  }
}

async function inventorySubscriptions(
  stripe: StripePayloadReconciliationClient,
  pageSize: number,
): Promise<Stripe.Subscription[]> {
  const subscriptions: Stripe.Subscription[] = []
  let startingAfter: string | undefined
  do {
    const page = await stripe.subscriptions.list({
      status: 'all',
      limit: pageSize,
      starting_after: startingAfter,
      expand: ['data.customer', 'data.items.data.price'],
    })
    subscriptions.push(...page.data)
    if (subscriptions.length > 10_000) throw new Error('subscription_inventory_limit_exceeded')
    startingAfter = page.has_more ? page.data.at(-1)?.id : undefined
    if (page.has_more && !startingAfter) throw new Error('subscription_inventory_checkpoint_missing')
    if (!page.has_more) break
  } while (startingAfter)
  return subscriptions
}

function ambiguousCustomerIds(subscriptions: Stripe.Subscription[]): Set<string> {
  const relevant = subscriptions.filter((subscription) =>
    !['canceled', 'incomplete_expired'].includes(subscription.status))
  const byCustomer = new Map<string, Set<string>>()
  const byEmail = new Map<string, Array<{ customerId: string; subscriptionId: string }>>()
  for (const subscription of relevant) {
    const customerId = relationshipId(subscription.customer)
    if (!customerId) continue
    const ids = byCustomer.get(customerId) ?? new Set<string>()
    ids.add(subscription.id)
    byCustomer.set(customerId, ids)
    const email = subscription.customer && typeof subscription.customer === 'object' && 'email' in subscription.customer
      ? subscription.customer.email?.trim().toLowerCase() ?? null
      : null
    if (email) {
      const records = byEmail.get(email) ?? []
      records.push({ customerId, subscriptionId: subscription.id })
      byEmail.set(email, records)
    }
  }
  const ambiguous = new Set(
    [...byCustomer.entries()].filter(([, ids]) => ids.size > 1).map(([customerId]) => customerId),
  )
  for (const records of byEmail.values()) {
    if (new Set(records.map((record) => record.subscriptionId)).size > 1) {
      for (const record of records) ambiguous.add(record.customerId)
    }
  }
  return ambiguous
}

async function enforceAmbiguousCustomerReview(params: {
  payload: PayloadCourseWriteAPI
  customerId: string
  subscriptionIds: string[]
  runId: string
}): Promise<void> {
  const billingAccount = await findOne(params.payload, 'payload_billing_accounts', {
    stripeCustomerId: { equals: params.customerId },
  })
  const memberId = payloadRelationshipId(billingAccount?.member)
  let member: PayloadDocument | null = null
  let wasAlreadyBlocked = false
  if (memberId !== null) {
    member = await params.payload.findByID({
      collection: 'payload_members', id: memberId, depth: 0, overrideAccess: true,
    })
    wasAlreadyBlocked = member.accountStatus === 'blocked'
    if (member.accountStatus === 'active') {
      member = await params.payload.update({
        collection: 'payload_members',
        id: member.id,
        data: { accountStatus: 'blocked', billingHoldReason: 'manual_review' },
        overrideAccess: true,
      })
    }
  }

  const displayName = `Stripe identity review ${params.customerId}`
  const existingReview = await findOne(params.payload, 'payload_membership_review_queue_items', {
    displayName: { equals: displayName },
  })
  const reviewData: Record<string, unknown> = {
    displayName,
    member: memberId ?? undefined,
    queueState: 'needs_review',
    queueReason: 'webhook_mismatch',
    priority: 10,
    resolvedAt: undefined,
    notes: 'Multiple Stripe subscription records resolve to one customer. Access is fail-closed pending operator review.',
    metadata: {
      source: 'stripe_payload_reconciliation',
      runId: params.runId,
      stripeCustomerId: params.customerId,
      stripeSubscriptionIds: params.subscriptionIds,
    },
  }
  if (existingReview) {
    await params.payload.update({
      collection: 'payload_membership_review_queue_items', id: existingReview.id,
      data: reviewData, overrideAccess: true,
    })
  } else {
    await params.payload.create({
      collection: 'payload_membership_review_queue_items', data: reviewData, overrideAccess: true,
    })
  }

  await createAuditEvent(params.payload, {
    actorType: 'system',
    action: 'billing.subscription_ambiguity.fail_closed',
    targetCollection: 'payload_members',
    targetId: member?.id ?? null,
    severity: 'critical',
    after: member,
    metadata: {
      runId: params.runId,
      stripeCustomerId: params.customerId,
      stripeSubscriptionIds: params.subscriptionIds,
      manualStatusPreserved: wasAlreadyBlocked,
    },
  })
}

function stableEventId(kind: 'subscription' | 'invoice', value: Record<string, unknown>): string {
  const digest = createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 32)
  return `reconcile_${kind}_${digest}`
}

function subscriptionEvent(subscription: Stripe.Subscription, livemode: boolean, now: Date): Stripe.Event {
  const eventId = stableEventId('subscription', {
    id: subscription.id,
    status: subscription.status,
    customer: relationshipId(subscription.customer),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    currentPeriodStart: subscription.current_period_start,
    currentPeriodEnd: subscription.current_period_end,
    canceledAt: subscription.canceled_at,
    priceIds: subscription.items.data.map((item) => item.price.id),
  })
  return {
    id: eventId,
    object: 'event',
    api_version: '2024-06-20',
    created: Math.floor(now.getTime() / 1000),
    data: { object: subscription },
    livemode,
    pending_webhooks: 0,
    request: null,
    type: subscription.status === 'canceled'
      ? 'customer.subscription.deleted'
      : 'customer.subscription.updated',
  } as Stripe.Event
}

function invoiceEventType(invoice: Stripe.Invoice): 'invoice.paid' | 'invoice.payment_failed' | null {
  if (invoice.status === 'paid') return 'invoice.paid'
  if (
    invoice.status === 'uncollectible' ||
    (invoice.status === 'open' && (invoice.attempt_count ?? 0) > 0 && (invoice.amount_remaining ?? 0) > 0)
  ) {
    return 'invoice.payment_failed'
  }
  return null
}

function invoiceEvent(invoice: Stripe.Invoice, livemode: boolean, now: Date): Stripe.Event | null {
  const type = invoiceEventType(invoice)
  if (!type) return null
  const eventId = stableEventId('invoice', {
    id: invoice.id,
    status: invoice.status,
    customer: relationshipId(invoice.customer),
    subscription: relationshipId((invoice as { subscription?: unknown }).subscription),
    amountPaid: invoice.amount_paid,
    amountRemaining: invoice.amount_remaining,
    attemptCount: invoice.attempt_count,
    paidAt: invoice.status_transitions?.paid_at,
  })
  return {
    id: eventId,
    object: 'event',
    api_version: '2024-06-20',
    created: Math.floor(now.getTime() / 1000),
    data: { object: invoice },
    livemode,
    pending_webhooks: 0,
    request: null,
    type,
  } as Stripe.Event
}

function dispositionFromMirror(result: PayloadBillingShadowSyncResult): StripePayloadDisposition {
  if (result.deduped) return 'deduped'
  if (result.actions.some((action) => action.includes('review') || action.includes('mismatch'))) {
    return 'review_required'
  }
  if (result.actions.some((action) => action.includes('skipped'))) return 'skipped'
  return result.processed ? 'synced' : 'skipped'
}

function buildTotals(rows: StripePayloadReconciliationRow[]) {
  const count = (disposition: StripePayloadDisposition) => rows.filter((row) => row.disposition === disposition).length
  return {
    subscriptions: rows.filter((row) => row.objectType === 'subscription').length,
    invoices: rows.filter((row) => row.objectType === 'invoice').length,
    wouldSync: count('would_sync'),
    synced: count('synced'),
    deduped: count('deduped'),
    reviewRequired: count('review_required'),
    skipped: count('skipped'),
    failed: count('failed'),
  }
}

export async function reconcileStripeToPayload(
  options: ReconcileStripeToPayloadOptions,
): Promise<StripePayloadReconciliationReport> {
  const mode = options.mode ?? 'dry-run'
  const startedAt = (options.now?.() ?? new Date()).toISOString()
  const pageSize = Math.min(Math.max(options.pageSize ?? 100, 1), 100)
  const maxObjects = Math.max(options.maxObjects ?? 10_000, 1)
  const mirror = options.mirror ?? mirrorStripeEventToPayload
  const rows: StripePayloadReconciliationRow[] = []
  let checkpoint = options.checkpoint ?? null
  const subscriptions = await inventorySubscriptions(options.stripe, pageSize)
  const ambiguousCustomers = ambiguousCustomerIds(subscriptions)
  const ambiguousSubscriptionEmails = ambiguousEmails(subscriptions)
  const identityIndex = await buildIdentityIndex(options.payload)

  const processEvent = async (
    objectType: 'subscription' | 'invoice',
    stripeId: string,
    customerId: string | null,
    status: string,
    event: Stripe.Event,
    identity?: ReconciliationIdentityResolution,
  ) => {
    if (identity?.kind === 'review') {
      if (mode === 'apply') {
        const relatedIds = subscriptions
          .filter((subscription) => {
            const candidate = resolveReconciliationIdentity({
              index: identityIndex!,
              subscription,
              ambiguousCustomers,
              ambiguousEmails: ambiguousSubscriptionEmails,
            })
            return candidate.kind === 'review' && (
              relationshipId(subscription.customer) === customerId ||
              subscriptionEmail(subscription) === identity.email
            )
          })
          .map((subscription) => subscription.id)
        await recordIdentityReview({
          payload: options.payload,
          runId: options.runId,
          customerId,
          email: identity.email,
          reason: identity.reason,
          memberId: identity.memberId,
          stripeIds: relatedIds.length > 0 ? relatedIds : [stripeId],
        })
      }
      rows.push({
        objectType,
        stripeId,
        customerId,
        status,
        disposition: 'review_required',
        reason: identity.reason,
        eventId: event.id,
      })
      return
    }
    if (mode === 'dry-run') {
      const ambiguous = objectType === 'subscription' && customerId !== null && ambiguousCustomers.has(customerId)
      rows.push({
        objectType,
        stripeId,
        customerId,
        status,
        disposition: ambiguous ? 'review_required' : 'would_sync',
        reason: ambiguous ? 'multiple_subscriptions_for_identity' : 'dry_run',
        eventId: event.id,
      })
      return
    }
    try {
      const result = await mirror(options.payload, event, {
        stripe: options.stripe,
        adminEmail: options.adminEmail,
        suppressCommunications: options.suppressCommunications ?? true,
        strictIdentityResolution: true,
      })
      if (objectType === 'subscription' && identity?.kind === 'matched') {
        await ensureMemberProfile(options.payload, identity.memberId)
      }
      rows.push({
        objectType,
        stripeId,
        customerId,
        status,
        disposition: dispositionFromMirror(result),
        reason: result.actions.join(',') || 'processed',
        eventId: event.id,
      })
    } catch (error) {
      rows.push({
        objectType,
        stripeId,
        customerId,
        status,
        disposition: 'failed',
        reason: error instanceof Error ? error.message : 'unknown_error',
        eventId: event.id,
      })
    }
  }

  const phases: Array<'subscriptions' | 'invoices'> = ['subscriptions', 'invoices']
  const startPhaseIndex = checkpoint ? phases.indexOf(checkpoint.phase) : 0
  let subscriptionsComplete = startPhaseIndex > 0
  for (let phaseIndex = Math.max(startPhaseIndex, 0); phaseIndex < phases.length; phaseIndex += 1) {
    const phase = phases[phaseIndex]
    let startingAfter = checkpoint?.phase === phase ? checkpoint.startingAfter ?? undefined : undefined
    while (rows.length < maxObjects) {
      if (phase === 'subscriptions') {
        const startIndex = startingAfter
          ? subscriptions.findIndex((subscription) => subscription.id === startingAfter) + 1
          : 0
        if (startingAfter && startIndex === 0) throw new Error('subscription_checkpoint_not_found')
        const page = subscriptions.slice(startIndex, startIndex + pageSize)
        let lastProcessedId: string | undefined
        for (const subscription of page) {
          const event = subscriptionEvent(subscription, options.livemode, options.now?.() ?? new Date())
          const identity = identityIndex
            ? resolveReconciliationIdentity({
                index: identityIndex,
                subscription,
                ambiguousCustomers,
                ambiguousEmails: ambiguousSubscriptionEmails,
              })
            : undefined
          await processEvent('subscription', subscription.id, relationshipId(subscription.customer), subscription.status, event, identity)
          lastProcessedId = subscription.id
          if (rows.length >= maxObjects) break
        }
        startingAfter = lastProcessedId
        checkpoint = { phase, startingAfter: startingAfter ?? null }
        await options.onCheckpoint?.(checkpoint)
        subscriptionsComplete = startIndex + page.length >= subscriptions.length
        if (subscriptionsComplete || rows.length >= maxObjects) break
      } else {
        const page = await options.stripe.invoices.list({
          limit: pageSize,
          starting_after: startingAfter,
          expand: ['data.customer', 'data.subscription'],
        })
        let lastProcessedId: string | undefined
        for (const invoice of page.data) {
          const event = invoiceEvent(invoice, options.livemode, options.now?.() ?? new Date())
          if (!event) {
            rows.push({
              objectType: 'invoice',
              stripeId: invoice.id,
              customerId: relationshipId(invoice.customer),
              status: invoice.status ?? 'unknown',
              disposition: 'skipped',
              reason: 'invoice_state_has_no_payment_projection',
              eventId: null,
            })
          } else {
            await processEvent('invoice', invoice.id, relationshipId(invoice.customer), invoice.status ?? 'unknown', event)
          }
          lastProcessedId = invoice.id
          if (rows.length >= maxObjects) break
        }
        startingAfter = lastProcessedId
        checkpoint = { phase, startingAfter: startingAfter ?? null }
        await options.onCheckpoint?.(checkpoint)
        if (!page.has_more || rows.length >= maxObjects) break
      }
    }
    if (rows.length >= maxObjects) break
    if (phase === 'subscriptions' && subscriptionsComplete && mode === 'apply') {
      for (const customerId of ambiguousCustomers) {
        const customerEmail = subscriptions.find(
          (subscription) => relationshipId(subscription.customer) === customerId,
        )?.customer
        const normalizedEmail = customerEmail && typeof customerEmail === 'object' && 'email' in customerEmail
          ? customerEmail.email?.trim().toLowerCase() ?? null
          : null
        const subscriptionIds = subscriptions
          .filter((subscription) => {
            if (relationshipId(subscription.customer) === customerId) return true
            if (!normalizedEmail || !subscription.customer || typeof subscription.customer !== 'object' || !('email' in subscription.customer)) return false
            return subscription.customer.email?.trim().toLowerCase() === normalizedEmail
          })
          .map((subscription) => subscription.id)
        try {
          await enforceAmbiguousCustomerReview({
            payload: options.payload,
            customerId,
            subscriptionIds,
            runId: options.runId,
          })
          for (const row of rows) {
            if (row.objectType === 'subscription' && row.customerId === customerId) {
              row.disposition = 'review_required'
              row.reason = `${row.reason},multiple_subscriptions_for_identity`
            }
          }
        } catch (error) {
          for (const row of rows) {
            if (row.objectType === 'subscription' && row.customerId === customerId) {
              row.disposition = 'failed'
              row.reason = `ambiguity_fail_closed_failed:${error instanceof Error ? error.message : 'unknown_error'}`
            }
          }
        }
      }
    }
    checkpoint = null
  }

  const completedAt = (options.now?.() ?? new Date()).toISOString()
  const readModel = identityIndex
    ? await getMembershipReadModel(options.payload, subscriptions.map((subscription) => ({
        status: subscription.status,
        customerId: relationshipId(subscription.customer),
      }))).catch((_error): null => null)
    : null
  return {
    runId: options.runId,
    mode,
    livemode: options.livemode,
    startedAt,
    completedAt,
    rows,
    totals: buildTotals(rows),
    checkpoint,
    readModel,
  }
}
