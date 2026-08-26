import { createHash } from 'node:crypto'

import { normalizeEmail } from '@/lib/normalize-email'
import type {
  MembershipFundingSource,
  MembershipSupportIssuanceState,
  MembershipSupportRecord,
  MembershipVoucherDuration,
} from '@/lib/membership-support/domain'
import { isMembershipSupportRecordReady, validateMembershipSupportRecord } from '@/lib/membership-support/domain'
import { issueMembershipSupportVoucher } from '@/lib/membership-support/service'
import type { MembershipSupportStripeAdapter } from '@/lib/membership-support/stripeAdapter'
import { voucherDurationDays } from '@/lib/membership-support/stripeRequests'

export type MembershipSupportAuditActorType = 'admin' | 'member' | 'stripe' | 'system' | 'migration'
export type MembershipSupportAuditSeverity = 'info' | 'warning' | 'critical'

export type MembershipSupportWorkflowAuditEvent = Readonly<{
  id: string
  displayName: string
  actorType: MembershipSupportAuditActorType
  actorId: string
  action: string
  targetCollection: string
  targetId: string
  severity: MembershipSupportAuditSeverity
  approvalReference: string
  before: unknown
  after: unknown
  notes: string
  metadata: Record<string, unknown>
  createdAt: string
}>

export type MembershipSupportWorkflowReviewQueueItem = Readonly<{
  id: string
  displayName: string
  queueState: 'needs_review' | 'in_review' | 'approved' | 'rejected' | 'closed'
  queueReason: 'approval_required' | 'customer_restriction' | 'expiry_check' | 'idempotency_conflict' | 'webhook_mismatch' | 'manual_override'
  priority: number
  assignedTo: string | null
  dueAt: string | null
  resolvedAt: string | null
  notes: string
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
  projection: MembershipSupportReviewQueueProjection
}>

export type MembershipSupportVoucherRecord = Readonly<{
  id: string
  displayName: string
  memberId: string
  memberEmail: string
  fundingSource: Exclude<MembershipFundingSource, 'direct_payment'>
  voucherDuration: MembershipVoucherDuration
  approvalState: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'issued' | 'revoked' | 'failed'
  redemptionState: 'not_redeemed' | 'redeemed' | 'expired' | 'deactivated'
  billingCadence: 'monthly' | 'annual'
  stripeCustomerId: string | null
  stripeCouponId: string | null
  stripePromotionCodeId: string | null
  stripeSubscriptionId: string | null
  approvalReference: string | null
  issuedBy: string | null
  approvedBy: string | null
  issuedAt: string | null
  expiresAt: string | null
  redeemedAt: string | null
  deactivatedAt: string | null
  reason: string
  notes: string
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}>

export type MembershipSupportPayItForwardAllocationRecord = Readonly<{
  id: string
  displayName: string
  memberId: string
  memberEmail: string
  donorName: string
  approvalState: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'issued' | 'revoked' | 'failed'
  billingCadence: 'monthly' | 'annual'
  allocatedAmountMinor: number
  currency: string
  stripeCustomerId: string | null
  stripeCouponId: string | null
  stripePromotionCodeId: string | null
  stripeSubscriptionId: string | null
  approvalReference: string | null
  issuedBy: string | null
  approvedBy: string | null
  issuedAt: string | null
  expiresAt: string | null
  redeemedAt: string | null
  revokedAt: string | null
  reason: string
  notes: string
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}>

export type MembershipSupportProjectionRecord = Readonly<{
  id: string
  fundingSource: Exclude<MembershipFundingSource, 'direct_payment'>
  voucherDuration: MembershipVoucherDuration
  issuanceState: MembershipSupportIssuanceState
  intendedRecipientEmail: string
  stripeCustomerId: string
  stripeCouponId: string
  stripePromotionCodeId: string
  stripeSubscriptionId: string | null
  billingCadence: 'monthly' | 'annual'
  issuedBy: string
  approvedBy: string | null
  issuedAt: string
  expiresAt: string
  redeemedAt: string | null
  deactivatedAt: string | null
  reason: string
  approvalReference: string
  reconciliationState: MembershipSupportRecord['reconciliationState']
  lastWebhookAt: string
  displayName: string
  memberId: string
  memberEmail: string
  notes: string
  createdAt: string
  updatedAt: string
}>

type CachedWorkflowResult = Readonly<{ auditEventId: string; result: unknown }>

export type MembershipSupportWorkflowJournalSnapshot = Readonly<{
  vouchers: MembershipSupportVoucherRecord[]
  payItForwardAllocations: MembershipSupportPayItForwardAllocationRecord[]
  supportProjections: MembershipSupportProjectionRecord[]
  auditHistory: MembershipSupportWorkflowAuditEvent[]
  reviewQueue: MembershipSupportWorkflowReviewQueueItem[]
}>

export class InMemoryMembershipSupportWorkflowJournal {
  private readonly cachedResults = new Map<string, CachedWorkflowResult>()
  private readonly auditHistory = new Map<string, MembershipSupportWorkflowAuditEvent>()
  private readonly reviewQueue = new Map<string, MembershipSupportWorkflowReviewQueueItem>()
  private readonly vouchers = new Map<string, MembershipSupportVoucherRecord>()
  private readonly payItForwardAllocations = new Map<string, MembershipSupportPayItForwardAllocationRecord>()
  private readonly supportProjections = new Map<string, MembershipSupportProjectionRecord>()

  memoize<T>(idempotencyKey: string, factory: () => T): T {
    const cached = this.cachedResults.get(idempotencyKey)
    if (cached) return cached.result as T

    const result = factory()
    const stored = freezeDeep(result)
    this.cachedResults.set(idempotencyKey, { auditEventId: extractAuditEventId(stored), result: stored })
    return stored as T
  }

  appendAuditEvent(event: MembershipSupportWorkflowAuditEvent): MembershipSupportWorkflowAuditEvent {
    const frozen = freezeDeep(event)
    this.auditHistory.set(frozen.id, frozen)
    return frozen
  }

  enqueueReviewItem(item: MembershipSupportWorkflowReviewQueueItem): MembershipSupportWorkflowReviewQueueItem {
    const frozen = freezeDeep(item)
    this.reviewQueue.set(frozen.id, frozen)
    return frozen
  }

  upsertVoucher(voucher: MembershipSupportVoucherRecord): MembershipSupportVoucherRecord {
    const frozen = freezeDeep(voucher)
    this.vouchers.set(frozen.id, frozen)
    return frozen
  }

  upsertPayItForwardAllocation(
    allocation: MembershipSupportPayItForwardAllocationRecord,
  ): MembershipSupportPayItForwardAllocationRecord {
    const frozen = freezeDeep(allocation)
    this.payItForwardAllocations.set(frozen.id, frozen)
    return frozen
  }

  upsertSupportProjection(projection: MembershipSupportProjectionRecord): MembershipSupportProjectionRecord {
    const frozen = freezeDeep(projection)
    this.supportProjections.set(frozen.id, frozen)
    return frozen
  }

  snapshot(): MembershipSupportWorkflowJournalSnapshot {
    return freezeDeep({
      vouchers: [...this.vouchers.values()],
      payItForwardAllocations: [...this.payItForwardAllocations.values()],
      supportProjections: [...this.supportProjections.values()],
      auditHistory: [...this.auditHistory.values()],
      reviewQueue: [...this.reviewQueue.values()],
    })
  }
}

export type MembershipSupportWorkflowContext = Readonly<{
  operatorId: string
  approvalReference: string
  now: Date
}>

export type DraftVoucherInput = Readonly<{
  id: string
  memberId: string
  memberEmail: string
  voucherDuration: MembershipVoucherDuration
  billingCadence: 'monthly' | 'annual'
  fundingSource?: Exclude<MembershipFundingSource, 'direct_payment'>
  stripeCustomerId: string
  stripeSubscriptionId: string | null
  reason: string
  notes?: string
  metadata?: Record<string, unknown>
}>

