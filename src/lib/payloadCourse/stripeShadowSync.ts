import { randomBytes } from 'node:crypto'

import type Stripe from 'stripe'

import { blockMember, restoreMember } from '@/lib/members/accountStatus'
import { normalizeEmail } from '@/lib/normalize-email'
import type {
  PayloadCourseWriteAPI,
  PayloadDocument,
  PayloadId,
} from '@/lib/payloadCourse/accessService'
import { createAuditEvent, queueEmailEvent } from '@/lib/payloadCourse/events'
import { redactEmail } from '@/lib/log-redact'

type Plan = 'pro' | 'vip' | 'exhibitor'

type PayloadBillingStatus =
  | 'none'
  | 'active'
  | 'trialing'
  | 'billing_hold'
  | 'past_due'
  | 'unpaid'
  | 'canceled'

type PayloadSubscriptionStatus =
  | 'incomplete'
  | 'incomplete_expired'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'paused'

type BillingActionType =
  | 'checkout_completed'
  | 'subscription_created'
  | 'subscription_updated'
  | 'subscription_canceled'
  | 'payment_succeeded'
  | 'payment_failed'
  | 'access_blocked'
  | 'access_restored'

type ShadowStripeClient = Pick<Stripe, 'subscriptions' | 'customers'>

type ShadowSyncOptions = {
  stripe?: ShadowStripeClient
  adminEmail?: string | null
}

export type PayloadBillingShadowSyncResult = {
  enabled: boolean
  processed: boolean
  deduped: boolean
  eventId: string
  eventType: string
  actions: string[]
}

type BillingSubject = {
  email: string
  member: PayloadDocument
  contact: PayloadDocument
  billingAccount: PayloadDocument
  stripeCustomerId: string
}

type SubscriptionProjection = {
  stripeSubscriptionId: string
  stripeCustomerId: string
  email: string | null
  status: PayloadSubscriptionStatus
  billingStatus: PayloadBillingStatus
  plan: Plan | 'free'
  priceId: string | null
  productId: string | null
  cancelAtPeriodEnd: boolean
  currentPeriodStart: Date | null
  currentPeriodEnd: Date | null
  trialEndsAt: Date | null
  canceledAt: Date | null
  defaultPaymentMethodId: string | null
  metadata: Record<string, unknown>
}

function isEnvEnabled(value?: string): boolean {
  if (!value) return false
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
}

export function isPayloadBillingShadowSyncEnabled(): boolean {
  return isEnvEnabled(process.env.PAYLOAD_BILLING_SHADOW_SYNC_ENABLED)
}

function dateFromUnix(value: number | null | undefined): Date | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
  return new Date(value * 1000)
}

function relationshipId(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value
  if (typeof value === 'number') return String(value)
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'string' || typeof id === 'number') return String(id)
  }
  return null
}

function getCustomerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined
): string | null {
  if (!customer) return null
  if (typeof customer === 'string') return customer
  return customer.id ?? null
}

function getCustomerEmail(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined
): string | null {
  if (!customer || typeof customer === 'string' || 'deleted' in customer) return null
  return customer.email ?? null
}

function getPaymentMethodId(value: unknown): string | null {
  return relationshipId(value)
}

function getInvoicePaymentIntentId(invoice: Stripe.Invoice): string | null {
  return relationshipId((invoice as { payment_intent?: unknown }).payment_intent)
}

function findPrimaryPrice(subscription: Stripe.Subscription): {
  priceId: string | null
  productId: string | null
} {
  const item =
    subscription.items?.data?.find((entry) => Boolean(entry.price?.recurring)) ??
    subscription.items?.data?.[0] ??
    null
  const price = item?.price ?? null
  return {
    priceId: price?.id ?? null,
    productId: relationshipId(price?.product),
  }
}

function normalizePlan(value: string | null | undefined): Plan | null {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  if (normalized === 'pro' || normalized === 'vip' || normalized === 'exhibitor') {
    return normalized
  }
  return null
}

function stripeEnvSuffixes(): Array<'LIVE' | 'TEST'> {
  const env = (process.env.STRIPE_ENV ?? '').trim().toLowerCase()
  if (env === 'live') return ['LIVE']
  if (env === 'test') return ['TEST']
  return ['LIVE', 'TEST']
}

function resolvePlanFromPriceId(priceId: string | null | undefined): Plan | null {
  if (!priceId) return null

  for (const suffix of stripeEnvSuffixes()) {
    if (process.env[`STRIPE_PRICE_PRO_${suffix}`] === priceId) return 'pro'
    if (process.env[`STRIPE_PRICE_VIP_${suffix}`] === priceId) return 'vip'
    if (process.env[`STRIPE_PRICE_TABLE_${suffix}`] === priceId) return 'exhibitor'
  }

  return null
}

