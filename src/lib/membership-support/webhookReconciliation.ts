import type Stripe from 'stripe'

import { normalizeEmail } from '@/lib/normalize-email'
import type { PayloadCourseWriteAPI, PayloadDocument } from '@/lib/payloadCourse/accessService'
import type { MembershipFundingSource, MembershipSupportReconciliationState, MembershipVoucherDuration } from '@/lib/membership-support/domain'
import { buildMembershipSupportProjectionRecord, buildMembershipSupportReviewQueueProjection, type MembershipSupportProjectionRecord } from '@/lib/membership-support/workflows'

export type MembershipSupportWebhookClassifier =
  | 'matched'
  | 'pending'
  | 'customer_mismatch'
  | 'subscription_mismatch'
  | 'price_mismatch'
  | 'cadence_mismatch'
  | 'missing_coupon'
  | 'missing_promotion_code'
  | 'inactive_promotion_code'
  | 'funding_source_mismatch'
  | 'voucher_duration_mismatch'
  | 'deleted_subscription'
  | 'payment_failure'
  | 'stale_event'
  | 'duplicate_event'
  | 'event_ordering_conflict'
  | 'out_of_order_event'

type StripeClient = Pick<Stripe, 'subscriptions' | 'customers'>

type EventProjection = Readonly<{
  resourceKey: string
  memberId: string | null
  memberEmail: string | null
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  stripePriceId: string | null
  stripeProductId: string | null
  stripeCouponId: string | null
  stripePromotionCodeId: string | null
  promotionCodeActive: boolean | null
  subscriptionStatus: string | null
  billingCadence: 'monthly' | 'annual' | null
  renewalAt: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean | null
  paymentStatus: string | null
  fundingSource: Exclude<MembershipFundingSource, 'direct_payment'> | null
  voucherDuration: MembershipVoucherDuration | null
  discountStatus: 'active' | 'inactive' | 'missing' | 'unknown'
  membershipProductId: string | null
  membershipPriceId: string | null
  lastWebhookEventId: string
  lastWebhookCreatedAt: string
  lastReconciledAt: string
  reconciliationState: MembershipSupportReconciliationState
  classifier: MembershipSupportWebhookClassifier
  failureCode: string | null
  notes: string
  metadata: Record<string, unknown>
  supportProjection: MembershipSupportProjectionRecord | null
}>

type WebhookResult = Readonly<{
  projection: EventProjection
  reviewQueueReason: 'approval_required' | 'customer_restriction' | 'expiry_check' | 'idempotency_conflict' | 'webhook_mismatch' | 'manual_override' | null
  shadowState: 'pending' | 'matched' | 'mismatch' | 'failed'
}>

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function relationshipId(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    return typeof id === 'string' && id.trim() ? id.trim() : null
  }
  return null
}

function normalizeFundingSource(value: unknown): Exclude<MembershipFundingSource, 'direct_payment'> | null {
  const normalized = text(value)?.toLowerCase()
  return normalized === 'voucher' || normalized === 'pay_it_forward' ? normalized : null
}

function normalizeVoucherDuration(value: unknown): MembershipVoucherDuration | null {
  const normalized = text(value)?.toLowerCase()
  return normalized === 'one_month' || normalized === 'one_year' ? normalized : null
}

function normalizeCadence(value: unknown): 'monthly' | 'annual' | null {
  const normalized = text(value)?.toLowerCase()
  if (normalized === 'monthly' || normalized === 'month') return 'monthly'
  if (normalized === 'annual' || normalized === 'yearly' || normalized === 'year') return 'annual'
  return null
}

function normalizeDiscountStatus(value: boolean | null): 'active' | 'inactive' | 'missing' | 'unknown' {
  if (value === true) return 'active'
  if (value === false) return 'inactive'
  return 'unknown'
}

function stableKey(prefix: string, parts: Array<string | null | undefined>): string {
  return `${prefix}:${parts.map((part) => part?.trim() || '_').join(':')}`
}