export type PayItForwardAllocationInput = Readonly<{
  id: string
  memberId: string
  memberEmail: string
  donorName: string
  billingCadence: 'monthly' | 'annual'
  allocatedAmountMinor: number
  currency?: string
  stripeCustomerId: string
  stripeSubscriptionId: string | null
  reason: string
  notes?: string
  metadata?: Record<string, unknown>
}>

export type WorkflowFailure = Readonly<{
  ok: false
  error: string
  auditEvent: MembershipSupportWorkflowAuditEvent
  reviewQueueItem: MembershipSupportWorkflowReviewQueueItem
}>

export type WorkflowSuccess<T> = Readonly<{
  ok: true
  value: T
  auditEvent: MembershipSupportWorkflowAuditEvent
}>

export type WorkflowResult<T> = WorkflowSuccess<T> | WorkflowFailure

export type MembershipSupportReviewQueueType =
  | 'voucher_approval'
  | 'pay_it_forward_approval'
  | 'voucher_issuance_failure'
  | 'provider_failure'
  | 'missing_promotion_code'
  | 'inactive_promotion_code'
  | 'customer_mismatch'
  | 'subscription_mismatch'
  | 'price_mismatch'
  | 'cadence_mismatch'
  | 'webhook_reconciliation_mismatch'
  | 'payment_failure'
  | 'subscription_deletion'
  | 'stale_event_conflict'
  | 'migration_manual_review'
  | 'migration_preview_mismatch'
  | 'illegal_workflow_transition'

export type MembershipSupportReviewQueueProjection = Readonly<{
  dedupeKey: string
  queueType: MembershipSupportReviewQueueType
  priority: number
  membershipSupportReference: string
  memberReference: string | null
  migrationCandidateReference: string | null
  reasonCode: string
  evidenceSummary: string
  requiredAction: string
  status: 'open' | 'closed'
  createdAt: string
  updatedAt: string
  assignedOperator: string | null
  resolutionNote: string | null
  resolvedAt: string | null
  sourceEventId: string | null
}>

type VoucherAction = {
  voucher: MembershipSupportVoucherRecord
  projection: MembershipSupportProjectionRecord
}

type PayItForwardAction = {
  allocation: MembershipSupportPayItForwardAllocationRecord
  projection: MembershipSupportProjectionRecord
}

function requireOperatorId(operatorId: string | null | undefined): string {
  const normalized = normalizeText(operatorId)
  if (!normalized) throw new Error('operator_required')
  return normalized
}

function requireApprovalReference(approvalReference: string | null | undefined): string {
  const normalized = normalizeText(approvalReference)
  if (!normalized) throw new Error('approval_reference_required')
  return normalized
}

function normalizeText(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : ''
}

function sanitizeReviewQueueText(value: string): string {
  return value
    .replace(/\b(sk_live|sk_test|whsec|cus|sub|price|pm|pi|evt|promo)_[A-Za-z0-9_-]+\b/gi, '[redacted]')
    .replace(/\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi, '[email-redacted]')
}

function queueReasonForAction(action: string, reason: string): MembershipSupportWorkflowReviewQueueItem['queueReason'] {
  if (reason.includes('approval')) return 'approval_required'
  if (reason.includes('customer')) return 'customer_restriction'
  if (reason.includes('idempotency')) return 'idempotency_conflict'
  if (reason.includes('webhook') || reason.includes('reconcile') || reason.includes('price') || reason.includes('cadence')) return 'webhook_mismatch'
  if (reason.includes('expiry')) return 'expiry_check'
  if (reason.includes('payment') || reason.includes('provider') || reason.includes('manual')) return 'manual_override'
  if (action.includes('transition')) return 'manual_override'
  return 'manual_override'
}

function reviewQueueTypeForAction(action: string, reason: string, metadata?: Record<string, unknown>): MembershipSupportReviewQueueType {
  const normalizedAction = action.toLowerCase()
  const normalizedReason = reason.toLowerCase()
  if (normalizedAction.includes('submit_for_approval') && normalizedAction.includes('pay_it_forward')) return 'pay_it_forward_approval'
  if (normalizedAction.includes('submit_for_approval')) return 'voucher_approval'
  if (normalizedReason.includes('idempotency')) return 'stale_event_conflict'
  if (normalizedReason.includes('approval') && normalizedAction.includes('pay_it_forward')) return 'pay_it_forward_approval'
  if (normalizedReason.includes('approval')) return 'voucher_approval'
  if (normalizedReason.includes('expiry')) return 'voucher_issuance_failure'
  if (normalizedReason.includes('customer')) return 'customer_mismatch'
  if (normalizedReason.includes('price')) return 'price_mismatch'
  if (normalizedReason.includes('cadence')) return 'cadence_mismatch'
  if (normalizedReason.includes('subscription')) return 'subscription_mismatch'
  if (normalizedReason.includes('payment')) return 'payment_failure'
  if (normalizedReason.includes('provider')) return 'provider_failure'
  if (normalizedReason.includes('manual') && normalizedAction.includes('projection')) return 'migration_manual_review'
  if (normalizedReason.includes('webhook') && normalizedAction.includes('review_routed')) return 'migration_preview_mismatch'
  if (normalizedReason.includes('webhook')) return 'webhook_reconciliation_mismatch'
  if (normalizedReason.includes('transition')) return 'illegal_workflow_transition'
  if (metadata && (metadata.migrationCandidateId || metadata.migrationCandidateReference)) return 'migration_manual_review'
  return 'migration_manual_review'
}

function reviewQueuePriorityForType(queueType: MembershipSupportReviewQueueType): number {
  switch (queueType) {
    case 'stale_event_conflict':
      return 10
    case 'webhook_reconciliation_mismatch':
    case 'migration_preview_mismatch':
      return 20
    case 'payment_failure':
      return 25
    case 'customer_mismatch':
    case 'subscription_mismatch':
    case 'price_mismatch':
    case 'cadence_mismatch':
    case 'missing_promotion_code':
    case 'inactive_promotion_code':
      return 30
    case 'migration_manual_review':
      return 40
    case 'voucher_approval':
    case 'pay_it_forward_approval':
    case 'voucher_issuance_failure':
      return 50
    case 'provider_failure':
      return 60
    case 'subscription_deletion':
      return 65
    case 'illegal_workflow_transition':
      return 70
  }
}

function requiredActionForQueueType(queueType: MembershipSupportReviewQueueType): string {
  switch (queueType) {
    case 'voucher_approval':
      return 'review voucher approval request'
    case 'pay_it_forward_approval':
      return 'review pay-it-forward approval request'
    case 'voucher_issuance_failure':
      return 'review voucher issuance failure'
    case 'provider_failure':
      return 'review provider failure'
    case 'missing_promotion_code':
      return 'restore promotion code'
    case 'inactive_promotion_code':
      return 'reactivate promotion code'
    case 'customer_mismatch':
      return 'verify customer ownership'
    case 'subscription_mismatch':
      return 'verify subscription ownership'
    case 'price_mismatch':
      return 'verify price mapping'
    case 'cadence_mismatch':
      return 'verify billing cadence'
    case 'webhook_reconciliation_mismatch':
      return 'reconcile webhook mismatch'
    case 'payment_failure':
      return 'review payment failure'
    case 'subscription_deletion':
      return 'review subscription deletion'
    case 'stale_event_conflict':
      return 'resolve stale event conflict'
    case 'migration_manual_review':
      return 'review migration manually'
    case 'migration_preview_mismatch':
      return 'review migration preview mismatch'
    case 'illegal_workflow_transition':
      return 'fix workflow transition'
  }
}