function resolvePlanFromProductId(productId: string | null | undefined): Plan | null {
  if (!productId) return null

  for (const suffix of stripeEnvSuffixes()) {
    if (process.env[`STRIPE_PRODUCT_JPV_BOOTCAMP_PRO_MEMBERSHIP_${suffix}`] === productId) {
      return 'pro'
    }
    if (process.env[`STRIPE_PRODUCT_JPV_BOOTCAMP_VIP_MEMBERSHIP_${suffix}`] === productId) {
      return 'vip'
    }
  }

  return null
}

function resolvePlanFromStripeIds(params: {
  metadataPlan?: string | null
  priceId?: string | null
  productId?: string | null
}): Plan | null {
  const fromPrice = resolvePlanFromPriceId(params.priceId)
  if (fromPrice) return fromPrice
  const hasPrice = params.priceId !== null && params.priceId !== undefined
  if (hasPrice) return null

  const fromProduct = resolvePlanFromProductId(params.productId)
  if (fromProduct) return fromProduct

  return normalizePlan(params.metadataPlan)
}

function resolveSubscriptionPlan(subscription: Stripe.Subscription): Plan | null {
  const { priceId, productId } = findPrimaryPrice(subscription)
  const metadataPlan =
    typeof subscription.metadata?.plan === 'string' ? subscription.metadata.plan : null

  return resolvePlanFromStripeIds({ metadataPlan, priceId, productId })
}

function normalizeSubscriptionStatus(status: Stripe.Subscription.Status): PayloadSubscriptionStatus {
  if (
    status === 'incomplete' ||
    status === 'incomplete_expired' ||
    status === 'trialing' ||
    status === 'active' ||
    status === 'past_due' ||
    status === 'canceled' ||
    status === 'unpaid' ||
    status === 'paused'
  ) {
    return status
  }
  return 'incomplete'
}

function billingStatusFromSubscription(subscription: Stripe.Subscription): PayloadBillingStatus {
  if (subscription.cancel_at_period_end || subscription.canceled_at) return 'canceled'
  if (subscription.status === 'active') return 'active'
  if (subscription.status === 'trialing') return 'trialing'
  if (subscription.status === 'past_due') return 'past_due'
  if (subscription.status === 'unpaid') return 'unpaid'
  if (subscription.status === 'canceled') return 'canceled'
  return 'billing_hold'
}

function billingStatusFromProjection(
  subscription: Stripe.Subscription,
  resolvedPlan: Plan | null
): PayloadBillingStatus {
  const stripeBillingStatus = billingStatusFromSubscription(subscription)
  if ((stripeBillingStatus === 'active' || stripeBillingStatus === 'trialing') && !resolvedPlan) {
    return 'billing_hold'
  }
  return stripeBillingStatus
}

function memberStatusForBilling(status: PayloadBillingStatus): {
  accountStatus: 'active' | 'blocked' | 'pending'
  holdReason: string | null
} {
  if (status === 'active' || status === 'trialing') {
    return { accountStatus: 'active', holdReason: null }
  }
  if (status === 'none') return { accountStatus: 'pending', holdReason: null }
  return { accountStatus: 'blocked', holdReason: status }
}

function subscriptionProjection(subscription: Stripe.Subscription): SubscriptionProjection {
  const customerId = getCustomerId(subscription.customer)
  const email = getCustomerEmail(subscription.customer)
  const { priceId, productId } = findPrimaryPrice(subscription)
  const resolvedPlan = resolveSubscriptionPlan(subscription)
  const plan = resolvedPlan ?? 'free'
  const billingStatus = billingStatusFromProjection(subscription, resolvedPlan)

  if (!customerId) {
    throw new Error(`Stripe subscription ${subscription.id} is missing customer id.`)
  }

  return {
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: customerId,
    email,
    status: normalizeSubscriptionStatus(subscription.status),
    billingStatus,
    plan,
    priceId,
    productId,
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    currentPeriodStart: dateFromUnix(subscription.current_period_start),
    currentPeriodEnd: dateFromUnix(subscription.current_period_end),
    trialEndsAt: dateFromUnix(subscription.trial_end),
    canceledAt: dateFromUnix(subscription.canceled_at),
    defaultPaymentMethodId: getPaymentMethodId(subscription.default_payment_method),
    metadata: {
      stripeStatus: subscription.status,
      resolvedPlan: plan,
      planResolutionFailed: !resolvedPlan,
      cancelAt: subscription.cancel_at ?? null,
      cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    },
  }
}