async function findOne(
  payload: PayloadCourseWriteAPI,
  collection: string,
  where: Record<string, unknown>,
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

async function upsertByWhere(
  payload: PayloadCourseWriteAPI,
  collection: string,
  where: Record<string, unknown>,
  data: Record<string, unknown>,
): Promise<{ doc: PayloadDocument; created: boolean }> {
  const existing = await findOne(payload, collection, where)
  if (existing) {
    return {
      doc: await payload.update({
        collection,
        id: existing.id,
        data,
        overrideAccess: true,
      }),
      created: false,
    }
  }

  return {
    doc: await payload.create({
      collection,
      data,
      overrideAccess: true,
    }),
    created: true,
  }
}

async function resolveMemberContext(
  payload: PayloadCourseWriteAPI,
  params: { memberEmail: string | null; stripeCustomerId: string | null },
): Promise<{ memberId: string | null; memberEmail: string | null }> {
  const normalizedEmail = normalizeEmail(params.memberEmail)
  if (normalizedEmail) {
    const member = await findOne(payload, 'payload_members', {
      email: { equals: normalizedEmail },
    })
    if (member) {
      return { memberId: String(member.id), memberEmail: normalizedEmail }
    }
  }

  if (params.stripeCustomerId) {
    const billingAccount = await findOne(payload, 'payload_billing_accounts', {
      stripeCustomerId: { equals: params.stripeCustomerId },
    })
    const memberRelation = billingAccount ? (billingAccount as any).member : null
    const memberId = relationshipId(memberRelation)
    if (memberId) {
      const member = await payload.findByID({
        collection: 'payload_members',
        id: memberId,
        depth: 0,
        overrideAccess: true,
      })
      return {
        memberId: String(member.id),
        memberEmail: normalizeEmail(typeof member.email === 'string' ? member.email : normalizedEmail ?? '') ?? null,
      }
    }
  }

  return { memberId: null, memberEmail: normalizedEmail }
}

function extractSubscriptionContext(subscription: any): {
  priceId: string | null
  productId: string | null
  billingCadence: 'monthly' | 'annual' | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean | null
  subscriptionStatus: string | null
  renewalAt: string | null
} {
  if (!subscription) {
    return {
      priceId: null,
      productId: null,
      billingCadence: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: null,
      subscriptionStatus: null,
      renewalAt: null,
    }
  }

  const firstItem = subscription.items?.data?.[0] ?? null
  const recurring = firstItem?.price?.recurring ?? null
  const interval = text(recurring?.interval)?.toLowerCase()
  const billingCadence = interval === 'year' ? 'annual' : interval === 'month' ? 'monthly' : null
  const currentPeriodEnd =
    typeof subscription.current_period_end === 'number'
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null

  return {
    priceId: relationshipId(firstItem?.price) ?? null,
    productId: relationshipId(firstItem?.price?.product) ?? null,
    billingCadence,
    currentPeriodEnd,
    cancelAtPeriodEnd: typeof subscription.cancel_at_period_end === 'boolean' ? subscription.cancel_at_period_end : null,
    subscriptionStatus: text(subscription.status),
    renewalAt: currentPeriodEnd,
  }
}

function extractDiscountContext(source: any): {
  couponId: string | null
  promotionCodeId: string | null
  promotionCodeActive: boolean | null
  discountStatus: 'active' | 'inactive' | 'missing' | 'unknown'
} {
  const rawDiscount = source.discount ?? source.discounts?.data?.[0] ?? source.discounts?.[0] ?? null
  const discount = asRecord(rawDiscount)
  const couponId = relationshipId(discount.coupon)
  const promotionCode = asRecord(discount.promotion_code)
  const promotionCodeId = relationshipId(discount.promotion_code)
  const promotionCodeActive = typeof promotionCode.active === 'boolean' ? promotionCode.active : null

  if (!couponId && !promotionCodeId) {
    return {
      couponId: null,
      promotionCodeId: null,
      promotionCodeActive: null,
      discountStatus: 'missing',
    }
  }

  return {
    couponId,
    promotionCodeId,
    promotionCodeActive,
    discountStatus: normalizeDiscountStatus(promotionCodeActive),
  }
}

function extractMetadata(source: any): {
  fundingSource: Exclude<MembershipFundingSource, 'direct_payment'> | null
  voucherDuration: MembershipVoucherDuration | null
} {
  const metadata = asRecord(source.metadata)
  return {
    fundingSource:
      normalizeFundingSource(metadata.fundingSource) ??
      normalizeFundingSource(metadata.funding_source) ??
      normalizeFundingSource(metadata.source) ??
      null,
    voucherDuration:
      normalizeVoucherDuration(metadata.voucherDuration) ??
      normalizeVoucherDuration(metadata.voucher_duration) ??
      normalizeVoucherDuration(metadata.duration) ??
      null,
  }
}

async function resolveSubscription(
  stripe: StripeClient | null,
  subscriptionId: string | null,
  eventSubscription: any,
): Promise<any | null> {
  if (eventSubscription) return eventSubscription
  if (!stripe || !subscriptionId) return null
  return stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['customer', 'items.data.price'],
  })
}