export function buildMembershipSupportReviewQueueProjection(params: {
  action: string
  targetId: string
  reason: string
  notes: string
  approvalReference: string
  now: Date
  metadata?: Record<string, unknown>
  memberReference?: string | null
  migrationCandidateReference?: string | null
  assignedOperator?: string | null
  resolvedAt?: Date | null
}): MembershipSupportReviewQueueProjection {
  const queueType = reviewQueueTypeForAction(params.action, params.reason, params.metadata)
  const noteSummary = sanitizeReviewQueueText(params.notes).slice(0, 240)
  const sourceEventId = normalizeText(typeof params.metadata?.sourceEventId === 'string' ? params.metadata.sourceEventId : null) || null
  const membershipSupportReference =
    normalizeText(typeof params.metadata?.membershipSupportReference === 'string' ? params.metadata.membershipSupportReference : null) ||
    params.targetId
  const memberReference =
    normalizeText(typeof params.metadata?.memberId === 'string' ? params.metadata.memberId : null) ||
    params.memberReference ||
    null
  const migrationCandidateReference =
    normalizeText(typeof params.metadata?.migrationCandidateReference === 'string' ? params.metadata.migrationCandidateReference : null) ||
    params.migrationCandidateReference ||
    null
  const dedupeKey = createHash('sha256')
    .update([
      queueType,
      membershipSupportReference,
      memberReference ?? '_',
      migrationCandidateReference ?? '_',
      params.approvalReference,
      sourceEventId ?? '_',
      params.reason,
    ].join(':'))
    .digest('hex')

  return freezeDeep({
    dedupeKey: `review_${dedupeKey}`,
    queueType,
    priority: reviewQueuePriorityForType(queueType),
    membershipSupportReference,
    memberReference,
    migrationCandidateReference,
    reasonCode: params.reason,
    evidenceSummary: noteSummary,
    requiredAction: requiredActionForQueueType(queueType),
    status: params.resolvedAt ? 'closed' as const : 'open' as const,
    createdAt: params.now.toISOString(),
    updatedAt: (params.resolvedAt ?? params.now).toISOString(),
    assignedOperator: params.assignedOperator ?? null,
    resolutionNote: params.resolvedAt ? noteSummary || null : null,
    resolvedAt: params.resolvedAt?.toISOString() ?? null,
    sourceEventId,
  })
}

function normalizeEmailOrThrow(value: string | null | undefined): string {
  const normalized = normalizeEmail(value)
  if (!normalized) throw new Error('member_email_required')
  return normalized
}

function normalizeFundingSource(value: MembershipFundingSource | undefined): Exclude<MembershipFundingSource, 'direct_payment'> {
  if (value === 'voucher' || value === 'pay_it_forward') return value
  return 'voucher'
}

function deriveStableId(prefix: string, parts: string[]): string {
  return `${prefix}_${createHash('sha256').update(parts.join(':')).digest('hex').slice(0, 16)}`
}

function freezeDeep<T>(value: T): T {
  if (!value || typeof value !== 'object') return value
  if (Object.isFrozen(value)) return value
  Object.freeze(value)
  for (const nested of Object.values(value as Record<string, unknown>)) {
    if (nested && typeof nested === 'object') freezeDeep(nested)
  }
  return value
}

function extractAuditEventId(value: unknown): string {
  if (value && typeof value === 'object' && 'auditEvent' in value) {
    const event = (value as { auditEvent?: { id?: string } }).auditEvent
    if (event?.id) return event.id
  }
  return ''
}

function createAuditEvent(params: {
  action: string
  targetCollection: string
  targetId: string
  operatorId: string
  approvalReference: string
  before: unknown
  after: unknown
  notes: string
  severity?: MembershipSupportAuditSeverity
  metadata?: Record<string, unknown>
  now: Date
}): MembershipSupportWorkflowAuditEvent {
  const id = deriveStableId('audit', [params.action, params.targetCollection, params.targetId, params.approvalReference])
  return freezeDeep({
    id,
    displayName: `${params.action} - ${params.targetId}`,
    actorType: 'admin',
    actorId: params.operatorId,
    action: params.action,
    targetCollection: params.targetCollection,
    targetId: params.targetId,
    severity: params.severity ?? 'info',
    approvalReference: params.approvalReference,
    before: params.before,
    after: params.after,
    notes: params.notes,
    metadata: params.metadata ?? {},
    createdAt: params.now.toISOString(),
  })
}

function createReviewQueueItem(params: {
  action: string
  targetId: string
  reason: WorkflowFailure['error']
  notes: string
  approvalReference: string
  now: Date
  metadata?: Record<string, unknown>
}): MembershipSupportWorkflowReviewQueueItem {
  const queueReason = queueReasonForAction(params.action, params.reason)
  const projection = buildMembershipSupportReviewQueueProjection({
    action: params.action,
    targetId: params.targetId,
    reason: params.reason,
    notes: params.notes,
    approvalReference: params.approvalReference,
    now: params.now,
    metadata: params.metadata,
  })
  return freezeDeep({
    id: deriveStableId('review', [params.action, params.targetId, params.approvalReference, params.reason]),
    displayName: `${params.action} review - ${params.targetId}`,
    queueState: 'needs_review',
    queueReason,
    priority: projection.priority,
    assignedTo: null,
    dueAt: null,
    resolvedAt: null,
    notes: params.notes,
    metadata: {
      ...(params.metadata ?? {}),
      queueType: projection.queueType,
      dedupeKey: projection.dedupeKey,
      requiredAction: projection.requiredAction,
      reasonCode: projection.reasonCode,
      evidenceSummary: projection.evidenceSummary,
      sourceEventId: projection.sourceEventId,
    },
    createdAt: params.now.toISOString(),
    updatedAt: params.now.toISOString(),
    projection,
  })
}

function failWithReview(params: {
  journal: InMemoryMembershipSupportWorkflowJournal
  action: string
  targetId: string
  reason: string
  notes: string
  operatorId: string
  approvalReference: string
  now: Date
  before: unknown
  metadata?: Record<string, unknown>
}): WorkflowFailure {
  const reviewQueueItem = params.journal.enqueueReviewItem(
    createReviewQueueItem({
      action: params.action,
      targetId: params.targetId,
      reason: params.reason,
      notes: params.notes,
      approvalReference: params.approvalReference,
      now: params.now,
      metadata: params.metadata,
    }),
  )
  const auditEvent = params.journal.appendAuditEvent(
    createAuditEvent({
      action: params.action,
      targetCollection: 'payload_membership_review_queue_items',
      targetId: reviewQueueItem.id,
      operatorId: params.operatorId,
      approvalReference: params.approvalReference,
      before: params.before,
      after: reviewQueueItem,
      notes: params.notes,
      severity: 'warning',
      metadata: params.metadata,
      now: params.now,
    }),
  )
  return { ok: false, error: params.reason, auditEvent, reviewQueueItem }
}

function buildVoucherRecord(params: {
  input: DraftVoucherInput
  context: MembershipSupportWorkflowContext
  approvalState: MembershipSupportVoucherRecord['approvalState']
  redemptionState: MembershipSupportVoucherRecord['redemptionState']
  stripeCouponId: string | null
  stripePromotionCodeId: string | null
  stripeSubscriptionId: string | null
  issuedAt: Date | null
  expiresAt: Date | null
  redeemedAt: Date | null
  deactivatedAt: Date | null
  approvedBy: string | null
  updatedAt: Date
}): MembershipSupportVoucherRecord {
  return freezeDeep({
    id: params.input.id,
    displayName: `Voucher - ${params.input.memberEmail.trim().toLowerCase()}`,
    memberId: params.input.memberId,
    memberEmail: normalizeEmailOrThrow(params.input.memberEmail),
    fundingSource: normalizeFundingSource(params.input.fundingSource),
    voucherDuration: params.input.voucherDuration,
    approvalState: params.approvalState,
    redemptionState: params.redemptionState,
    billingCadence: params.input.billingCadence,
    stripeCustomerId: params.input.stripeCustomerId,
    stripeCouponId: params.stripeCouponId,
    stripePromotionCodeId: params.stripePromotionCodeId,
    stripeSubscriptionId: params.stripeSubscriptionId,
    approvalReference: params.context.approvalReference,
    issuedBy: params.context.operatorId,
    approvedBy: params.approvedBy,
    issuedAt: params.issuedAt?.toISOString() ?? null,
    expiresAt: params.expiresAt?.toISOString() ?? null,
    redeemedAt: params.redeemedAt?.toISOString() ?? null,
    deactivatedAt: params.deactivatedAt?.toISOString() ?? null,
    reason: params.input.reason,
    notes: params.input.notes ?? '',
    metadata: params.input.metadata ?? {},
    createdAt: params.updatedAt.toISOString(),
    updatedAt: params.updatedAt.toISOString(),
  })
}