async function findOne(
  payload: PayloadCourseWriteAPI,
  collection: string,
  where: Record<string, unknown>
): Promise<PayloadDocument | null> {
  const result = await payload.find({
    collection,
    where,
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  return result.docs[0] ?? null
}

async function updateById(
  payload: PayloadCourseWriteAPI,
  collection: string,
  id: PayloadId,
  data: Record<string, unknown>
): Promise<PayloadDocument> {
  return payload.update({
    collection,
    id,
    data,
    overrideAccess: true,
  })
}

async function upsertByWhere(
  payload: PayloadCourseWriteAPI,
  collection: string,
  where: Record<string, unknown>,
  data: Record<string, unknown>
): Promise<{ doc: PayloadDocument; created: boolean }> {
  const existing = await findOne(payload, collection, where)
  if (existing) {
    return {
      doc: await updateById(payload, collection, existing.id, data),
      created: false,
    }
  }

  try {
    return {
      doc: await payload.create({
        collection,
        data,
        overrideAccess: true,
      }),
      created: true,
    }
  } catch (error) {
    const racedExisting = await findOne(payload, collection, where)
    if (!racedExisting) throw error
    return {
      doc: await updateById(payload, collection, racedExisting.id, data),
      created: false,
    }
  }
}

async function resolveCustomerEmail(
  stripe: ShadowStripeClient,
  customerId: string,
  fallbackEmail?: string | null
): Promise<string | null> {
  const normalizedFallback = normalizeEmail(fallbackEmail)
  if (normalizedFallback) return normalizedFallback

  const customer = await stripe.customers.retrieve(customerId)
  if ('deleted' in customer) return null
  return normalizeEmail(customer.email)
}

function makeShadowPassword(): string {
  return randomBytes(36).toString('base64url')
}

function canStripeChangeMemberStatus(member: PayloadDocument): boolean {
  return member.accountStatus !== 'suspended' && member.accountStatus !== 'deleted'
}

async function createMemberSecurityEvent(
  payload: PayloadCourseWriteAPI,
  memberId: PayloadId,
  eventType: 'account_created',
  eventId: string
) {
  return payload.create({
    collection: 'payload_member_security_events',
    data: {
      member: memberId,
      eventType,
      source: 'stripe',
      metadata: {
        eventId,
        source: 'payload_billing_shadow_sync',
      },
    },
    overrideAccess: true,
  })
}

async function upsertMember(
  payload: PayloadCourseWriteAPI,
  params: {
    email: string
    targetStatus: 'active' | 'blocked' | 'pending'
    holdReason: string | null
    eventId: string
  }
): Promise<{ member: PayloadDocument; created: boolean }> {
  const existing = await findOne(payload, 'payload_members', {
    email: { equals: params.email },
  })

  if (!existing) {
    const member = await payload.create({
      collection: 'payload_members',
      data: {
        email: params.email,
        password: makeShadowPassword(),
        source: 'stripe_checkout',
        accountStatus: params.targetStatus,
        billingHoldReason: params.holdReason ?? undefined,
        notes: 'Created by Payload billing shadow sync. Password is random until member reset/onboarding is enabled.',
      },
      overrideAccess: true,
    })

    await createMemberSecurityEvent(payload, member.id, 'account_created', params.eventId)
    await createAuditEvent(payload, {
      actorType: 'stripe',
      actorId: params.eventId,
      action: 'member.created_from_stripe_shadow',
      targetCollection: 'payload_members',
      targetId: member.id,
      after: member,
      metadata: {
        eventId: params.eventId,
        email: redactEmail(params.email),
      },
    })

    return { member, created: true }
  }

  if (!canStripeChangeMemberStatus(existing)) {
    return { member: existing, created: false }
  }

  if (existing.accountStatus === 'blocked' && params.targetStatus === 'active') {
    return { member: existing, created: false }
  }

  if (existing.accountStatus !== 'blocked' && params.targetStatus === 'blocked') {
    return { member: existing, created: false }
  }

  const data: Record<string, unknown> = {}
  if (existing.accountStatus !== params.targetStatus) data.accountStatus = params.targetStatus
  const currentHoldReason =
    typeof existing.billingHoldReason === 'string' ? existing.billingHoldReason : null
  if (currentHoldReason !== params.holdReason) data.billingHoldReason = params.holdReason

  if (Object.keys(data).length === 0) {
    return { member: existing, created: false }
  }

  const member = await updateById(payload, 'payload_members', existing.id, data)
  await createAuditEvent(payload, {
    actorType: 'stripe',
    actorId: params.eventId,
    action: 'member.status_synced_from_stripe_shadow',
    targetCollection: 'payload_members',
    targetId: member.id,
    before: existing,
    after: member,
    metadata: {
      eventId: params.eventId,
      targetStatus: params.targetStatus,
      holdReason: params.holdReason,
    },
  })

  return { member, created: false }
}

async function upsertContact(
  payload: PayloadCourseWriteAPI,
  params: {
    email: string
    memberId: PayloadId
    lifecycleStage: 'student' | 'churned' | 'lead'
    eventId: string
  }
): Promise<PayloadDocument> {
  const { doc } = await upsertByWhere(
    payload,
    'payload_contacts',
    { email: { equals: params.email } },
    {
      email: params.email,
      member: params.memberId,
      lifecycleStage: params.lifecycleStage,
      emailStatus: 'transactional_only',
      lastActivityAt: new Date(),
      source: 'stripe',
      metadata: {
        lastStripeEventId: params.eventId,
      },
    }
  )

  return doc
}

async function upsertBillingAccount(
  payload: PayloadCourseWriteAPI,
  params: {
    memberId: PayloadId
    email: string
    customerId: string
    livemode: boolean
    billingStatus: PayloadBillingStatus
    defaultPaymentMethodId?: string | null
    eventId: string
    eventType: string
  }
): Promise<PayloadDocument> {
  const { doc } = await upsertByWhere(
    payload,
    'payload_billing_accounts',
    { stripeCustomerId: { equals: params.customerId } },
    {
      displayName: `${params.email} / ${params.customerId}`,
      member: params.memberId,
      stripeCustomerId: params.customerId,
      stripeMode: params.livemode ? 'live' : 'test',
      billingStatus: params.billingStatus,
      billingEmail: params.email,
      defaultPaymentMethodId: params.defaultPaymentMethodId ?? undefined,
      lastSyncedAt: new Date(),
      metadata: {
        lastStripeEventId: params.eventId,
        lastStripeEventType: params.eventType,
      },
    }
  )

  return doc
}

async function getBillingSubject(
  payload: PayloadCourseWriteAPI,
  stripe: ShadowStripeClient,
  params: {
    eventId: string
    eventType: string
    livemode: boolean
    stripeCustomerId: string
    email?: string | null
    billingStatus: PayloadBillingStatus
    defaultPaymentMethodId?: string | null
  }
): Promise<BillingSubject | null> {
  const email = await resolveCustomerEmail(stripe, params.stripeCustomerId, params.email)
  if (!email) return null

  const memberState = memberStatusForBilling(params.billingStatus)
  const memberResult = await upsertMember(payload, {
    email,
    targetStatus: memberState.accountStatus,
    holdReason: memberState.holdReason,
    eventId: params.eventId,
  })
  const lifecycleStage = params.billingStatus === 'canceled' ? 'churned' : 'student'
  const contact = await upsertContact(payload, {
    email,
    memberId: memberResult.member.id,
    lifecycleStage,
    eventId: params.eventId,
  })
  const billingAccount = await upsertBillingAccount(payload, {
    memberId: memberResult.member.id,
    email,
    customerId: params.stripeCustomerId,
    livemode: params.livemode,
    billingStatus: params.billingStatus,
    defaultPaymentMethodId: params.defaultPaymentMethodId,
    eventId: params.eventId,
    eventType: params.eventType,
  })

  return {
    email,
    member: memberResult.member,
    contact,
    billingAccount,
    stripeCustomerId: params.stripeCustomerId,
  }
}

async function writeBillingAction(
  payload: PayloadCourseWriteAPI,
  params: {
    memberId?: PayloadId | null
    actionType: BillingActionType
    status: 'pending' | 'completed' | 'failed' | 'skipped'
    eventId: string
    notes?: string | null
    metadata?: Record<string, unknown> | null
  }
): Promise<PayloadDocument> {
  const displayName = `${params.actionType} ${params.eventId}`
  const existing = await findOne(payload, 'payload_billing_actions', {
    and: [
      { sourceEventId: { equals: params.eventId } },
      { actionType: { equals: params.actionType } },
    ],
  })

  const data = {
    displayName,
    member: params.memberId ?? undefined,
    actionType: params.actionType,
    status: params.status,
    sourceEventId: params.eventId,
    notes: params.notes ?? undefined,
    metadata: params.metadata ?? undefined,
  }

  if (existing) return updateById(payload, 'payload_billing_actions', existing.id, data)
  return payload.create({
    collection: 'payload_billing_actions',
    data,
    overrideAccess: true,
  })
}

async function queueBillingEmails(
  payload: PayloadCourseWriteAPI,
  params: {
    email: string
    contactId: PayloadId
    memberId: PayloadId
    adminEmail?: string | null
    eventId: string
    templateKey: string
    studentDedupeKey: string
    adminDedupeKey: string
    metadata?: Record<string, unknown>
  }
) {
  await queueEmailEvent(payload, {
    toEmail: params.email,
    contact: params.contactId,
    templateKey: params.templateKey,
    dedupeKey: params.studentDedupeKey,
    metadata: {
      memberId: String(params.memberId),
      eventId: params.eventId,
      ...params.metadata,
    },
  })

  if (!params.adminEmail) return

  await queueEmailEvent(payload, {
    toEmail: params.adminEmail,
    templateKey: 'admin-notification',
    dedupeKey: params.adminDedupeKey,
    metadata: {
      memberId: String(params.memberId),
      eventId: params.eventId,
      studentEmail: redactEmail(params.email),
      templateKey: params.templateKey,
      ...params.metadata,
    },
  })
}

async function syncMemberBillingHold(
  payload: PayloadCourseWriteAPI,
  params: {
    member: PayloadDocument
    billingStatus: PayloadBillingStatus
    reason: string
    eventId: string
    adminEmail?: string | null
  }
) {
  if (!canStripeChangeMemberStatus(params.member)) return

  if (params.billingStatus === 'active' || params.billingStatus === 'trialing') {
    if (
      params.member.accountStatus === 'blocked' &&
      (params.member.billingHoldReason === 'past_due' ||
        params.member.billingHoldReason === 'unpaid' ||
        params.member.billingHoldReason === 'billing_hold' ||
        params.member.billingHoldReason === 'canceled')
    ) {
      await restoreMember(payload, {
        actor: { type: 'stripe', id: params.eventId },
        memberId: params.member.id,
        reason: params.reason,
        eventId: params.eventId,
        adminEmail: params.adminEmail,
      })
      await writeBillingAction(payload, {
        memberId: params.member.id,
        actionType: 'access_restored',
        status: 'completed',
        eventId: params.eventId,
        notes: params.reason,
      })
    }
    return
  }

  await blockMember(payload, {
    actor: { type: 'stripe', id: params.eventId },
    memberId: params.member.id,
    reason: params.reason,
    eventId: params.eventId,
    adminEmail: params.adminEmail,
  })
  await writeBillingAction(payload, {
    memberId: params.member.id,
    actionType: 'access_blocked',
    status: 'completed',
    eventId: params.eventId,
    notes: params.reason,
  })
}

async function syncSubscription(
  payload: PayloadCourseWriteAPI,
  stripe: ShadowStripeClient,
  event: Stripe.Event,
  subscription: Stripe.Subscription,
  options: ShadowSyncOptions
): Promise<string[]> {
  const projection = subscriptionProjection(subscription)
  const subject = await getBillingSubject(payload, stripe, {
    eventId: event.id,
    eventType: event.type,
    livemode: event.livemode,
    stripeCustomerId: projection.stripeCustomerId,
    email: projection.email,
    billingStatus: projection.billingStatus,
    defaultPaymentMethodId: projection.defaultPaymentMethodId,
  })

  if (!subject) {
    await writeBillingAction(payload, {
      actionType: 'subscription_updated',
      status: 'skipped',
      eventId: event.id,
      notes: 'missing_customer_email',
    })
    return ['subscription_skipped_missing_email']
  }

  const { doc: subscriptionDoc } = await upsertByWhere(
    payload,
    'payload_subscriptions',
    { stripeSubscriptionId: { equals: projection.stripeSubscriptionId } },
    {
      displayName: `${projection.plan} / ${projection.stripeSubscriptionId}`,
      member: subject.member.id,
      billingAccount: subject.billingAccount.id,
      stripeSubscriptionId: projection.stripeSubscriptionId,
      stripePriceId: projection.priceId ?? undefined,
      stripeProductId: projection.productId ?? undefined,
      plan: projection.plan,
      status: projection.status,
      cancelAtPeriodEnd: projection.cancelAtPeriodEnd,
      currentPeriodStart: projection.currentPeriodStart ?? undefined,
      currentPeriodEnd: projection.currentPeriodEnd ?? undefined,
      trialEndsAt: projection.trialEndsAt ?? undefined,
      canceledAt: projection.canceledAt ?? undefined,
      lastStripeEventId: event.id,
      lastSyncedAt: new Date(),
      metadata: projection.metadata,
    }
  )

  const actionType: BillingActionType =
    event.type === 'customer.subscription.created'
      ? 'subscription_created'
      : projection.billingStatus === 'canceled'
        ? 'subscription_canceled'
        : 'subscription_updated'

  await writeBillingAction(payload, {
    memberId: subject.member.id,
    actionType,
    status: 'completed',
    eventId: event.id,
    metadata: {
      subscriptionId: String(subscriptionDoc.id),
      stripeSubscriptionId: projection.stripeSubscriptionId,
      billingStatus: projection.billingStatus,
      plan: projection.plan,
    },
  })

  const isSubscriptionLifecycleEvent =
    event.type === 'checkout.session.completed' ||
    event.type === 'customer.subscription.created' ||
    event.type === 'customer.subscription.updated'

  if (
    isSubscriptionLifecycleEvent &&
    (projection.billingStatus === 'active' || projection.billingStatus === 'trialing')
  ) {
    await queueBillingEmails(payload, {
      email: subject.email,
      contactId: subject.contact.id,
      memberId: subject.member.id,
      adminEmail: options.adminEmail,
      eventId: event.id,
      templateKey: 'subscription-started',
      studentDedupeKey: `subscription-started:${projection.stripeSubscriptionId}`,
      adminDedupeKey: `admin-notification:subscription-started:${event.id}`,
      metadata: {
        stripeSubscriptionId: projection.stripeSubscriptionId,
        plan: projection.plan,
      },
    })
  }

  if (projection.billingStatus === 'canceled') {
    await queueBillingEmails(payload, {
      email: subject.email,
      contactId: subject.contact.id,
      memberId: subject.member.id,
      adminEmail: options.adminEmail,
      eventId: event.id,
      templateKey: 'subscription-canceled',
      studentDedupeKey: `subscription-canceled:${projection.stripeSubscriptionId}:${event.id}`,
      adminDedupeKey: `admin-notification:subscription-canceled:${event.id}`,
      metadata: {
        stripeSubscriptionId: projection.stripeSubscriptionId,
        plan: projection.plan,
      },
    })
  }

  await syncMemberBillingHold(payload, {
    member: subject.member,
    billingStatus: projection.billingStatus,
    reason: projection.billingStatus === 'canceled' ? 'canceled' : projection.billingStatus,
    eventId: event.id,
    adminEmail: options.adminEmail,
  })

  return ['subscription_synced']
}

async function retrieveSubscription(
  stripe: ShadowStripeClient,
  subscriptionId: string
): Promise<Stripe.Subscription> {
  return stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['customer', 'items.data.price'],
  })
}