function classifyWebhook(params: {
  existing: any | null
  eventId: string
  eventCreatedAt: string
  eventType: string
  customerId: string | null
  subscriptionId: string | null
  priceId: string | null
  billingCadence: 'monthly' | 'annual' | null
  fundingSource: Exclude<MembershipFundingSource, 'direct_payment'> | null
  voucherDuration: MembershipVoucherDuration | null
  couponId: string | null
  promotionCodeId: string | null
  promotionCodeActive: boolean | null
  paymentStatus: string | null
}): {
  classifier: MembershipSupportWebhookClassifier
  reconciliationState: MembershipSupportReconciliationState
  failureCode: string | null
} {
  const existing = params.existing
  const eventCreatedAt = new Date(params.eventCreatedAt).getTime()
  const existingCreatedAt = existing?.metadata?.lastWebhookCreatedAt ? new Date(existing.metadata.lastWebhookCreatedAt).getTime() : null
  const existingEventId = existing?.metadata?.lastWebhookEventId ?? null

  if (existingEventId === params.eventId) {
    return { classifier: 'duplicate_event', reconciliationState: existing.reconciliationState ?? 'pending', failureCode: 'duplicate_event' }
  }

  if (existingCreatedAt !== null) {
    if (eventCreatedAt < existingCreatedAt) {
      return { classifier: 'stale_event', reconciliationState: existing.reconciliationState ?? 'pending', failureCode: 'stale_event' }
    }
    if (eventCreatedAt === existingCreatedAt && existingEventId !== params.eventId) {
      return { classifier: 'event_ordering_conflict', reconciliationState: 'failed', failureCode: 'event_ordering_conflict' }
    }
  }

  if (params.eventType === 'customer.subscription.deleted') {
    return { classifier: 'deleted_subscription', reconciliationState: 'failed', failureCode: 'deleted_subscription' }
  }
  if (params.eventType === 'invoice.payment_failed') {
    return { classifier: 'payment_failure', reconciliationState: 'failed', failureCode: 'payment_failure' }
  }
  if (!existing && (params.eventType === 'invoice.paid' || params.eventType === 'invoice.payment_failed')) {
    return { classifier: 'out_of_order_event', reconciliationState: 'pending', failureCode: 'out_of_order_event' }
  }
  if (!existing && params.eventType === 'checkout.session.completed' && (!params.customerId || !params.subscriptionId)) {
    return { classifier: 'pending', reconciliationState: 'pending', failureCode: null }
  }

  if (existing) {
    if (existing.stripeCustomerId && params.customerId && existing.stripeCustomerId !== params.customerId) {
      return { classifier: 'customer_mismatch', reconciliationState: 'mismatch', failureCode: 'customer_mismatch' }
    }
    if (existing.stripeSubscriptionId && params.subscriptionId && existing.stripeSubscriptionId !== params.subscriptionId) {
      return { classifier: 'subscription_mismatch', reconciliationState: 'mismatch', failureCode: 'subscription_mismatch' }
    }
    if (existing.stripePriceId && params.priceId && existing.stripePriceId !== params.priceId) {
      return { classifier: 'price_mismatch', reconciliationState: 'mismatch', failureCode: 'price_mismatch' }
    }
    if (existing.billingCadence && params.billingCadence && existing.billingCadence !== params.billingCadence) {
      return { classifier: 'cadence_mismatch', reconciliationState: 'mismatch', failureCode: 'cadence_mismatch' }
    }
    if (existing.fundingSourceType && params.fundingSource && existing.fundingSourceType !== params.fundingSource) {
      return { classifier: 'funding_source_mismatch', reconciliationState: 'mismatch', failureCode: 'funding_source_mismatch' }
    }
    if (existing.voucherDuration && params.voucherDuration && existing.voucherDuration !== params.voucherDuration) {
      return { classifier: 'voucher_duration_mismatch', reconciliationState: 'mismatch', failureCode: 'voucher_duration_mismatch' }
    }
    if (existing.stripeCouponId && !params.couponId) {
      return { classifier: 'missing_coupon', reconciliationState: 'mismatch', failureCode: 'missing_coupon' }
    }
    if (existing.stripePromotionCodeId && !params.promotionCodeId) {
      return { classifier: 'missing_promotion_code', reconciliationState: 'mismatch', failureCode: 'missing_promotion_code' }
    }
    if (params.promotionCodeId && params.promotionCodeActive === false) {
      return { classifier: 'inactive_promotion_code', reconciliationState: 'mismatch', failureCode: 'inactive_promotion_code' }
    }
  }

  return { classifier: 'matched', reconciliationState: 'matched', failureCode: null }
}