function buildAllocationRecord(params: {
  input: PayItForwardAllocationInput
  context: MembershipSupportWorkflowContext
  approvalState: MembershipSupportPayItForwardAllocationRecord['approvalState']
  stripeCouponId: string | null
  stripePromotionCodeId: string | null
  stripeSubscriptionId: string | null
  issuedAt: Date | null
  expiresAt: Date | null
  redeemedAt: Date | null
  revokedAt: Date | null
  approvedBy: string | null
  updatedAt: Date
}): MembershipSupportPayItForwardAllocationRecord {
  const normalizedEmail = normalizeEmailOrThrow(params.input.memberEmail)
  return freezeDeep({
    id: params.input.id,
    displayName: `Pay it forward - ${normalizedEmail}`,
    memberId: params.input.memberId,
    memberEmail: normalizedEmail,
    donorName: params.input.donorName.trim(),
    approvalState: params.approvalState,
    billingCadence: params.input.billingCadence,
    allocatedAmountMinor: params.input.allocatedAmountMinor,
    currency: params.input.currency?.trim().toUpperCase() || 'GBP',
    stripeCustomerId: params.input.stripeCustomerId,
    stripeCouponId: params.stripeCouponId,
    stripePromotionCodeId: params.stripePromotionCodeId,
    stripeSubscriptionId: params.stripeSubscriptionId,
    approvalReference: params.context.approvalReference,
    issuedBy: params.context.operatorId,
    approvedBy: params.approvedBy,
    issuedAt: params.issuedAt?.toISOString() ?? null,
    expiresAt: params.expiresAt?.toISOString() ?? null,
    redeemedAt: params.redeemedAt?.toISOString() ?? null,
    revokedAt: params.revokedAt?.toISOString() ?? null,
    reason: params.input.reason,
    notes: params.input.notes ?? '',
    metadata: params.input.metadata ?? {},
    createdAt: params.updatedAt.toISOString(),
    updatedAt: params.updatedAt.toISOString(),
  })
}

function buildSupportProjection(params: {
  id: string
  source: Exclude<MembershipFundingSource, 'direct_payment'>
  voucherDuration: MembershipVoucherDuration
  memberId: string
  memberEmail: string
  stripeCustomerId: string
  stripeCouponId: string
  stripePromotionCodeId: string
  stripeSubscriptionId: string | null
  billingCadence: 'monthly' | 'annual'
  issuedBy: string
  approvedBy: string | null
  reason: string
  approvalReference: string
  reconciliationState: 'matched' | 'mismatch'
  lastWebhookAt: Date | null
  now: Date
}): MembershipSupportProjectionRecord {
  return freezeDeep({
    id: params.id,
    fundingSource: params.source,
    voucherDuration: params.voucherDuration,
    issuanceState: 'issued',
    intendedRecipientEmail: params.memberEmail,
    stripeCustomerId: params.stripeCustomerId,
    stripeCouponId: params.stripeCouponId,
    stripePromotionCodeId: params.stripePromotionCodeId,
    stripeSubscriptionId: params.stripeSubscriptionId,
    billingCadence: params.billingCadence,
    issuedBy: params.issuedBy,
    approvedBy: params.approvedBy,
    issuedAt: params.now.toISOString(),
    expiresAt: new Date(params.now.getTime() + voucherDurationDays(params.voucherDuration) * 24 * 60 * 60 * 1000).toISOString(),
    redeemedAt: null,
    deactivatedAt: null,
    reason: params.reason,
    approvalReference: params.approvalReference,
    reconciliationState: params.reconciliationState,
    lastWebhookAt: params.lastWebhookAt?.toISOString() ?? params.now.toISOString(),
    displayName: `Support projection - ${params.memberEmail}`,
    memberId: params.memberId,
    memberEmail: params.memberEmail,
    notes: '',
    createdAt: params.now.toISOString(),
    updatedAt: params.now.toISOString(),
  })
}

function assertEditableVoucher(voucher: MembershipSupportVoucherRecord): void {
  if (voucher.redemptionState === 'redeemed') {
    throw new Error('voucher_already_redeemed')
  }
}

function assertEditableAllocation(allocation: MembershipSupportPayItForwardAllocationRecord): void {
  if (allocation.approvalState === 'revoked') {
    throw new Error('allocation_already_revoked')
  }
}

function buildIssueRecord(params: {
  source: Exclude<MembershipFundingSource, 'direct_payment'>
  recordId: string
  memberId: string
  memberEmail: string
  voucherDuration: MembershipVoucherDuration
  billingCadence: 'monthly' | 'annual'
  stripeCustomerId: string
  stripeSubscriptionId: string | null
  couponId: string
  promotionCodeId: string
  approvalReference: string
  operatorId: string
  reason: string
  now: Date
  reconciliationState: 'matched' | 'mismatch'
}): MembershipSupportProjectionRecord {
  return buildSupportProjection({
    id: deriveStableId('support', [params.source, params.recordId, params.approvalReference]),
    source: params.source,
    voucherDuration: params.voucherDuration,
    memberId: params.memberId,
    memberEmail: normalizeEmailOrThrow(params.memberEmail),
    stripeCustomerId: params.stripeCustomerId,
    stripeCouponId: params.couponId,
    stripePromotionCodeId: params.promotionCodeId,
    stripeSubscriptionId: params.stripeSubscriptionId,
    billingCadence: params.billingCadence,
    issuedBy: params.operatorId,
    approvedBy: params.operatorId,
    reason: params.reason,
    approvalReference: params.approvalReference,
    reconciliationState: params.reconciliationState,
    lastWebhookAt: params.now,
    now: params.now,
  })
}

function validateIssuanceReadiness(params: {
  operatorId: string | null | undefined
  approvalReference: string | null | undefined
  source: MembershipFundingSource
}): { operatorId: string; approvalReference: string } {
  const operatorId = requireOperatorId(params.operatorId)
  const approvalReference = requireApprovalReference(params.approvalReference)
  if (params.source === 'direct_payment') throw new Error('direct_sponsored_access_not_allowed')
  return { operatorId, approvalReference }
}

export function createDraftVoucher(
  journal: InMemoryMembershipSupportWorkflowJournal,
  input: DraftVoucherInput,
  context: MembershipSupportWorkflowContext,
): WorkflowResult<VoucherAction> {
  const operatorId = requireOperatorId(context.operatorId)
  const approvalReference = requireApprovalReference(context.approvalReference)
  const idempotencyKey = deriveStableId('voucher-draft', [input.id, operatorId, approvalReference, input.memberEmail])

  return journal.memoize(idempotencyKey, () => {
    const before = journal.snapshot().vouchers.find((voucher) => voucher.id === input.id) ?? null
    const voucher = buildVoucherRecord({
      input,
      context: { ...context, operatorId, approvalReference },
      approvalState: 'draft',
      redemptionState: 'not_redeemed',
      stripeCouponId: null,
      stripePromotionCodeId: null,
      stripeSubscriptionId: input.stripeSubscriptionId,
      issuedAt: null,
      expiresAt: null,
      redeemedAt: null,
      deactivatedAt: null,
      approvedBy: null,
      updatedAt: context.now,
    })
    const auditEvent = journal.appendAuditEvent(
      createAuditEvent({
        action: 'voucher_draft_created',
        targetCollection: 'payload_membership_vouchers',
        targetId: voucher.id,
        operatorId,
        approvalReference,
        before,
        after: voucher,
        notes: input.reason,
        now: context.now,
      }),
    )
    journal.upsertVoucher(voucher)
    return { ok: true, value: { voucher, projection: null as never }, auditEvent }
  })
}