async function getDefaultStripeClient(): Promise<ShadowStripeClient> {
  const stripeModule = await import('@/lib/stripe')
  return stripeModule.getStripe()
}

function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  return relationshipId((invoice as { subscription?: unknown }).subscription)
}

async function syncInvoice(
  payload: PayloadCourseWriteAPI,
  stripe: ShadowStripeClient,
  event: Stripe.Event,
  invoice: Stripe.Invoice,
  paymentStatus: 'paid' | 'failed',
  options: ShadowSyncOptions
): Promise<string[]> {
  const subscriptionId = getInvoiceSubscriptionId(invoice)
  const customerId = getCustomerId(invoice.customer as Stripe.Invoice['customer'])
  let subject: BillingSubject | null = null
  let billingStatus: PayloadBillingStatus = paymentStatus === 'paid' ? 'active' : 'past_due'

  if (subscriptionId) {
    const subscription = await retrieveSubscription(stripe, subscriptionId)
    billingStatus =
      paymentStatus === 'paid' ? billingStatusFromSubscription(subscription) : 'past_due'
    const projection = subscriptionProjection(subscription)
    subject = await getBillingSubject(payload, stripe, {
      eventId: event.id,
      eventType: event.type,
      livemode: event.livemode,
      stripeCustomerId: projection.stripeCustomerId,
      email: invoice.customer_email ?? projection.email,
      billingStatus,
      defaultPaymentMethodId: projection.defaultPaymentMethodId,
    })
    await syncSubscription(payload, stripe, event, subscription, options)
    if (paymentStatus === 'failed') {
      subject = await getBillingSubject(payload, stripe, {
        eventId: event.id,
        eventType: event.type,
        livemode: event.livemode,
        stripeCustomerId: projection.stripeCustomerId,
        email: invoice.customer_email ?? projection.email,
        billingStatus,
        defaultPaymentMethodId: projection.defaultPaymentMethodId,
      })
    }
  } else if (customerId) {
    subject = await getBillingSubject(payload, stripe, {
      eventId: event.id,
      eventType: event.type,
      livemode: event.livemode,
      stripeCustomerId: customerId,
      email: invoice.customer_email,
      billingStatus,
    })
  }

  if (!subject) {
    await writeBillingAction(payload, {
      actionType: paymentStatus === 'paid' ? 'payment_succeeded' : 'payment_failed',
      status: 'skipped',
      eventId: event.id,
      notes: 'missing_customer_or_email',
    })
    return ['invoice_skipped_missing_subject']
  }

  const stripeInvoiceId = invoice.id ?? `event:${event.id}`
  const amount =
    paymentStatus === 'paid'
      ? invoice.amount_paid
      : Math.max(invoice.amount_due ?? 0, invoice.amount_remaining ?? 0)

  await upsertByWhere(
    payload,
    'payload_payments',
    { stripeInvoiceId: { equals: stripeInvoiceId } },
    {
      displayName: `${paymentStatus} ${stripeInvoiceId}`,
      member: subject.member.id,
      stripeInvoiceId,
      stripePaymentIntentId: getInvoicePaymentIntentId(invoice) ?? undefined,
      amount: Math.max(amount ?? 0, 0),
      currency: invoice.currency ?? 'usd',
      status: paymentStatus,
      paidAt: paymentStatus === 'paid' ? dateFromUnix(invoice.status_transitions?.paid_at) ?? new Date() : undefined,
      failedAt: paymentStatus === 'failed' ? new Date() : undefined,
      failureReason:
        paymentStatus === 'failed'
          ? invoice.last_finalization_error?.message ?? 'invoice_payment_failed'
          : undefined,
      metadata: {
        eventId: event.id,
        subscriptionId,
        hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
      },
    }
  )

  await writeBillingAction(payload, {
    memberId: subject.member.id,
    actionType: paymentStatus === 'paid' ? 'payment_succeeded' : 'payment_failed',
    status: 'completed',
    eventId: event.id,
    metadata: {
      stripeInvoiceId,
      subscriptionId,
      amount,
      currency: invoice.currency ?? 'usd',
    },
  })

  await queueBillingEmails(payload, {
    email: subject.email,
    contactId: subject.contact.id,
    memberId: subject.member.id,
    adminEmail: options.adminEmail,
    eventId: event.id,
    templateKey: paymentStatus === 'paid' ? 'payment-succeeded' : 'payment-failed',
    studentDedupeKey:
      paymentStatus === 'paid'
        ? `payment-succeeded:${stripeInvoiceId}`
        : `payment-failed:${stripeInvoiceId}:${event.id}`,
    adminDedupeKey:
      paymentStatus === 'paid'
        ? `admin-notification:payment-succeeded:${event.id}`
        : `admin-notification:payment-failed:${event.id}`,
    metadata: {
      stripeInvoiceId,
      subscriptionId,
      amount,
      currency: invoice.currency ?? 'usd',
    },
  })

  await syncMemberBillingHold(payload, {
    member: subject.member,
    billingStatus,
    reason: paymentStatus === 'paid' ? 'payment_recovered' : 'past_due',
    eventId: event.id,
    adminEmail: options.adminEmail,
  })

  return [paymentStatus === 'paid' ? 'invoice_paid_synced' : 'invoice_payment_failed_synced']
}