function reviewQueueReasonForClassifier(
  classifier: MembershipSupportWebhookClassifier,
): 'approval_required' | 'customer_restriction' | 'expiry_check' | 'idempotency_conflict' | 'webhook_mismatch' | 'manual_override' | null {
  if (classifier === 'matched' || classifier === 'pending' || classifier === 'duplicate_event' || classifier === 'stale_event') {
    return null
  }
  if (classifier === 'payment_failure' || classifier === 'deleted_subscription') return 'manual_override'
  if (classifier === 'event_ordering_conflict' || classifier === 'out_of_order_event') return 'idempotency_conflict'
  return 'webhook_mismatch'
}

async function buildProjection(params: {
  payload: PayloadCourseWriteAPI
  event: Stripe.Event
  stripe: StripeClient | null
}): Promise<WebhookResult> {
  const eventObject: any = params.event.data.object
  const eventTime = new Date(params.event.created * 1000).toISOString()

  const rawSubscription =
    params.event.type === 'customer.subscription.created' ||
    params.event.type === 'customer.subscription.updated' ||
    params.event.type === 'customer.subscription.deleted'
      ? eventObject
      : null
  const sessionSubscriptionId =
    params.event.type === 'checkout.session.completed' || params.event.type === 'checkout.session.async_payment_succeeded'
      ? relationshipId(eventObject.subscription)
      : null
  const subscriptionEventId =
    params.event.type === 'customer.subscription.created' ||
    params.event.type === 'customer.subscription.updated' ||
    params.event.type === 'customer.subscription.deleted'
      ? text(eventObject.id)
      : null
  const subscriptionId =
    subscriptionEventId ??
    relationshipId(eventObject.subscription) ??
    sessionSubscriptionId ??
    relationshipId(eventObject.subscription_id) ??
    null
  const customerEventId =
    params.event.type === 'customer.updated'
      ? text(eventObject.id)
      : null
  const customerId =
    customerEventId ??
    relationshipId(eventObject.customer) ??
    relationshipId(eventObject.customer_id) ??
    null

  const subscription = await resolveSubscription(params.stripe, subscriptionId, rawSubscription)
  const subscriptionContext = extractSubscriptionContext(subscription)
  const discountContext = extractDiscountContext(eventObject)
  const metadataContext = extractMetadata(eventObject)

  const memberContext = await resolveMemberContext(params.payload, {
    memberEmail:
      text(eventObject.customer_email) ??
      text(eventObject.email) ??
      text(eventObject.customer_details?.email) ??
      text(eventObject.customer?.email) ??
      null,
    stripeCustomerId: customerId,
  })

  const supportLookupWhere = subscriptionId
    ? { stripeSubscriptionId: { equals: subscriptionId } }
    : customerId
      ? { stripeCustomerId: { equals: customerId } }
      : null
  const supportRecord = supportLookupWhere
    ? await findOne(params.payload, 'payload_membership_support_records', supportLookupWhere)
    : null
  const existing = supportRecord ? {
    fundingSource: text((supportRecord as any).fundingSourceType),
    voucherDuration: text((supportRecord as any).voucherDuration),
    billingCadence: normalizeCadence((supportRecord as any).billingCadence),
    stripeCustomerId: text((supportRecord as any).stripeCustomerId),
    stripeSubscriptionId: text((supportRecord as any).stripeSubscriptionId),
    stripePriceId: text((supportRecord as any).stripePriceId),
    stripeCouponId: text((supportRecord as any).stripeCouponId),
    stripePromotionCodeId: text((supportRecord as any).stripePromotionCodeId),
    lastWebhookAt: text((supportRecord as any).lastWebhookAt) ?? eventTime,
    metadata: asRecord((supportRecord as any).metadata),
    reconciliationState: text((supportRecord as any).reconciliationState) ?? 'pending',
  } : null

  let derivedFundingSource: Exclude<MembershipFundingSource, 'direct_payment'> = 'voucher'
  if (metadataContext.fundingSource) {
    derivedFundingSource = metadataContext.fundingSource
  } else if (existing?.fundingSource === 'voucher' || existing?.fundingSource === 'pay_it_forward') {
    derivedFundingSource = existing.fundingSource
  }

  let derivedVoucherDuration: MembershipVoucherDuration = 'one_month'
  if (metadataContext.voucherDuration) {
    derivedVoucherDuration = metadataContext.voucherDuration
  } else if (existing?.voucherDuration === 'one_month' || existing?.voucherDuration === 'one_year') {
    derivedVoucherDuration = existing.voucherDuration
  } else if (subscriptionContext.billingCadence === 'annual') {
    derivedVoucherDuration = 'one_year'
  }

  const classifier = classifyWebhook({
    existing,
    eventId: params.event.id,
    eventCreatedAt: eventTime,
    eventType: params.event.type,
    customerId,
    subscriptionId,
    priceId: subscriptionContext.priceId,
    billingCadence: subscriptionContext.billingCadence,
    fundingSource: derivedFundingSource,
    voucherDuration: derivedVoucherDuration,
    couponId: discountContext.couponId,
    promotionCodeId: discountContext.promotionCodeId,
    promotionCodeActive: discountContext.promotionCodeActive,
    paymentStatus: params.event.type === 'invoice.payment_failed' ? 'failed' : params.event.type === 'invoice.paid' ? 'paid' : null,
  })

  const resourceKey = stableKey('membership-support', [subscriptionId ?? customerId, memberContext.memberEmail])
  const supportProjection = memberContext.memberId
    ? buildMembershipSupportProjectionRecord({
        source: derivedFundingSource,
        recordId: resourceKey,
        memberId: memberContext.memberId,
        memberEmail: memberContext.memberEmail ?? 'unknown@example.com',
        voucherDuration: derivedVoucherDuration,
        billingCadence: subscriptionContext.billingCadence ?? 'monthly',
        stripeCustomerId: customerId ?? existing?.stripeCustomerId ?? '',
        stripeSubscriptionId: subscriptionId,
        couponId: discountContext.couponId ?? existing?.stripeCouponId ?? '',
        promotionCodeId: discountContext.promotionCodeId ?? existing?.stripePromotionCodeId ?? '',
        approvalReference: `webhook:${params.event.id}`,
        operatorId: 'stripe-webhook',
        reason: `Stripe webhook ${params.event.type}`,
        now: new Date(eventTime),
        reconciliationState: classifier.reconciliationState === 'matched' ? 'matched' : 'mismatch',
      })
    : null

  return {
    projection: {
      resourceKey,
      memberId: memberContext.memberId,
      memberEmail: memberContext.memberEmail,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      stripePriceId: subscriptionContext.priceId,
      stripeProductId: subscriptionContext.productId,
      stripeCouponId: discountContext.couponId,
      stripePromotionCodeId: discountContext.promotionCodeId,
      promotionCodeActive: discountContext.promotionCodeActive,
      subscriptionStatus: subscriptionContext.subscriptionStatus,
      billingCadence: subscriptionContext.billingCadence,
      renewalAt: subscriptionContext.renewalAt,
      currentPeriodEnd: subscriptionContext.currentPeriodEnd,
      cancelAtPeriodEnd: subscriptionContext.cancelAtPeriodEnd,
      paymentStatus: params.event.type === 'invoice.payment_failed' ? 'failed' : params.event.type === 'invoice.paid' ? 'paid' : subscriptionContext.subscriptionStatus,
      fundingSource: derivedFundingSource,
      voucherDuration: derivedVoucherDuration,
      discountStatus: discountContext.discountStatus,
      membershipProductId: subscriptionContext.productId,
      membershipPriceId: subscriptionContext.priceId,
      lastWebhookEventId: params.event.id,
      lastWebhookCreatedAt: eventTime,
      lastReconciledAt: eventTime,
      reconciliationState: classifier.reconciliationState,
      classifier: classifier.classifier,
      failureCode: classifier.failureCode,
      notes: `membership-support webhook ${params.event.type} classified as ${classifier.classifier}`,
      metadata: {
        lastWebhookEventId: params.event.id,
        lastWebhookCreatedAt: eventTime,
        lastReconciledAt: eventTime,
        classifier: classifier.classifier,
        failureCode: classifier.failureCode,
        membershipProductId: subscriptionContext.productId,
        membershipPriceId: subscriptionContext.priceId,
        subscriptionStatus: subscriptionContext.subscriptionStatus,
        billingCadence: subscriptionContext.billingCadence,
        renewalAt: subscriptionContext.renewalAt,
        currentPeriodEnd: subscriptionContext.currentPeriodEnd,
        cancelAtPeriodEnd: subscriptionContext.cancelAtPeriodEnd,
        paymentStatus: params.event.type === 'invoice.payment_failed' ? 'failed' : params.event.type === 'invoice.paid' ? 'paid' : subscriptionContext.subscriptionStatus,
        fundingSource: derivedFundingSource,
        voucherDuration: derivedVoucherDuration,
        discountStatus: discountContext.discountStatus,
        couponId: discountContext.couponId,
        promotionCodeId: discountContext.promotionCodeId,
        promotionCodeActive: discountContext.promotionCodeActive,
      },
      supportProjection,
    },
    reviewQueueReason: reviewQueueReasonForClassifier(classifier.classifier),
    shadowState: classifier.reconciliationState,
  }
}