export function approveVoucher(
  journal: InMemoryMembershipSupportWorkflowJournal,
  voucher: MembershipSupportVoucherRecord,
  context: MembershipSupportWorkflowContext,
): WorkflowResult<VoucherAction> {
  const operatorId = requireOperatorId(context.operatorId)
  const approvalReference = requireApprovalReference(context.approvalReference)
  const idempotencyKey = deriveStableId('voucher-approve', [voucher.id, operatorId, approvalReference])

  return journal.memoize(idempotencyKey, () => {
    const before = voucher
    const next = buildVoucherRecord({
      input: {
        id: voucher.id,
        memberId: voucher.memberId,
        memberEmail: voucher.memberEmail,
        voucherDuration: voucher.voucherDuration,
        billingCadence: voucher.billingCadence,
        fundingSource: voucher.fundingSource,
        stripeCustomerId: voucher.stripeCustomerId ?? '',
        stripeSubscriptionId: voucher.stripeSubscriptionId,
        reason: voucher.reason,
        notes: voucher.notes,
        metadata: voucher.metadata,
      },
      context: { ...context, operatorId, approvalReference },
      approvalState: 'approved',
      redemptionState: voucher.redemptionState,
      stripeCouponId: voucher.stripeCouponId,
      stripePromotionCodeId: voucher.stripePromotionCodeId,
      stripeSubscriptionId: voucher.stripeSubscriptionId,
      issuedAt: voucher.issuedAt ? new Date(voucher.issuedAt) : null,
      expiresAt: voucher.expiresAt ? new Date(voucher.expiresAt) : null,
      redeemedAt: voucher.redeemedAt ? new Date(voucher.redeemedAt) : null,
      deactivatedAt: voucher.deactivatedAt ? new Date(voucher.deactivatedAt) : null,
      approvedBy: operatorId,
      updatedAt: context.now,
    })
    const auditEvent = journal.appendAuditEvent(
      createAuditEvent({
        action: 'voucher_approved',
        targetCollection: 'payload_membership_vouchers',
        targetId: next.id,
        operatorId,
        approvalReference,
        before,
        after: next,
        notes: 'Voucher approved by administrator.',
        now: context.now,
      }),
    )
    journal.upsertVoucher(next)
    return { ok: true, value: { voucher: next, projection: null as never }, auditEvent }
  })
}

function issueVoucherProjectionInternal(params: {
  journal: InMemoryMembershipSupportWorkflowJournal
  voucher: MembershipSupportVoucherRecord
  context: MembershipSupportWorkflowContext
  adapter: MembershipSupportStripeAdapter
}): WorkflowResult<VoucherAction> {
  const operatorId = requireOperatorId(params.context.operatorId)
  const approvalReference = requireApprovalReference(params.context.approvalReference)
  const idempotencyKey = deriveStableId('voucher-issue', [params.voucher.id, operatorId, approvalReference, params.voucher.fundingSource])

  return params.journal.memoize(idempotencyKey, () => {
    if ((params.voucher.fundingSource as MembershipFundingSource) === 'direct_payment') {
      return failWithReview({
        journal: params.journal,
        action: 'voucher_projection_issued',
        targetId: params.voucher.id,
        reason: 'direct_sponsored_access_not_allowed',
        notes: 'Voucher projection rejected because direct sponsored access is not a supported path.',
        operatorId,
        approvalReference,
        now: params.context.now,
        before: params.voucher,
      }) as WorkflowFailure
    }

    if (params.voucher.approvalState !== 'approved' || !params.voucher.approvalReference) {
      return failWithReview({
        journal: params.journal,
        action: 'voucher_projection_issued',
        targetId: params.voucher.id,
        reason: 'approval_required',
        notes: 'Voucher projection rejected until approval is present.',
        operatorId,
        approvalReference,
        now: params.context.now,
        before: params.voucher,
      }) as WorkflowFailure
    }

    const supportRecord: MembershipSupportRecord = {
      id: deriveStableId('support', [params.voucher.id, approvalReference]),
      fundingSource: params.voucher.fundingSource,
      voucherDuration: params.voucher.voucherDuration,
      issuanceState: 'approved',
      intendedRecipientEmail: params.voucher.memberEmail,
      stripeCustomerId: params.voucher.stripeCustomerId,
      stripeCouponId: params.voucher.stripeCouponId,
      stripePromotionCodeId: params.voucher.stripePromotionCodeId,
      stripeSubscriptionId: params.voucher.stripeSubscriptionId,
      billingCadence: params.voucher.billingCadence,
      issuedBy: operatorId,
      approvedBy: params.voucher.approvedBy,
      issuedAt: params.voucher.issuedAt ? new Date(params.voucher.issuedAt) : null,
      expiresAt: params.voucher.expiresAt ? new Date(params.voucher.expiresAt) : null,
      redeemedAt: params.voucher.redeemedAt ? new Date(params.voucher.redeemedAt) : null,
      deactivatedAt: params.voucher.deactivatedAt ? new Date(params.voucher.deactivatedAt) : null,
      reason: params.voucher.reason,
      approvalReference,
      reconciliationState: 'pending',
      lastWebhookAt: params.voucher.issuedAt ? new Date(params.voucher.issuedAt) : params.context.now,
    }

    const result = issueMembershipSupportVoucher({
      record: supportRecord,
      adapter: params.adapter,
      now: params.context.now,
    })

    return Promise.resolve(result).then((issuance) => {
      const reconciliationState = issuance.reconciliationState
      const supportProjection = buildIssueRecord({
        source: params.voucher.fundingSource,
        recordId: params.voucher.id,
        memberId: params.voucher.memberId,
        memberEmail: params.voucher.memberEmail,
        voucherDuration: params.voucher.voucherDuration,
        billingCadence: params.voucher.billingCadence,
        stripeCustomerId: params.voucher.stripeCustomerId ?? issuance.stripeCustomerId,
        stripeSubscriptionId: params.voucher.stripeSubscriptionId,
        couponId: issuance.couponId,
        promotionCodeId: issuance.promotionCodeId,
        approvalReference,
        operatorId,
        reason: params.voucher.reason,
        now: params.context.now,
        reconciliationState,
      })
      const updatedVoucher = buildVoucherRecord({
        input: {
          id: params.voucher.id,
          memberId: params.voucher.memberId,
        memberEmail: params.voucher.memberEmail,
        voucherDuration: params.voucher.voucherDuration,
        billingCadence: params.voucher.billingCadence,
        fundingSource: params.voucher.fundingSource,
        stripeCustomerId: params.voucher.stripeCustomerId ?? issuance.stripeCustomerId,
        stripeSubscriptionId: params.voucher.stripeSubscriptionId,
        reason: params.voucher.reason,
        notes: params.voucher.notes,
        metadata: params.voucher.metadata,
      },
        context: { ...params.context, operatorId, approvalReference },
        approvalState: 'issued',
        redemptionState: params.voucher.redemptionState,
        stripeCouponId: issuance.couponId,
        stripePromotionCodeId: issuance.promotionCodeId,
        stripeSubscriptionId: params.voucher.stripeSubscriptionId,
        issuedAt: params.context.now,
        expiresAt: supportProjection.expiresAt ? new Date(supportProjection.expiresAt) : null,
        redeemedAt: params.voucher.redeemedAt ? new Date(params.voucher.redeemedAt) : null,
        deactivatedAt: params.voucher.deactivatedAt ? new Date(params.voucher.deactivatedAt) : null,
        approvedBy: params.voucher.approvedBy,
        updatedAt: params.context.now,
      })
      params.journal.upsertSupportProjection(supportProjection)
      params.journal.upsertVoucher(updatedVoucher)
      const auditEvent = params.journal.appendAuditEvent(
        createAuditEvent({
          action: 'voucher_projection_issued',
          targetCollection: 'payload_membership_support_records',
          targetId: supportProjection.id,
          operatorId,
          approvalReference,
          before: params.voucher,
          after: supportProjection,
          notes: `Voucher projection issued with reconciliation ${reconciliationState}.`,
          severity: reconciliationState === 'matched' ? 'info' : 'warning',
          metadata: {
            couponId: issuance.couponId,
            promotionCodeId: issuance.promotionCodeId,
            reconciliationReasons: issuance.reconciliationReasons,
          },
          now: params.context.now,
        }),
      )

      if (reconciliationState === 'mismatch') {
        return failWithReview({
          journal: params.journal,
          action: 'voucher_projection_issued',
          targetId: supportProjection.id,
          reason: 'webhook_mismatch',
          notes: `Voucher projection reconciled with mismatch: ${issuance.reconciliationReasons.join(',') || 'unknown'}.`,
          operatorId,
          approvalReference,
          now: params.context.now,
          before: params.voucher,
          metadata: {
            reconciliationReasons: issuance.reconciliationReasons,
            couponId: issuance.couponId,
            promotionCodeId: issuance.promotionCodeId,
          },
        })
      }

      return { ok: true, value: { voucher: updatedVoucher, projection: supportProjection }, auditEvent }
    }) as unknown as WorkflowResult<VoucherAction>
  })
}