async function syncCheckoutSession(
  payload: PayloadCourseWriteAPI,
  stripe: ShadowStripeClient,
  event: Stripe.Event,
  session: Stripe.Checkout.Session,
  options: ShadowSyncOptions
): Promise<string[]> {
  if (session.mode !== 'subscription') {
    await writeBillingAction(payload, {
      actionType: 'checkout_completed',
      status: 'skipped',
      eventId: event.id,
      notes: 'non_subscription_checkout',
    })
    return ['checkout_skipped_non_subscription']
  }

  const subscriptionId = relationshipId(session.subscription)
  const customerId = relationshipId(session.customer)
  if (!subscriptionId && !customerId) {
    await writeBillingAction(payload, {
      actionType: 'checkout_completed',
      status: 'skipped',
      eventId: event.id,
      notes: 'missing_subscription_and_customer',
    })
    return ['checkout_skipped_missing_subject']
  }

  const actions: string[] = []
  if (subscriptionId) {
    const subscription = await retrieveSubscription(stripe, subscriptionId)
    actions.push(...(await syncSubscription(payload, stripe, event, subscription, options)))
  } else if (customerId) {
    const subject = await getBillingSubject(payload, stripe, {
      eventId: event.id,
      eventType: event.type,
      livemode: event.livemode,
      stripeCustomerId: customerId,
      email: session.customer_email ?? session.customer_details?.email ?? null,
      billingStatus: 'active',
    })
    if (!subject) {
      await writeBillingAction(payload, {
        actionType: 'checkout_completed',
        status: 'skipped',
        eventId: event.id,
        notes: 'missing_customer_email',
      })
      return ['checkout_skipped_missing_email']
    }
  }

  await writeBillingAction(payload, {
    actionType: 'checkout_completed',
    status: 'completed',
    eventId: event.id,
    metadata: {
      checkoutSessionId: session.id,
      subscriptionId,
      customerId,
    },
  })
  actions.push('checkout_synced')
  return actions
}