async function persistProjection(
  payload: PayloadCourseWriteAPI,
  event: Stripe.Event,
  result: WebhookResult,
): Promise<string[]> {
  const projection = result.projection
  const actions: string[] = []
  if (!projection.memberId || !projection.memberEmail) {
    actions.push('membership_support_skipped_missing_member')
    return actions
  }

  const memberReference = /^\d+$/.test(projection.memberId)
    ? Number(projection.memberId)
    : projection.memberId

  const supportData = {
    displayName: `Membership support ${projection.resourceKey}`,
    member: memberReference,
    memberEmail: projection.memberEmail,
    fundingSourceType: projection.fundingSource,
    voucherDuration: projection.voucherDuration,
    issuanceState:
      projection.classifier === 'deleted_subscription'
        ? 'deactivated'
        : projection.reconciliationState === 'matched'
          ? 'issued'
          : 'draft',
    billingCadence: projection.billingCadence ?? 'monthly',
    stripeCustomerId: projection.stripeCustomerId ?? undefined,
    stripeSubscriptionId: projection.stripeSubscriptionId ?? undefined,
    stripePriceId: projection.membershipPriceId ?? undefined,
    stripeCouponId: projection.stripeCouponId ?? undefined,
    stripePromotionCodeId: projection.stripePromotionCodeId ?? undefined,
    approvalReference: `webhook:${event.id}`,
    reconciliationState: projection.reconciliationState,
    lastWebhookAt: new Date(projection.lastWebhookCreatedAt),
    notes: projection.notes,
    metadata: projection.metadata,
  }

  const supportWhere = projection.stripeSubscriptionId
    ? { stripeSubscriptionId: { equals: projection.stripeSubscriptionId } }
    : { stripeCustomerId: { equals: projection.stripeCustomerId } }
  const supportResult = await upsertByWhere(payload, 'payload_membership_support_records', supportWhere, supportData)
  actions.push(supportResult.created ? 'membership_support_created' : 'membership_support_updated')

  const reconciliationResult = await upsertByWhere(
    payload,
    'payload_membership_reconciliations',
    { displayName: { equals: `Reconciliation ${projection.resourceKey}` } },
    {
      displayName: `Reconciliation ${projection.resourceKey}`,
      membershipSupport: supportResult.doc.id,
      member: memberReference,
      stripeEventId: event.id,
      stripeEventType: event.type,
      reconciliationState: projection.reconciliationState,
      failureCode: projection.failureCode ?? undefined,
      lastWebhookAt: new Date(projection.lastWebhookCreatedAt),
      resolvedAt: projection.reconciliationState === 'matched' ? new Date(projection.lastReconciledAt) : undefined,
      notes: projection.notes,
      metadata: projection.metadata,
    },
  )
  actions.push(reconciliationResult.created ? 'membership_reconciliation_created' : 'membership_reconciliation_updated')

  const reviewQueueReason = result.reviewQueueReason
  if (reviewQueueReason) {
    const reviewProjection = buildMembershipSupportReviewQueueProjection({
      action: `webhook_${event.type.replace(/\./g, '_')}`,
      targetId: projection.resourceKey,
      reason: reviewQueueReason,
      notes: projection.notes,
      approvalReference: `webhook:${event.id}`,
      now: new Date(projection.lastReconciledAt),
      metadata: {
        sourceEventId: event.id,
        membershipSupportReference: supportResult.doc.id,
        memberId: projection.memberId,
        migrationCandidateReference: projection.resourceKey,
      },
      memberReference: projection.memberId,
      migrationCandidateReference: projection.resourceKey,
    })
    const reviewResult = await upsertByWhere(
      payload,
      'payload_membership_review_queue_items',
      { displayName: { equals: `Review queue ${projection.resourceKey}` } },
      {
        displayName: `Review queue ${projection.resourceKey}`,
        membershipSupport: supportResult.doc.id,
        reconciliation: reconciliationResult.doc.id,
        member: memberReference,
        queueState: projection.reconciliationState === 'matched' ? 'closed' : 'needs_review',
        queueReason: reviewQueueReason,
        priority: reviewProjection.priority,
        assignedTo: undefined,
        dueAt: undefined,
        resolvedAt: projection.reconciliationState === 'matched' ? new Date(projection.lastReconciledAt) : undefined,
        notes: projection.notes,
        metadata: {
          ...projection.metadata,
          queueType: reviewProjection.queueType,
          dedupeKey: reviewProjection.dedupeKey,
          requiredAction: reviewProjection.requiredAction,
          reasonCode: reviewProjection.reasonCode,
          evidenceSummary: reviewProjection.evidenceSummary,
          sourceEventId: reviewProjection.sourceEventId,
        },
      },
    )
    actions.push(reviewResult.created ? 'membership_review_created' : 'membership_review_updated')
  } else {
    const existingReview = await findOne(payload, 'payload_membership_review_queue_items', {
      displayName: { equals: `Review queue ${projection.resourceKey}` },
    })
    if (existingReview && existingReview.queueState !== 'closed') {
      await payload.update({
        collection: 'payload_membership_review_queue_items',
        id: existingReview.id,
        data: {
          queueState: 'closed',
          resolvedAt: new Date(projection.lastReconciledAt),
          notes: projection.notes,
          metadata: projection.metadata,
        },
        overrideAccess: true,
      })
      actions.push('membership_review_closed')
    }
  }

  await upsertByWhere(
    payload,
    'payload_stripe_shadow_projections',
    { displayName: { equals: `Stripe shadow ${projection.resourceKey}` } },
    {
      displayName: `Stripe shadow ${projection.resourceKey}`,
      membershipSupport: supportResult.doc.id,
      member: memberReference,
      stripeCustomerId: projection.stripeCustomerId ?? undefined,
      stripeSubscriptionId: projection.stripeSubscriptionId ?? undefined,
      stripePriceId: projection.stripePriceId ?? undefined,
      stripeCouponId: projection.stripeCouponId ?? undefined,
      stripePromotionCodeId: projection.stripePromotionCodeId ?? undefined,
      stripeEventId: projection.lastWebhookEventId,
      shadowState: result.shadowState,
      lastWebhookAt: new Date(projection.lastWebhookCreatedAt),
      shadowedAt: new Date(projection.lastReconciledAt),
      observedStatus: projection.subscriptionStatus ?? projection.paymentStatus ?? projection.discountStatus,
      notes: projection.notes,
      metadata: projection.metadata,
    },
  )
  actions.push('membership_shadow_updated')

  return actions
}

export async function mirrorMembershipSupportWebhookToPayload(
  payload: PayloadCourseWriteAPI,
  event: Stripe.Event,
  stripe: StripeClient | null,
): Promise<string[]> {
  if (
    event.type !== 'checkout.session.completed' &&
    event.type !== 'checkout.session.async_payment_succeeded' &&
    event.type !== 'customer.subscription.created' &&
    event.type !== 'customer.subscription.updated' &&
    event.type !== 'customer.subscription.deleted' &&
    event.type !== 'invoice.paid' &&
    event.type !== 'invoice.payment_failed' &&
    event.type !== 'customer.updated'
  ) {
    return []
  }

  return persistProjection(payload, event, await buildProjection({ payload, event, stripe }))
}