export function issueVoucherProjection(
  journal: InMemoryMembershipSupportWorkflowJournal,
  voucher: MembershipSupportVoucherRecord,
  context: MembershipSupportWorkflowContext,
  adapter: MembershipSupportStripeAdapter,
): Promise<WorkflowResult<VoucherAction>> {
  return Promise.resolve(issueVoucherProjectionInternal({ journal, voucher, context, adapter }))
}

export function deactivateUnusedVoucher(
  journal: InMemoryMembershipSupportWorkflowJournal,
  voucher: MembershipSupportVoucherRecord,
  context: MembershipSupportWorkflowContext,
): WorkflowResult<VoucherAction> {
  const operatorId = requireOperatorId(context.operatorId)
  const approvalReference = requireApprovalReference(context.approvalReference)
  const idempotencyKey = deriveStableId('voucher-deactivate', [voucher.id, operatorId, approvalReference])

  return journal.memoize(idempotencyKey, () => {
    if (voucher.redemptionState === 'redeemed') {
      return failWithReview({
        journal,
        action: 'voucher_deactivated',
        targetId: voucher.id,
        reason: 'customer_restriction',
        notes: 'Voucher deactivation rejected because the voucher has already been redeemed.',
        operatorId,
        approvalReference,
        now: context.now,
        before: voucher,
      }) as WorkflowFailure
    }

    const updatedVoucher = buildVoucherRecord({
      input: {
        id: voucher.id,
        memberId: voucher.memberId,
        memberEmail: voucher.memberEmail,
        voucherDuration: voucher.voucherDuration,
        billingCadence: voucher.billingCadence,
        fundingSource: voucher.fundingSource,
        stripeCustomerId: voucher.stripeCustomerId ?? '',
        stripeSubscriptionId: voucher.stripeSubscriptionId,
        reason: voucher.reason,
        notes: voucher.notes,
        metadata: voucher.metadata,
      },
      context: { ...context, operatorId, approvalReference },
      approvalState: 'revoked',
      redemptionState: 'deactivated',
      stripeCouponId: voucher.stripeCouponId,
      stripePromotionCodeId: voucher.stripePromotionCodeId,
      stripeSubscriptionId: voucher.stripeSubscriptionId,
      issuedAt: voucher.issuedAt ? new Date(voucher.issuedAt) : null,
      expiresAt: voucher.expiresAt ? new Date(voucher.expiresAt) : null,
      redeemedAt: voucher.redeemedAt ? new Date(voucher.redeemedAt) : null,
      deactivatedAt: context.now,
      approvedBy: voucher.approvedBy,
      updatedAt: context.now,
    })
    const auditEvent = journal.appendAuditEvent(
      createAuditEvent({
        action: 'voucher_deactivated',
        targetCollection: 'payload_membership_vouchers',
        targetId: voucher.id,
        operatorId,
        approvalReference,
        before: voucher,
        after: updatedVoucher,
        notes: 'Voucher deactivated by administrator.',
        now: context.now,
      }),
    )
    journal.upsertVoucher(updatedVoucher)
    return { ok: true, value: { voucher: updatedVoucher, projection: null as never }, auditEvent }
  })
}

export function expireVoucher(
  journal: InMemoryMembershipSupportWorkflowJournal,
  voucher: MembershipSupportVoucherRecord,
  context: MembershipSupportWorkflowContext,
): WorkflowResult<VoucherAction> {
  const operatorId = requireOperatorId(context.operatorId)
  const approvalReference = requireApprovalReference(context.approvalReference)
  const idempotencyKey = deriveStableId('voucher-expire', [voucher.id, operatorId, approvalReference])

  return journal.memoize(idempotencyKey, () => {
    if (voucher.redemptionState === 'redeemed') {
      return failWithReview({
        journal,
        action: 'voucher_expired',
        targetId: voucher.id,
        reason: 'expiry_check',
        notes: 'Voucher expiry rejected because the voucher has already been redeemed.',
        operatorId,
        approvalReference,
        now: context.now,
        before: voucher,
      }) as WorkflowFailure
    }

    const updatedVoucher = buildVoucherRecord({
      input: {
        id: voucher.id,
        memberId: voucher.memberId,
        memberEmail: voucher.memberEmail,
        voucherDuration: voucher.voucherDuration,
        billingCadence: voucher.billingCadence,
        fundingSource: voucher.fundingSource,
        stripeCustomerId: voucher.stripeCustomerId ?? '',
        stripeSubscriptionId: voucher.stripeSubscriptionId,
        reason: voucher.reason,
        notes: voucher.notes,
        metadata: voucher.metadata,
      },
      context: { ...context, operatorId, approvalReference },
      approvalState: voucher.approvalState,
      redemptionState: 'expired',
      stripeCouponId: voucher.stripeCouponId,
      stripePromotionCodeId: voucher.stripePromotionCodeId,
      stripeSubscriptionId: voucher.stripeSubscriptionId,
      issuedAt: voucher.issuedAt ? new Date(voucher.issuedAt) : null,
      expiresAt: context.now,
      redeemedAt: voucher.redeemedAt ? new Date(voucher.redeemedAt) : null,
      deactivatedAt: voucher.deactivatedAt ? new Date(voucher.deactivatedAt) : null,
      approvedBy: voucher.approvedBy,
      updatedAt: context.now,
    })
    const auditEvent = journal.appendAuditEvent(
      createAuditEvent({
        action: 'voucher_expired',
        targetCollection: 'payload_membership_vouchers',
        targetId: voucher.id,
        operatorId,
        approvalReference,
        before: voucher,
        after: updatedVoucher,
        notes: 'Voucher expired by administrator.',
        now: context.now,
      }),
    )
    journal.upsertVoucher(updatedVoucher)
    return { ok: true, value: { voucher: updatedVoucher, projection: null as never }, auditEvent }
  })
}