async function markStripeEvent(
  payload: PayloadCourseWriteAPI,
  event: Stripe.Event,
  status: 'received' | 'processed' | 'deduped' | 'skipped' | 'failed',
  failureReason?: string | null
): Promise<{ doc: PayloadDocument; created: boolean }> {
  return upsertByWhere(
    payload,
    'payload_stripe_events',
    { eventId: { equals: event.id } },
    {
      eventId: event.id,
      eventType: event.type,
      livemode: event.livemode,
      processingStatus: status,
      receivedAt: new Date(event.created * 1000),
      processedAt: status === 'processed' || status === 'skipped' || status === 'deduped' ? new Date() : undefined,
      failureReason: failureReason ?? undefined,
      payload: event as unknown as Record<string, unknown>,
    }
  )
}

export async function mirrorStripeEventToPayload(
  payload: PayloadCourseWriteAPI,
  event: Stripe.Event,
  options: ShadowSyncOptions = {}
): Promise<PayloadBillingShadowSyncResult> {
  const existingEvent = await findOne(payload, 'payload_stripe_events', {
    eventId: { equals: event.id },
  })

  if (existingEvent?.processingStatus === 'processed') {
    return {
      enabled: true,
      processed: false,
      deduped: true,
      eventId: event.id,
      eventType: event.type,
      actions: ['event_deduped'],
    }
  }

  await markStripeEvent(payload, event, 'received')

  const stripe = options.stripe ?? await getDefaultStripeClient()
  let actions: string[] = []

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        actions = await syncCheckoutSession(
          payload,
          stripe,
          event,
          event.data.object as Stripe.Checkout.Session,
          options
        )
        break
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        actions = await syncSubscription(
          payload,
          stripe,
          event,
          event.data.object as Stripe.Subscription,
          options
        )
        break
      case 'invoice.paid':
        actions = await syncInvoice(
          payload,
          stripe,
          event,
          event.data.object as Stripe.Invoice,
          'paid',
          options
        )
        break
      case 'invoice.payment_failed':
        actions = await syncInvoice(
          payload,
          stripe,
          event,
          event.data.object as Stripe.Invoice,
          'failed',
          options
        )
        break
      default:
        await markStripeEvent(payload, event, 'skipped')
        return {
          enabled: true,
          processed: false,
          deduped: false,
          eventId: event.id,
          eventType: event.type,
          actions: ['unsupported_event_skipped'],
        }
    }

    await markStripeEvent(payload, event, 'processed')
    return {
      enabled: true,
      processed: true,
      deduped: false,
      eventId: event.id,
      eventType: event.type,
      actions,
    }
  } catch (error) {
    await markStripeEvent(payload, event, 'failed', (error as Error).message)
    throw error
  }
}

export async function shadowSyncStripeEventToPayload(
  event: Stripe.Event
): Promise<PayloadBillingShadowSyncResult> {
  if (!isPayloadBillingShadowSyncEnabled()) {
    return {
      enabled: false,
      processed: false,
      deduped: false,
      eventId: event.id,
      eventType: event.type,
      actions: ['feature_flag_disabled'],
    }
  }

  const [{ getPayload }, configModule] = await Promise.all([
    import('payload'),
    import('@payload-config'),
  ])
  const payload = await getPayload({ config: configModule.default })
  const stripe = await getDefaultStripeClient()
  return mirrorStripeEventToPayload(payload, event, {
    stripe,
    adminEmail: normalizeEmail(process.env.SUPPORT_TO_EMAIL),
  })
}