export function createPayItForwardAllocation(
  journal: InMemoryMembershipSupportWorkflowJournal,
  input: PayItForwardAllocationInput,
  context: MembershipSupportWorkflowContext,
): WorkflowResult<PayItForwardAction> {
  const operatorId = requireOperatorId(context.operatorId)
  const approvalReference = requireApprovalReference(context.approvalReference)
  const idempotencyKey = deriveStableId('allocation-create', [input.id, operatorId, approvalReference, input.memberEmail])

  return journal.memoize(idempotencyKey, () => {
    const allocation = buildAllocationRecord({
      input: {
        ...input,
        currency: input.currency ?? 'GBP',
      },
      context: { ...context, operatorId, approvalReference },
      approvalState: 'draft',
      stripeCouponId: null,
      stripePromotionCodeId: null,
      stripeSubscriptionId: input.stripeSubscriptionId,
      issuedAt: null,
      expiresAt: null,
      redeemedAt: null,
      revokedAt: null,
      approvedBy: null,
      updatedAt: context.now,
    })
    const auditEvent = journal.appendAuditEvent(
      createAuditEvent({
        action: 'pay_it_forward_allocation_created',
        targetCollection: 'payload_pay_it_forward_funding',
        targetId: allocation.id,
        operatorId,
        approvalReference,
        before: null,
        after: allocation,
        notes: input.reason,
        now: context.now,
      }),
    )
    journal.upsertPayItForwardAllocation(allocation)
    return { ok: true, value: { allocation, projection: null as never }, auditEvent }
  })
}

export function approvePayItForwardAllocation(
  journal: InMemoryMembershipSupportWorkflowJournal,
  allocation: MembershipSupportPayItForwardAllocationRecord,
  context: MembershipSupportWorkflowContext,
): WorkflowResult<PayItForwardAction> {
  const operatorId = requireOperatorId(context.operatorId)
  const approvalReference = requireApprovalReference(context.approvalReference)
  const idempotencyKey = deriveStableId('allocation-approve', [allocation.id, operatorId, approvalReference])

  return journal.memoize(idempotencyKey, () => {
    const next = buildAllocationRecord({
      input: {
        id: allocation.id,
        memberId: allocation.memberId,
        memberEmail: allocation.memberEmail,
        donorName: allocation.donorName,
        billingCadence: allocation.billingCadence,
        allocatedAmountMinor: allocation.allocatedAmountMinor,
        currency: allocation.currency,
        stripeCustomerId: allocation.stripeCustomerId ?? '',
        stripeSubscriptionId: allocation.stripeSubscriptionId,
        reason: allocation.reason,
        notes: allocation.notes,
        metadata: allocation.metadata,
      },
      context: { ...context, operatorId, approvalReference },
      approvalState: 'approved',
      stripeCouponId: allocation.stripeCouponId,
      stripePromotionCodeId: allocation.stripePromotionCodeId,
      stripeSubscriptionId: allocation.stripeSubscriptionId,
      issuedAt: allocation.issuedAt ? new Date(allocation.issuedAt) : null,
      expiresAt: allocation.expiresAt ? new Date(allocation.expiresAt) : null,
      redeemedAt: allocation.redeemedAt ? new Date(allocation.redeemedAt) : null,
      revokedAt: allocation.revokedAt ? new Date(allocation.revokedAt) : null,
      approvedBy: operatorId,
      updatedAt: context.now,
    })
    const auditEvent = journal.appendAuditEvent(
      createAuditEvent({
        action: 'pay_it_forward_allocation_approved',
        targetCollection: 'payload_pay_it_forward_funding',
        targetId: next.id,
        operatorId,
        approvalReference,
        before: allocation,
        after: next,
        notes: 'Pay-it-forward allocation approved by administrator.',
        now: context.now,
      }),
    )
    journal.upsertPayItForwardAllocation(next)
    return { ok: true, value: { allocation: next, projection: null as never }, auditEvent }
  })
}

export function issuePayItForwardVoucherProjection(
  journal: InMemoryMembershipSupportWorkflowJournal,
  allocation: MembershipSupportPayItForwardAllocationRecord,
  context: MembershipSupportWorkflowContext,
  adapter: MembershipSupportStripeAdapter,
): Promise<WorkflowResult<PayItForwardAction>> {
  const operatorId = requireOperatorId(context.operatorId)
  const approvalReference = requireApprovalReference(context.approvalReference)
  const idempotencyKey = deriveStableId('allocation-issue', [allocation.id, operatorId, approvalReference, allocation.currency])

  return Promise.resolve(journal.memoize(idempotencyKey, () => {
    if (allocation.approvalState !== 'approved') {
      return failWithReview({
        journal,
        action: 'pay_it_forward_projection_issued',
        targetId: allocation.id,
        reason: 'approval_required',
        notes: 'Pay-it-forward allocation must be approved before issuing the voucher projection.',
        operatorId,
        approvalReference,
        now: context.now,
        before: allocation,
      }) as WorkflowFailure
    }

    const supportRecord: MembershipSupportRecord = {
      id: deriveStableId('support', [allocation.id, approvalReference]),
      fundingSource: 'pay_it_forward',
      voucherDuration: allocation.billingCadence === 'annual' ? 'one_year' : 'one_month',
      issuanceState: 'approved',
      intendedRecipientEmail: allocation.memberEmail,
      stripeCustomerId: allocation.stripeCustomerId,
      stripeCouponId: allocation.stripeCouponId,
      stripePromotionCodeId: allocation.stripePromotionCodeId,
      stripeSubscriptionId: allocation.stripeSubscriptionId,
      billingCadence: allocation.billingCadence,
      issuedBy: operatorId,
      approvedBy: allocation.approvedBy,
      issuedAt: allocation.issuedAt ? new Date(allocation.issuedAt) : null,
      expiresAt: allocation.expiresAt ? new Date(allocation.expiresAt) : null,
      redeemedAt: allocation.redeemedAt ? new Date(allocation.redeemedAt) : null,
      deactivatedAt: allocation.revokedAt ? new Date(allocation.revokedAt) : null,
      reason: allocation.reason,
      approvalReference,
      reconciliationState: 'pending',
      lastWebhookAt: allocation.issuedAt ? new Date(allocation.issuedAt) : context.now,
    }

    const issuance = issueMembershipSupportVoucher({
      record: supportRecord,
      adapter,
      now: context.now,
    })

    return Promise.resolve(issuance).then((result) => {
      const supportProjection = buildIssueRecord({
        source: 'pay_it_forward',
        recordId: allocation.id,
        memberId: allocation.memberId,
        memberEmail: allocation.memberEmail,
        voucherDuration: supportRecord.voucherDuration,
        billingCadence: allocation.billingCadence,
        stripeCustomerId: allocation.stripeCustomerId ?? result.stripeCustomerId,
        stripeSubscriptionId: allocation.stripeSubscriptionId,
        couponId: result.couponId,
        promotionCodeId: result.promotionCodeId,
        approvalReference,
        operatorId,
        reason: allocation.reason,
        now: context.now,
        reconciliationState: result.reconciliationState,
      })
      const updatedAllocation = buildAllocationRecord({
      input: {
        id: allocation.id,
        memberId: allocation.memberId,
        memberEmail: allocation.memberEmail,
        donorName: allocation.donorName,
        billingCadence: allocation.billingCadence,
        allocatedAmountMinor: allocation.allocatedAmountMinor,
        currency: allocation.currency,
        stripeCustomerId: allocation.stripeCustomerId ?? result.stripeCustomerId,
        stripeSubscriptionId: allocation.stripeSubscriptionId,
        reason: allocation.reason,
        notes: allocation.notes,
        metadata: allocation.metadata,
      },
        context: { ...context, operatorId, approvalReference },
        approvalState: 'issued',
        stripeCouponId: result.couponId,
        stripePromotionCodeId: result.promotionCodeId,
        stripeSubscriptionId: allocation.stripeSubscriptionId,
        issuedAt: context.now,
        expiresAt: supportProjection.expiresAt ? new Date(supportProjection.expiresAt) : null,
        redeemedAt: allocation.redeemedAt ? new Date(allocation.redeemedAt) : null,
        revokedAt: allocation.revokedAt ? new Date(allocation.revokedAt) : null,
        approvedBy: allocation.approvedBy,
        updatedAt: context.now,
      })
      journal.upsertSupportProjection(supportProjection)
      journal.upsertPayItForwardAllocation(updatedAllocation)
      const auditEvent = journal.appendAuditEvent(
        createAuditEvent({
          action: 'pay_it_forward_projection_issued',
          targetCollection: 'payload_membership_support_records',
          targetId: supportProjection.id,
          operatorId,
          approvalReference,
          before: allocation,
          after: supportProjection,
          notes: `Pay-it-forward projection issued with reconciliation ${result.reconciliationState}.`,
          severity: result.reconciliationState === 'matched' ? 'info' : 'warning',
          metadata: {
            couponId: result.couponId,
            promotionCodeId: result.promotionCodeId,
            reconciliationReasons: result.reconciliationReasons,
          },
          now: context.now,
        }),
      )

      if (result.reconciliationState === 'mismatch') {
        return failWithReview({
          journal,
          action: 'pay_it_forward_projection_issued',
          targetId: supportProjection.id,
          reason: 'webhook_mismatch',
          notes: `Pay-it-forward projection reconciled with mismatch: ${result.reconciliationReasons.join(',') || 'unknown'}.`,
          operatorId,
          approvalReference,
          now: context.now,
          before: allocation,
          metadata: {
            reconciliationReasons: result.reconciliationReasons,
            couponId: result.couponId,
            promotionCodeId: result.promotionCodeId,
          },
        })
      }

      return { ok: true, value: { allocation: updatedAllocation, projection: supportProjection }, auditEvent }
    }) as unknown as WorkflowResult<PayItForwardAction>
  }))
}

export function revokePayItForwardAllocation(
  journal: InMemoryMembershipSupportWorkflowJournal,
  allocation: MembershipSupportPayItForwardAllocationRecord,
  context: MembershipSupportWorkflowContext,
): WorkflowResult<PayItForwardAction> {
  const operatorId = requireOperatorId(context.operatorId)
  const approvalReference = requireApprovalReference(context.approvalReference)
  const idempotencyKey = deriveStableId('allocation-revoke', [allocation.id, operatorId, approvalReference])

  return journal.memoize(idempotencyKey, () => {
    assertEditableAllocation(allocation)
    const updatedAllocation = buildAllocationRecord({
      input: {
        id: allocation.id,
        memberId: allocation.memberId,
        memberEmail: allocation.memberEmail,
        donorName: allocation.donorName,
        billingCadence: allocation.billingCadence,
        allocatedAmountMinor: allocation.allocatedAmountMinor,
        currency: allocation.currency,
        stripeCustomerId: allocation.stripeCustomerId ?? '',
        stripeSubscriptionId: allocation.stripeSubscriptionId,
        reason: allocation.reason,
        notes: allocation.notes,
        metadata: allocation.metadata,
      },
      context: { ...context, operatorId, approvalReference },
      approvalState: 'revoked',
      stripeCouponId: allocation.stripeCouponId,
      stripePromotionCodeId: allocation.stripePromotionCodeId,
      stripeSubscriptionId: allocation.stripeSubscriptionId,
      issuedAt: allocation.issuedAt ? new Date(allocation.issuedAt) : null,
      expiresAt: allocation.expiresAt ? new Date(allocation.expiresAt) : null,
      redeemedAt: allocation.redeemedAt ? new Date(allocation.redeemedAt) : null,
      revokedAt: context.now,
      approvedBy: allocation.approvedBy,
      updatedAt: context.now,
    })
    const auditEvent = journal.appendAuditEvent(
      createAuditEvent({
        action: 'pay_it_forward_allocation_revoked',
        targetCollection: 'payload_pay_it_forward_funding',
        targetId: allocation.id,
        operatorId,
        approvalReference,
        before: allocation,
        after: updatedAllocation,
        notes: 'Pay-it-forward allocation revoked by administrator.',
        now: context.now,
      }),
    )
    journal.upsertPayItForwardAllocation(updatedAllocation)
    return { ok: true, value: { allocation: updatedAllocation, projection: null as never }, auditEvent }
  })
}

export function recordWorkflowValidationFailure(params: {
  journal: InMemoryMembershipSupportWorkflowJournal
  action: string
  targetId: string
  reason: string
  notes: string
  operatorId: string
  approvalReference: string
  now: Date
  before: unknown
  metadata?: Record<string, unknown>
}): WorkflowFailure {
  return failWithReview(params)
}

export function isVoucherFundingSourceAllowed(value: MembershipFundingSource): boolean {
  return value === 'voucher' || value === 'pay_it_forward'
}

export function buildMembershipSupportProjectionRecord(
  params: {
    source: Exclude<MembershipFundingSource, 'direct_payment'>
    recordId: string
    memberId: string
    memberEmail: string
    voucherDuration: MembershipVoucherDuration
    billingCadence: 'monthly' | 'annual'
    stripeCustomerId: string
    stripeSubscriptionId: string | null
    couponId: string
    promotionCodeId: string
    approvalReference: string
    operatorId: string
    reason: string
    now: Date
    reconciliationState?: 'matched' | 'mismatch'
  },
): MembershipSupportProjectionRecord {
  return buildIssueRecord({
    source: params.source,
    recordId: params.recordId,
    memberId: params.memberId,
    memberEmail: params.memberEmail,
    voucherDuration: params.voucherDuration,
    billingCadence: params.billingCadence,
    stripeCustomerId: params.stripeCustomerId,
    stripeSubscriptionId: params.stripeSubscriptionId,
    couponId: params.couponId,
    promotionCodeId: params.promotionCodeId,
    approvalReference: params.approvalReference,
    operatorId: params.operatorId,
    reason: params.reason,
    now: params.now,
    reconciliationState: params.reconciliationState ?? 'matched',
  })
}

export function validateVoucherOrThrow(voucher: MembershipSupportVoucherRecord): void {
  const record: MembershipSupportRecord = {
    id: voucher.id,
    fundingSource: voucher.fundingSource,
    voucherDuration: voucher.voucherDuration,
    issuanceState: voucher.approvalState === 'issued' ? 'issued' : 'approved',
    intendedRecipientEmail: voucher.memberEmail,
    stripeCustomerId: voucher.stripeCustomerId,
    stripeCouponId: voucher.stripeCouponId,
    stripePromotionCodeId: voucher.stripePromotionCodeId,
    stripeSubscriptionId: voucher.stripeSubscriptionId,
    billingCadence: voucher.billingCadence,
    issuedBy: voucher.issuedBy,
    approvedBy: voucher.approvedBy,
    issuedAt: voucher.issuedAt ? new Date(voucher.issuedAt) : null,
    expiresAt: voucher.expiresAt ? new Date(voucher.expiresAt) : null,
    redeemedAt: voucher.redeemedAt ? new Date(voucher.redeemedAt) : null,
    deactivatedAt: voucher.deactivatedAt ? new Date(voucher.deactivatedAt) : null,
    reason: voucher.reason,
    approvalReference: voucher.approvalReference,
    reconciliationState: 'pending',
    lastWebhookAt: voucher.issuedAt ? new Date(voucher.issuedAt) : null,
  }
  const errors = validateMembershipSupportRecord(record)
  if (errors.length > 0) throw new Error(`membership_support_invalid:${errors.join(',')}`)
  if (!isMembershipSupportRecordReady(record)) throw new Error('membership_support_not_ready')
}
