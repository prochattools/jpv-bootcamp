import { createHash } from 'node:crypto'

import type { MembershipFundingSource, MembershipSupportRecord, MembershipVoucherDuration } from '@/lib/membership-support/domain'
import { validateMembershipSupportRecord } from '@/lib/membership-support/domain'
import { normalizeEmail } from '@/lib/normalize-email'
import {
  buildMembershipSupportProjectionRecord,
  buildMembershipSupportReviewQueueProjection,
  InMemoryMembershipSupportWorkflowJournal,
  type DraftVoucherInput,
  type MembershipSupportAuditSeverity,
  type MembershipSupportPayItForwardAllocationRecord,
  type PayItForwardAllocationInput,
  type MembershipSupportProjectionRecord,
  type MembershipSupportVoucherRecord,
  type MembershipSupportWorkflowAuditEvent,
  type MembershipSupportWorkflowReviewQueueItem,
} from '@/lib/membership-support/workflows'
import type {
  MembershipSupportStripeAdapter,
  MembershipSupportStripeCoupon,
  MembershipSupportStripePromotionCode,
  MembershipSupportStripeReconciliation,
} from '@/lib/membership-support/stripeAdapter'
import {
  buildCustomerRestrictedPromotionCodeRequest,
  buildMembershipCouponRequest,
  deriveMembershipSupportIdempotencyKey,
} from '@/lib/membership-support/stripeRequests'

export type MembershipSupportIssuanceResult = {
  couponId: string
  promotionCodeId: string
  stripeCustomerId: string
  reconciliationState: 'matched' | 'mismatch'
  reconciliationReasons: string[]
  coupon: MembershipSupportStripeCoupon
  promotionCode: MembershipSupportStripePromotionCode
  reconciliation: MembershipSupportStripeReconciliation
}

export async function issueMembershipSupportVoucher(params: {
  record: MembershipSupportRecord
  adapter: MembershipSupportStripeAdapter
  now?: Date
}): Promise<MembershipSupportIssuanceResult> {
  const errors = validateMembershipSupportRecord(params.record)
  if (errors.length > 0) throw new Error(`membership_support_invalid:${errors.join(',')}`)
  if (params.record.fundingSource === 'direct_payment') throw new Error('funding_source_not_voucher_backed')
  if (!params.record.voucherDuration) throw new Error('voucher_duration_required')
  if (!params.record.stripeCustomerId) throw new Error('stripe_customer_required')
  if (!params.record.approvalReference) throw new Error('approval_reference_required')

  const couponKey = deriveMembershipSupportIdempotencyKey({
    operation: 'coupon',
    recordId: params.record.id,
    approvalReference: params.record.approvalReference,
  })
  const coupon = await params.adapter.createOrReuseCoupon(
    buildMembershipCouponRequest({
      duration: params.record.voucherDuration,
      fundingSource: params.record.fundingSource,
    }),
    couponKey,
  )

  const promotionKey = deriveMembershipSupportIdempotencyKey({
    operation: 'promotion_code',
    recordId: params.record.id,
    approvalReference: params.record.approvalReference,
  })
  const promotion = await params.adapter.createPromotionCode(
    buildCustomerRestrictedPromotionCodeRequest({
      couponId: coupon.id,
      customerId: params.record.stripeCustomerId,
      intendedRecipientEmail: params.record.intendedRecipientEmail,
      approvalReference: params.record.approvalReference,
      duration: params.record.voucherDuration,
      fundingSource: params.record.fundingSource,
      now: params.now,
    }),
    promotionKey,
  )

  const reconciliation = await params.adapter.reconcile({
    customerId: params.record.stripeCustomerId,
    subscriptionId: params.record.stripeSubscriptionId,
    promotionCodeId: promotion.id,
  })

  return {
    couponId: coupon.id,
    promotionCodeId: promotion.id,
    stripeCustomerId: params.record.stripeCustomerId,
    reconciliationState: reconciliation.matched ? 'matched' : 'mismatch',
    reconciliationReasons: reconciliation.reasons,
    coupon,
    promotionCode: promotion,
    reconciliation,
  }
}

export async function deactivateMembershipSupportPromotionCode(params: {
  recordId: string
  approvalReference: string
  promotionCodeId: string
  adapter: MembershipSupportStripeAdapter
}): Promise<{ id: string; active: boolean }> {
  const key = deriveMembershipSupportIdempotencyKey({
    operation: 'deactivate',
    recordId: params.recordId,
    approvalReference: params.approvalReference,
  })
  return params.adapter.deactivatePromotionCode(params.promotionCodeId, key)
}

export type MembershipSupportCommandOperatorRole = 'admin' | 'operator' | 'reviewer'
export type MembershipSupportCommandIdempotencyResult = 'created' | 'reused' | 'retried' | 'rejected'
export type MembershipSupportCommandFailureClassification =
  | 'missing_operator'
  | 'missing_approval'
  | 'illegal_transition'
  | 'unsupported_duration'
  | 'direct_non_stripe_sponsored_access_rejection'
  | 'provider_failure'
  | 'reconciliation_mismatch'
  | 'customer_mismatch'
  | 'funding_source_mismatch'
  | 'review_required'

export type MembershipSupportCommandContext = Readonly<{
  operatorId: string | null | undefined
  operatorRole: MembershipSupportCommandOperatorRole | null | undefined
  now: Date
  recordId: string
  idempotencyKey: string
  approvalReference?: string | null
  expectedCurrentState?: Record<string, unknown> | null
}>

export type MembershipSupportCommandResult = Readonly<{
  ok: boolean
  idempotencyResult: MembershipSupportCommandIdempotencyResult
  failureClassification: MembershipSupportCommandFailureClassification | null
  updatedWorkflowProjection: MembershipSupportProjectionRecord | null
  couponProjection: MembershipSupportStripeCoupon | null
  promotionCodeProjection: MembershipSupportStripePromotionCode | null
  reconciliationResult: MembershipSupportStripeReconciliation | null
  auditEvent: MembershipSupportWorkflowAuditEvent | null
  reviewQueueItem: MembershipSupportWorkflowReviewQueueItem | null
  updatedVoucher: MembershipSupportVoucherRecord | null
  updatedAllocation: MembershipSupportPayItForwardAllocationRecord | null
}>

export type MembershipSupportVoucherCommand =
  | { command: 'create_draft'; input: DraftVoucherInput; context: MembershipSupportCommandContext }
  | { command: 'submit_for_approval'; voucher: MembershipSupportVoucherRecord; context: MembershipSupportCommandContext }
  | { command: 'approve'; voucher: MembershipSupportVoucherRecord; context: MembershipSupportCommandContext }
  | { command: 'issue_one_month'; voucher: MembershipSupportVoucherRecord; context: MembershipSupportCommandContext; adapter: MembershipSupportStripeAdapter }
  | { command: 'issue_one_year'; voucher: MembershipSupportVoucherRecord; context: MembershipSupportCommandContext; adapter: MembershipSupportStripeAdapter }
  | { command: 'deactivate_unused'; voucher: MembershipSupportVoucherRecord; context: MembershipSupportCommandContext }
  | { command: 'mark_expired'; voucher: MembershipSupportVoucherRecord; context: MembershipSupportCommandContext }
  | { command: 'retry_failed_issuance'; voucher: MembershipSupportVoucherRecord; context: MembershipSupportCommandContext; adapter: MembershipSupportStripeAdapter }
  | { command: 'route_mismatch_to_review'; projection: MembershipSupportProjectionRecord; context: MembershipSupportCommandContext }
  | { command: 'resolve_review'; reviewQueueItem: MembershipSupportWorkflowReviewQueueItem; context: MembershipSupportCommandContext }

export type MembershipSupportPayItForwardCommand =
  | { command: 'create_funding_allocation'; input: PayItForwardAllocationInput & { stripeCouponId?: string | null; stripePromotionCodeId?: string | null }; context: MembershipSupportCommandContext }
  | { command: 'submit_for_approval'; allocation: MembershipSupportPayItForwardAllocationRecord; context: MembershipSupportCommandContext }
  | { command: 'approve'; allocation: MembershipSupportPayItForwardAllocationRecord; context: MembershipSupportCommandContext }
  | { command: 'issue_one_month_funded_membership'; allocation: MembershipSupportPayItForwardAllocationRecord; context: MembershipSupportCommandContext; adapter: MembershipSupportStripeAdapter }
  | { command: 'issue_one_year_funded_membership'; allocation: MembershipSupportPayItForwardAllocationRecord; context: MembershipSupportCommandContext; adapter: MembershipSupportStripeAdapter }
  | { command: 'revoke_unused_allocation'; allocation: MembershipSupportPayItForwardAllocationRecord; context: MembershipSupportCommandContext }
  | { command: 'retry_failed_issuance'; allocation: MembershipSupportPayItForwardAllocationRecord; context: MembershipSupportCommandContext; adapter: MembershipSupportStripeAdapter }
  | { command: 'route_mismatch_to_review'; projection: MembershipSupportProjectionRecord; context: MembershipSupportCommandContext }
  | { command: 'resolve_review'; reviewQueueItem: MembershipSupportWorkflowReviewQueueItem; context: MembershipSupportCommandContext }

function commandNormalizeText(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : ''
}

function commandNormalizeEmailOrThrow(value: string | null | undefined): string {
  const normalized = normalizeEmail(value)
  if (!normalized) throw new Error('member_email_required')
  return normalized
}

function commandDeriveStableId(prefix: string, parts: string[]): string {
  return `${prefix}_${createHash('sha256').update(parts.join(':')).digest('hex').slice(0, 16)}`
}

function commandFreeze<T>(value: T): T {
  if (!value || typeof value !== 'object') return value
  if (Object.isFrozen(value)) return value
  Object.freeze(value)
  for (const nested of Object.values(value as Record<string, unknown>)) {
    if (nested && typeof nested === 'object') commandFreeze(nested)
  }
  return value
}

function commandBuildAuditEvent(params: {
  action: string
  targetCollection: string
  targetId: string
  actorId: string
  actorType: 'admin' | 'operator' | 'reviewer' | 'system'
  approvalReference: string
  before: unknown
  after: unknown
  notes: string
  now: Date
  severity?: MembershipSupportAuditSeverity
  metadata?: Record<string, unknown>
}): MembershipSupportWorkflowAuditEvent {
  return commandFreeze({
    id: commandDeriveStableId('audit', [params.action, params.targetCollection, params.targetId, params.approvalReference]),
    displayName: `${params.action} - ${params.targetId}`,
    actorType: params.actorType === 'system' ? 'system' : 'admin',
    actorId: params.actorId,
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

function commandBuildReviewQueueItem(params: {
  action: string
  targetId: string
  reason: string
  notes: string
  approvalReference: string
  now: Date
  metadata?: Record<string, unknown>
}): MembershipSupportWorkflowReviewQueueItem {
  const queueReason =
    params.reason.includes('approval') ? 'approval_required' :
    params.reason.includes('customer') ? 'customer_restriction' :
    params.reason.includes('idempotency') ? 'idempotency_conflict' :
    params.reason.includes('webhook') || params.reason.includes('reconcile') ? 'webhook_mismatch' :
    params.reason.includes('expiry') ? 'expiry_check' :
    'manual_override'
  const projection = buildMembershipSupportReviewQueueProjection({
    action: params.action,
    targetId: params.targetId,
    reason: params.reason,
    notes: params.notes,
    approvalReference: params.approvalReference,
    now: params.now,
    metadata: params.metadata,
  })
  return commandFreeze({
    id: commandDeriveStableId('review', [params.action, params.targetId, params.approvalReference, params.reason]),
    displayName: `${params.action} review - ${params.targetId}`,
    queueState: 'needs_review' as const,
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

function commandBuildVoucherRecord(params: {
  id: string
  memberId: string
  memberEmail: string
  voucherDuration: 'one_month' | 'one_year'
  billingCadence: 'monthly' | 'annual'
  fundingSource: Exclude<MembershipFundingSource, 'direct_payment'>
  approvalState: MembershipSupportVoucherRecord['approvalState']
  redemptionState: MembershipSupportVoucherRecord['redemptionState']
  stripeCustomerId: string | null
  stripeCouponId: string | null
  stripePromotionCodeId: string | null
  stripeSubscriptionId: string | null
  approvalReference: string | null
  issuedBy: string | null
  approvedBy: string | null
  issuedAt: Date | null
  expiresAt: Date | null
  redeemedAt: Date | null
  deactivatedAt: Date | null
  reason: string
  notes?: string
  metadata?: Record<string, unknown>
  now: Date
}): MembershipSupportVoucherRecord {
  const normalizedEmail = commandNormalizeEmailOrThrow(params.memberEmail)
  return commandFreeze({
    id: params.id,
    displayName: `Voucher - ${normalizedEmail}`,
    memberId: params.memberId,
    memberEmail: normalizedEmail,
    fundingSource: params.fundingSource,
    voucherDuration: params.voucherDuration,
    approvalState: params.approvalState,
    redemptionState: params.redemptionState,
    billingCadence: params.billingCadence,
    stripeCustomerId: params.stripeCustomerId,
    stripeCouponId: params.stripeCouponId,
    stripePromotionCodeId: params.stripePromotionCodeId,
    stripeSubscriptionId: params.stripeSubscriptionId,
    approvalReference: params.approvalReference,
    issuedBy: params.issuedBy,
    approvedBy: params.approvedBy,
    issuedAt: params.issuedAt?.toISOString() ?? null,
    expiresAt: params.expiresAt?.toISOString() ?? null,
    redeemedAt: params.redeemedAt?.toISOString() ?? null,
    deactivatedAt: params.deactivatedAt?.toISOString() ?? null,
    reason: params.reason,
    notes: params.notes ?? '',
    metadata: params.metadata ?? {},
    createdAt: params.now.toISOString(),
    updatedAt: params.now.toISOString(),
  })
}

function commandBuildAllocationRecord(params: {
  id: string
  memberId: string
  memberEmail: string
  donorName: string
  billingCadence: 'monthly' | 'annual'
  allocatedAmountMinor: number
  currency: string
  approvalState: MembershipSupportPayItForwardAllocationRecord['approvalState']
  stripeCustomerId: string | null
  stripeCouponId: string | null
  stripePromotionCodeId: string | null
  stripeSubscriptionId: string | null
  approvalReference: string | null
  issuedBy: string | null
  approvedBy: string | null
  issuedAt: Date | null
  expiresAt: Date | null
  redeemedAt: Date | null
  revokedAt: Date | null
  reason: string
  notes?: string
  metadata?: Record<string, unknown>
  now: Date
}): MembershipSupportPayItForwardAllocationRecord {
  const normalizedEmail = commandNormalizeEmailOrThrow(params.memberEmail)
  return commandFreeze({
    id: params.id,
    displayName: `Pay it forward - ${normalizedEmail}`,
    memberId: params.memberId,
    memberEmail: normalizedEmail,
    donorName: params.donorName.trim(),
    approvalState: params.approvalState,
    billingCadence: params.billingCadence,
    allocatedAmountMinor: params.allocatedAmountMinor,
    currency: params.currency.trim().toUpperCase(),
    stripeCustomerId: params.stripeCustomerId,
    stripeCouponId: params.stripeCouponId,
    stripePromotionCodeId: params.stripePromotionCodeId,
    stripeSubscriptionId: params.stripeSubscriptionId,
    approvalReference: params.approvalReference,
    issuedBy: params.issuedBy,
    approvedBy: params.approvedBy,
    issuedAt: params.issuedAt?.toISOString() ?? null,
    expiresAt: params.expiresAt?.toISOString() ?? null,
    redeemedAt: params.redeemedAt?.toISOString() ?? null,
    revokedAt: params.revokedAt?.toISOString() ?? null,
    reason: params.reason,
    notes: params.notes ?? '',
    metadata: params.metadata ?? {},
    createdAt: params.now.toISOString(),
    updatedAt: params.now.toISOString(),
  })
}

function commandBuildResult<T extends Pick<MembershipSupportCommandResult, 'ok' | 'idempotencyResult' | 'failureClassification' | 'updatedWorkflowProjection' | 'couponProjection' | 'promotionCodeProjection' | 'reconciliationResult' | 'auditEvent' | 'reviewQueueItem' | 'updatedVoucher' | 'updatedAllocation'>>(result: T): MembershipSupportCommandResult {
  return commandFreeze(result)
}

function commandValidateOperator(context: MembershipSupportCommandContext): { operatorId: string; actorType: 'admin' | 'operator' | 'reviewer' | 'system' } | null {
  const operatorId = commandNormalizeText(context.operatorId)
  if (!operatorId) return null
  const role = context.operatorRole
  if (!role) return null
  if (role !== 'admin' && role !== 'operator' && role !== 'reviewer') return null
  return { operatorId, actorType: role }
}

function commandValidateApprovalReference(context: MembershipSupportCommandContext): string | null {
  const approvalReference = commandNormalizeText(context.approvalReference)
  return approvalReference || null
}

function commandStateMatches(actual: Record<string, unknown>, expected?: Record<string, unknown> | null): boolean {
  if (!expected) return true
  return Object.entries(expected).every(([key, value]) => actual[key] === value)
}

function commandFailure(
  journal: InMemoryMembershipSupportWorkflowJournal,
  params: {
    action: string
    targetCollection: string
    targetId: string
    reason: MembershipSupportCommandFailureClassification
    notes: string
    context: MembershipSupportCommandContext
    before: unknown
    now: Date
    review?: { reason: string; metadata?: Record<string, unknown> }
  },
): MembershipSupportCommandResult {
  const operator = commandValidateOperator(params.context)
  const actorId = operator?.operatorId ?? 'system'
  const actorType = operator?.actorType ?? 'system'
  const auditEvent = journal.appendAuditEvent(
    commandBuildAuditEvent({
      action: params.action,
      targetCollection: params.targetCollection,
      targetId: params.targetId,
      actorId,
      actorType,
      approvalReference: commandValidateApprovalReference(params.context) ?? `cmd:${params.context.recordId}`,
      before: params.before,
      after: null,
      notes: params.notes,
      severity: 'warning',
      metadata: params.review?.metadata,
      now: params.now,
    }),
  )
  const reviewQueueItem = params.review
    ? journal.enqueueReviewItem(
        commandBuildReviewQueueItem({
          action: params.action,
          targetId: params.targetId,
          reason: params.review.reason,
          notes: params.notes,
          approvalReference: commandValidateApprovalReference(params.context) ?? `cmd:${params.context.recordId}`,
          now: params.now,
          metadata: params.review.metadata,
        }),
      )
    : null
  return commandBuildResult({
    ok: false,
    idempotencyResult: 'rejected',
    failureClassification: params.reason,
    updatedWorkflowProjection: null,
    couponProjection: null,
    promotionCodeProjection: null,
    reconciliationResult: null,
    auditEvent,
    reviewQueueItem,
    updatedVoucher: null,
    updatedAllocation: null,
  })
}

export class MembershipSupportCommandService {
  private readonly cache = new Map<string, MembershipSupportCommandResult>()

  constructor(
    private readonly deps: {
      journal: InMemoryMembershipSupportWorkflowJournal
    },
  ) {}

  async executeVoucherCommand(command: MembershipSupportVoucherCommand): Promise<MembershipSupportCommandResult> {
    const cached = this.cache.get(command.context.idempotencyKey)
    if (cached) return commandBuildResult({ ...cached, idempotencyResult: 'reused' })

    const result = await this.executeVoucherCommandInternal(command)
    this.cache.set(command.context.idempotencyKey, result)
    return result
  }

  async executePayItForwardCommand(command: MembershipSupportPayItForwardCommand): Promise<MembershipSupportCommandResult> {
    const cached = this.cache.get(command.context.idempotencyKey)
    if (cached) return commandBuildResult({ ...cached, idempotencyResult: 'reused' })

    const result = await this.executePayItForwardCommandInternal(command)
    this.cache.set(command.context.idempotencyKey, result)
    return result
  }

  private async executeVoucherCommandInternal(command: MembershipSupportVoucherCommand): Promise<MembershipSupportCommandResult> {
    const operator = commandValidateOperator(command.context)
    if (!operator) {
      return commandFailure(this.deps.journal, {
        action: command.command,
        targetCollection: 'payload_membership_vouchers',
        targetId: command.context.recordId,
        reason: 'missing_operator',
        notes: 'Voucher command rejected because the trusted operator context is missing.',
        context: command.context,
        before: 'voucher' in command ? command.voucher : null,
        now: command.context.now,
      })
    }

    const approvalReference = commandValidateApprovalReference(command.context)
    const commandKey = command.context.idempotencyKey
    const actorType = operator.actorType

    switch (command.command) {
      case 'create_draft': {
        const voucher = commandBuildVoucherRecord({
          id: command.input.id,
          memberId: command.input.memberId,
          memberEmail: command.input.memberEmail,
          voucherDuration: command.input.voucherDuration,
          billingCadence: command.input.billingCadence,
          fundingSource: command.input.fundingSource ?? 'voucher',
          approvalState: 'draft',
          redemptionState: 'not_redeemed',
          stripeCustomerId: command.input.stripeCustomerId,
          stripeCouponId: null,
          stripePromotionCodeId: null,
          stripeSubscriptionId: command.input.stripeSubscriptionId ?? null,
          approvalReference: null,
          issuedBy: operator.operatorId,
          approvedBy: null,
          issuedAt: null,
          expiresAt: null,
          redeemedAt: null,
          deactivatedAt: null,
          reason: command.input.reason,
          notes: command.input.notes,
          metadata: command.input.metadata,
          now: command.context.now,
        })
        const auditEvent = this.deps.journal.appendAuditEvent(
          commandBuildAuditEvent({
            action: 'voucher_draft_created',
            targetCollection: 'payload_membership_vouchers',
            targetId: voucher.id,
            actorId: operator.operatorId,
            actorType,
            approvalReference: approvalReference ?? `draft:${voucher.id}`,
            before: null,
            after: voucher,
            notes: command.input.reason,
            now: command.context.now,
          }),
        )
        this.deps.journal.upsertVoucher(voucher)
        return commandBuildResult({
          ok: true,
          idempotencyResult: 'created',
          failureClassification: null,
          updatedWorkflowProjection: null,
          couponProjection: null,
          promotionCodeProjection: null,
          reconciliationResult: null,
          auditEvent,
          reviewQueueItem: null,
          updatedVoucher: voucher,
          updatedAllocation: null,
        })
      }
      case 'submit_for_approval': {
        if (!commandStateMatches(command.voucher, command.context.expectedCurrentState) || command.voucher.approvalState !== 'draft') {
          return commandFailure(this.deps.journal, {
            action: 'voucher_submit_for_approval',
            targetCollection: 'payload_membership_vouchers',
            targetId: command.voucher.id,
            reason: 'illegal_transition',
            notes: 'Voucher cannot be submitted for approval from the current state.',
            context: command.context,
            before: command.voucher,
            now: command.context.now,
          })
        }
        const voucher = commandBuildVoucherRecord({
          id: command.voucher.id,
          memberId: command.voucher.memberId,
          memberEmail: command.voucher.memberEmail,
          voucherDuration: command.voucher.voucherDuration,
          billingCadence: command.voucher.billingCadence,
          fundingSource: command.voucher.fundingSource,
          approvalState: 'pending_approval',
          redemptionState: command.voucher.redemptionState,
          stripeCustomerId: command.voucher.stripeCustomerId,
          stripeCouponId: command.voucher.stripeCouponId,
          stripePromotionCodeId: command.voucher.stripePromotionCodeId,
          stripeSubscriptionId: command.voucher.stripeSubscriptionId,
          approvalReference: approvalReference ?? `submit:${command.voucher.id}`,
          issuedBy: command.voucher.issuedBy,
          approvedBy: command.voucher.approvedBy,
          issuedAt: command.voucher.issuedAt ? new Date(command.voucher.issuedAt) : null,
          expiresAt: command.voucher.expiresAt ? new Date(command.voucher.expiresAt) : null,
          redeemedAt: command.voucher.redeemedAt ? new Date(command.voucher.redeemedAt) : null,
          deactivatedAt: command.voucher.deactivatedAt ? new Date(command.voucher.deactivatedAt) : null,
          reason: command.voucher.reason,
          notes: command.voucher.notes,
          metadata: command.voucher.metadata,
          now: command.context.now,
        })
        const reviewQueueItem = this.deps.journal.enqueueReviewItem(
          commandBuildReviewQueueItem({
            action: 'voucher_submit_for_approval',
            targetId: voucher.id,
            reason: 'approval_required',
            notes: 'Voucher submitted for approval.',
            approvalReference: approvalReference ?? `submit:${voucher.id}`,
            now: command.context.now,
          }),
        )
        const auditEvent = this.deps.journal.appendAuditEvent(
          commandBuildAuditEvent({
            action: 'voucher_submit_for_approval',
            targetCollection: 'payload_membership_review_queue_items',
            targetId: reviewQueueItem.id,
            actorId: operator.operatorId,
            actorType,
            approvalReference: approvalReference ?? `submit:${voucher.id}`,
            before: command.voucher,
            after: reviewQueueItem,
            notes: 'Voucher submitted for administrator approval.',
            now: command.context.now,
          }),
        )
        this.deps.journal.upsertVoucher(voucher)
        return commandBuildResult({
          ok: true,
          idempotencyResult: 'created',
          failureClassification: null,
          updatedWorkflowProjection: null,
          couponProjection: null,
          promotionCodeProjection: null,
          reconciliationResult: null,
          auditEvent,
          reviewQueueItem,
          updatedVoucher: voucher,
          updatedAllocation: null,
        })
      }
      case 'approve': {
        if (!approvalReference) {
          return commandFailure(this.deps.journal, {
            action: 'voucher_approved',
            targetCollection: 'payload_membership_vouchers',
            targetId: command.voucher.id,
            reason: 'missing_approval',
            notes: 'Voucher approval requires a trusted approval reference.',
            context: command.context,
            before: command.voucher,
            now: command.context.now,
          })
        }
        if (!commandStateMatches(command.voucher, command.context.expectedCurrentState) || command.voucher.approvalState !== 'pending_approval') {
          return commandFailure(this.deps.journal, {
            action: 'voucher_approved',
            targetCollection: 'payload_membership_vouchers',
            targetId: command.voucher.id,
            reason: 'illegal_transition',
            notes: 'Voucher cannot be approved from the current state.',
            context: command.context,
            before: command.voucher,
            now: command.context.now,
          })
        }
        const voucher = commandBuildVoucherRecord({
          id: command.voucher.id,
          memberId: command.voucher.memberId,
          memberEmail: command.voucher.memberEmail,
          voucherDuration: command.voucher.voucherDuration,
          billingCadence: command.voucher.billingCadence,
          fundingSource: command.voucher.fundingSource,
          approvalState: 'approved',
          redemptionState: command.voucher.redemptionState,
          stripeCustomerId: command.voucher.stripeCustomerId,
          stripeCouponId: command.voucher.stripeCouponId,
          stripePromotionCodeId: command.voucher.stripePromotionCodeId,
          stripeSubscriptionId: command.voucher.stripeSubscriptionId,
          approvalReference,
          issuedBy: command.voucher.issuedBy,
          approvedBy: operator.operatorId,
          issuedAt: command.voucher.issuedAt ? new Date(command.voucher.issuedAt) : null,
          expiresAt: command.voucher.expiresAt ? new Date(command.voucher.expiresAt) : null,
          redeemedAt: command.voucher.redeemedAt ? new Date(command.voucher.redeemedAt) : null,
          deactivatedAt: command.voucher.deactivatedAt ? new Date(command.voucher.deactivatedAt) : null,
          reason: command.voucher.reason,
          notes: command.voucher.notes,
          metadata: command.voucher.metadata,
          now: command.context.now,
        })
        const auditEvent = this.deps.journal.appendAuditEvent(
          commandBuildAuditEvent({
            action: 'voucher_approved',
            targetCollection: 'payload_membership_vouchers',
            targetId: voucher.id,
            actorId: operator.operatorId,
            actorType,
            approvalReference,
            before: command.voucher,
            after: voucher,
            notes: 'Voucher approved by administrator.',
            now: command.context.now,
          }),
        )
        this.deps.journal.upsertVoucher(voucher)
        return commandBuildResult({
          ok: true,
          idempotencyResult: 'created',
          failureClassification: null,
          updatedWorkflowProjection: null,
          couponProjection: null,
          promotionCodeProjection: null,
          reconciliationResult: null,
          auditEvent,
          reviewQueueItem: null,
          updatedVoucher: voucher,
          updatedAllocation: null,
        })
      }
      case 'issue_one_month':
      case 'issue_one_year':
      case 'retry_failed_issuance': {
        const voucher = command.voucher
        const targetDuration =
          command.command === 'issue_one_month'
            ? 'one_month'
            : command.command === 'issue_one_year'
              ? 'one_year'
              : voucher.voucherDuration
        if (!approvalReference) {
          return commandFailure(this.deps.journal, {
            action: 'voucher_projection_issued',
            targetCollection: 'payload_membership_support_records',
            targetId: voucher.id,
            reason: 'missing_approval',
            notes: 'Voucher issuance requires a trusted approval reference.',
            context: command.context,
            before: voucher,
            now: command.context.now,
          })
        }
        if (!commandStateMatches(voucher, command.context.expectedCurrentState)) {
          return commandFailure(this.deps.journal, {
            action: 'voucher_projection_issued',
            targetCollection: 'payload_membership_support_records',
            targetId: voucher.id,
            reason: 'illegal_transition',
            notes: 'Voucher issuance rejected because the current state does not match expectation.',
            context: command.context,
            before: voucher,
            now: command.context.now,
          })
        }
        if ((voucher.fundingSource as MembershipFundingSource) === 'direct_payment') {
          return commandFailure(this.deps.journal, {
            action: 'voucher_projection_issued',
            targetCollection: 'payload_membership_support_records',
            targetId: voucher.id,
            reason: 'direct_non_stripe_sponsored_access_rejection',
            notes: 'Direct sponsored access is not a supported command path.',
            context: command.context,
            before: voucher,
            now: command.context.now,
          })
        }
        if (voucher.voucherDuration !== targetDuration) {
          return commandFailure(this.deps.journal, {
            action: 'voucher_projection_issued',
            targetCollection: 'payload_membership_support_records',
            targetId: voucher.id,
            reason: 'unsupported_duration',
            notes: 'Voucher issuance rejected because the requested duration does not match the voucher.',
            context: command.context,
            before: voucher,
            now: command.context.now,
          })
        }
        if (voucher.approvalState !== 'approved' && !(command.command === 'retry_failed_issuance' && voucher.approvalState === 'failed')) {
          return commandFailure(this.deps.journal, {
            action: 'voucher_projection_issued',
            targetCollection: 'payload_membership_support_records',
            targetId: voucher.id,
            reason: 'illegal_transition',
            notes: 'Voucher issuance rejected until approval is present.',
            context: command.context,
            before: voucher,
            now: command.context.now,
          })
        }
        const issuingVoucher = command.command === 'retry_failed_issuance'
          ? commandBuildVoucherRecord({
              id: voucher.id,
              memberId: voucher.memberId,
              memberEmail: voucher.memberEmail,
              voucherDuration: voucher.voucherDuration,
              billingCadence: voucher.billingCadence,
              fundingSource: voucher.fundingSource,
              approvalState: 'approved',
              redemptionState: voucher.redemptionState,
              stripeCustomerId: voucher.stripeCustomerId,
              stripeCouponId: voucher.stripeCouponId,
              stripePromotionCodeId: voucher.stripePromotionCodeId,
              stripeSubscriptionId: voucher.stripeSubscriptionId,
              approvalReference,
              issuedBy: voucher.issuedBy,
              approvedBy: voucher.approvedBy,
              issuedAt: voucher.issuedAt ? new Date(voucher.issuedAt) : null,
              expiresAt: voucher.expiresAt ? new Date(voucher.expiresAt) : null,
              redeemedAt: voucher.redeemedAt ? new Date(voucher.redeemedAt) : null,
              deactivatedAt: voucher.deactivatedAt ? new Date(voucher.deactivatedAt) : null,
              reason: voucher.reason,
              notes: voucher.notes,
              metadata: voucher.metadata,
              now: command.context.now,
            })
          : voucher
        try {
          const issuance = await issueMembershipSupportVoucher({
            record: {
              id: issuingVoucher.id,
              fundingSource: issuingVoucher.fundingSource,
              voucherDuration: issuingVoucher.voucherDuration,
              issuanceState: 'approved',
              intendedRecipientEmail: issuingVoucher.memberEmail,
              stripeCustomerId: issuingVoucher.stripeCustomerId,
              stripeCouponId: issuingVoucher.stripeCouponId,
              stripePromotionCodeId: issuingVoucher.stripePromotionCodeId,
              stripeSubscriptionId: issuingVoucher.stripeSubscriptionId,
              billingCadence: issuingVoucher.billingCadence,
              issuedBy: issuingVoucher.issuedBy,
              approvedBy: issuingVoucher.approvedBy,
              issuedAt: issuingVoucher.issuedAt ? new Date(issuingVoucher.issuedAt) : null,
              expiresAt: issuingVoucher.expiresAt ? new Date(issuingVoucher.expiresAt) : null,
              redeemedAt: issuingVoucher.redeemedAt ? new Date(issuingVoucher.redeemedAt) : null,
              deactivatedAt: issuingVoucher.deactivatedAt ? new Date(issuingVoucher.deactivatedAt) : null,
              reason: issuingVoucher.reason,
              approvalReference,
              reconciliationState: 'pending',
              lastWebhookAt: command.context.now,
            },
            adapter: command.adapter,
            now: command.context.now,
          })
          const updatedProjection = buildMembershipSupportProjectionRecord({
            source: issuingVoucher.fundingSource,
            recordId: issuingVoucher.id,
            memberId: issuingVoucher.memberId,
            memberEmail: issuingVoucher.memberEmail,
            voucherDuration: issuingVoucher.voucherDuration,
            billingCadence: issuingVoucher.billingCadence,
            stripeCustomerId: issuance.stripeCustomerId,
            stripeSubscriptionId: issuingVoucher.stripeSubscriptionId,
            couponId: issuance.couponId,
            promotionCodeId: issuance.promotionCodeId,
            approvalReference,
            operatorId: operator.operatorId,
            reason: issuingVoucher.reason,
            now: command.context.now,
            reconciliationState: issuance.reconciliationState,
          })
          const updatedVoucher = commandBuildVoucherRecord({
            id: issuingVoucher.id,
            memberId: issuingVoucher.memberId,
            memberEmail: issuingVoucher.memberEmail,
            voucherDuration: issuingVoucher.voucherDuration,
            billingCadence: issuingVoucher.billingCadence,
            fundingSource: issuingVoucher.fundingSource,
            approvalState: issuance.reconciliationState === 'mismatch' ? 'failed' : 'issued',
            redemptionState: issuingVoucher.redemptionState,
            stripeCustomerId: issuance.stripeCustomerId,
            stripeCouponId: issuance.coupon.id,
            stripePromotionCodeId: issuance.promotionCode.id,
            stripeSubscriptionId: issuingVoucher.stripeSubscriptionId,
            approvalReference,
            issuedBy: operator.operatorId,
            approvedBy: issuingVoucher.approvedBy ?? operator.operatorId,
            issuedAt: command.context.now,
            expiresAt: new Date(updatedProjection.expiresAt),
            redeemedAt: issuingVoucher.redeemedAt ? new Date(issuingVoucher.redeemedAt) : null,
            deactivatedAt: issuingVoucher.deactivatedAt ? new Date(issuingVoucher.deactivatedAt) : null,
            reason: issuingVoucher.reason,
            notes: issuingVoucher.notes,
            metadata: issuingVoucher.metadata,
            now: command.context.now,
          })
          this.deps.journal.upsertVoucher(updatedVoucher)
          this.deps.journal.upsertSupportProjection(updatedProjection)
          const auditEvent = this.deps.journal.appendAuditEvent(
            commandBuildAuditEvent({
              action: 'voucher_projection_issued',
              targetCollection: 'payload_membership_support_records',
              targetId: updatedProjection.id,
              actorId: operator.operatorId,
              actorType,
              approvalReference,
              before: voucher,
              after: updatedProjection,
              notes: `Voucher projection issued with reconciliation ${issuance.reconciliationState}.`,
              severity: issuance.reconciliationState === 'matched' ? 'info' : 'warning',
              metadata: {
                couponId: issuance.couponId,
                promotionCodeId: issuance.promotionCodeId,
                reconciliationReasons: issuance.reconciliationReasons,
              },
              now: command.context.now,
            }),
          )
          if (issuance.reconciliationState === 'mismatch') {
            const reviewQueueItem = this.deps.journal.enqueueReviewItem(
              commandBuildReviewQueueItem({
                action: 'voucher_projection_issued',
                targetId: updatedProjection.id,
                reason: 'webhook_mismatch',
                notes: `Voucher projection reconciled with mismatch: ${issuance.reconciliationReasons.join(',') || 'unknown'}.`,
                approvalReference,
                now: command.context.now,
                metadata: {
                  reconciliationReasons: issuance.reconciliationReasons,
                  couponId: issuance.couponId,
                  promotionCodeId: issuance.promotionCodeId,
                },
              }),
            )
            return commandBuildResult({
              ok: false,
              idempotencyResult: command.command === 'retry_failed_issuance' ? 'retried' : 'created',
              failureClassification: 'reconciliation_mismatch',
              updatedWorkflowProjection: updatedProjection,
              couponProjection: issuance.coupon,
              promotionCodeProjection: issuance.promotionCode,
              reconciliationResult: issuance.reconciliation,
              auditEvent,
              reviewQueueItem,
              updatedVoucher,
              updatedAllocation: null,
            })
          }
          return commandBuildResult({
            ok: true,
            idempotencyResult: command.command === 'retry_failed_issuance' ? 'retried' : 'created',
            failureClassification: null,
            updatedWorkflowProjection: updatedProjection,
            couponProjection: issuance.coupon,
            promotionCodeProjection: issuance.promotionCode,
            reconciliationResult: issuance.reconciliation,
            auditEvent,
            reviewQueueItem: null,
            updatedVoucher,
            updatedAllocation: null,
          })
        } catch (error) {
          const failedVoucher = commandBuildVoucherRecord({
            id: voucher.id,
            memberId: voucher.memberId,
            memberEmail: voucher.memberEmail,
            voucherDuration: voucher.voucherDuration,
            billingCadence: voucher.billingCadence,
            fundingSource: voucher.fundingSource,
            approvalState: 'failed',
            redemptionState: voucher.redemptionState,
            stripeCustomerId: voucher.stripeCustomerId,
            stripeCouponId: voucher.stripeCouponId,
            stripePromotionCodeId: voucher.stripePromotionCodeId,
            stripeSubscriptionId: voucher.stripeSubscriptionId,
            approvalReference,
            issuedBy: voucher.issuedBy,
            approvedBy: voucher.approvedBy,
            issuedAt: voucher.issuedAt ? new Date(voucher.issuedAt) : null,
            expiresAt: voucher.expiresAt ? new Date(voucher.expiresAt) : null,
            redeemedAt: voucher.redeemedAt ? new Date(voucher.redeemedAt) : null,
            deactivatedAt: voucher.deactivatedAt ? new Date(voucher.deactivatedAt) : null,
            reason: voucher.reason,
            notes: `${voucher.notes}${voucher.notes ? '\n' : ''}Issuance failed.`,
            metadata: {
              ...voucher.metadata,
              failure: error instanceof Error ? error.message : 'provider_failure',
            },
            now: command.context.now,
          })
          this.deps.journal.upsertVoucher(failedVoucher)
          const reviewQueueItem = this.deps.journal.enqueueReviewItem(
            commandBuildReviewQueueItem({
              action: 'voucher_projection_issued',
              targetId: failedVoucher.id,
              reason: 'manual_override',
              notes: error instanceof Error ? error.message : 'provider_failure',
              approvalReference,
              now: command.context.now,
              metadata: {
                failure: error instanceof Error ? error.message : 'provider_failure',
              },
            }),
          )
          const auditEvent = this.deps.journal.appendAuditEvent(
            commandBuildAuditEvent({
              action: 'voucher_projection_issued',
              targetCollection: 'payload_membership_review_queue_items',
              targetId: reviewQueueItem.id,
              actorId: operator.operatorId,
              actorType,
              approvalReference,
              before: voucher,
              after: reviewQueueItem,
              notes: error instanceof Error ? error.message : 'provider_failure',
              severity: 'warning',
              metadata: {
                failure: error instanceof Error ? error.message : 'provider_failure',
              },
              now: command.context.now,
            }),
          )
          return commandBuildResult({
            ok: false,
            idempotencyResult: command.command === 'retry_failed_issuance' ? 'retried' : 'created',
            failureClassification: 'provider_failure',
            updatedWorkflowProjection: null,
            couponProjection: null,
            promotionCodeProjection: null,
            reconciliationResult: null,
            auditEvent,
            reviewQueueItem,
            updatedVoucher: failedVoucher,
            updatedAllocation: null,
          })
        }
      }
      case 'deactivate_unused': {
        if (!commandStateMatches(command.voucher, command.context.expectedCurrentState) || command.voucher.redemptionState === 'redeemed') {
          return commandFailure(this.deps.journal, {
            action: 'voucher_deactivated',
            targetCollection: 'payload_membership_vouchers',
            targetId: command.voucher.id,
            reason: 'illegal_transition',
            notes: 'Voucher deactivation rejected because the voucher has already been redeemed or the state does not match.',
            context: command.context,
            before: command.voucher,
            now: command.context.now,
          })
        }
        const voucher = commandBuildVoucherRecord({
          id: command.voucher.id,
          memberId: command.voucher.memberId,
          memberEmail: command.voucher.memberEmail,
          voucherDuration: command.voucher.voucherDuration,
          billingCadence: command.voucher.billingCadence,
          fundingSource: command.voucher.fundingSource,
          approvalState: 'revoked',
          redemptionState: 'deactivated',
          stripeCustomerId: command.voucher.stripeCustomerId,
          stripeCouponId: command.voucher.stripeCouponId,
          stripePromotionCodeId: command.voucher.stripePromotionCodeId,
          stripeSubscriptionId: command.voucher.stripeSubscriptionId,
          approvalReference: approvalReference ?? `deactivate:${command.voucher.id}`,
          issuedBy: command.voucher.issuedBy,
          approvedBy: command.voucher.approvedBy,
          issuedAt: command.voucher.issuedAt ? new Date(command.voucher.issuedAt) : null,
          expiresAt: command.voucher.expiresAt ? new Date(command.voucher.expiresAt) : null,
          redeemedAt: command.voucher.redeemedAt ? new Date(command.voucher.redeemedAt) : null,
          deactivatedAt: command.context.now,
          reason: command.voucher.reason,
          notes: command.voucher.notes,
          metadata: command.voucher.metadata,
          now: command.context.now,
        })
        const auditEvent = this.deps.journal.appendAuditEvent(
          commandBuildAuditEvent({
            action: 'voucher_deactivated',
            targetCollection: 'payload_membership_vouchers',
            targetId: voucher.id,
            actorId: operator.operatorId,
            actorType,
            approvalReference: approvalReference ?? `deactivate:${voucher.id}`,
            before: command.voucher,
            after: voucher,
            notes: 'Voucher deactivated by administrator.',
            now: command.context.now,
          }),
        )
        this.deps.journal.upsertVoucher(voucher)
        return commandBuildResult({
          ok: true,
          idempotencyResult: 'created',
          failureClassification: null,
          updatedWorkflowProjection: null,
          couponProjection: null,
          promotionCodeProjection: null,
          reconciliationResult: null,
          auditEvent,
          reviewQueueItem: null,
          updatedVoucher: voucher,
          updatedAllocation: null,
        })
      }
      case 'mark_expired': {
        if (!commandStateMatches(command.voucher, command.context.expectedCurrentState) || command.voucher.redemptionState === 'redeemed') {
          return commandFailure(this.deps.journal, {
            action: 'voucher_expired',
            targetCollection: 'payload_membership_vouchers',
            targetId: command.voucher.id,
            reason: 'illegal_transition',
            notes: 'Voucher expiry rejected because the voucher has already been redeemed or the state does not match.',
            context: command.context,
            before: command.voucher,
            now: command.context.now,
          })
        }
        const voucher = commandBuildVoucherRecord({
          id: command.voucher.id,
          memberId: command.voucher.memberId,
          memberEmail: command.voucher.memberEmail,
          voucherDuration: command.voucher.voucherDuration,
          billingCadence: command.voucher.billingCadence,
          fundingSource: command.voucher.fundingSource,
          approvalState: command.voucher.approvalState,
          redemptionState: 'expired',
          stripeCustomerId: command.voucher.stripeCustomerId,
          stripeCouponId: command.voucher.stripeCouponId,
          stripePromotionCodeId: command.voucher.stripePromotionCodeId,
          stripeSubscriptionId: command.voucher.stripeSubscriptionId,
          approvalReference: approvalReference ?? `expire:${command.voucher.id}`,
          issuedBy: command.voucher.issuedBy,
          approvedBy: command.voucher.approvedBy,
          issuedAt: command.voucher.issuedAt ? new Date(command.voucher.issuedAt) : null,
          expiresAt: command.context.now,
          redeemedAt: command.voucher.redeemedAt ? new Date(command.voucher.redeemedAt) : null,
          deactivatedAt: command.voucher.deactivatedAt ? new Date(command.voucher.deactivatedAt) : null,
          reason: command.voucher.reason,
          notes: command.voucher.notes,
          metadata: command.voucher.metadata,
          now: command.context.now,
        })
        const auditEvent = this.deps.journal.appendAuditEvent(
          commandBuildAuditEvent({
            action: 'voucher_expired',
            targetCollection: 'payload_membership_vouchers',
            targetId: voucher.id,
            actorId: operator.operatorId,
            actorType,
            approvalReference: approvalReference ?? `expire:${voucher.id}`,
            before: command.voucher,
            after: voucher,
            notes: 'Voucher expired by administrator.',
            now: command.context.now,
          }),
        )
        this.deps.journal.upsertVoucher(voucher)
        return commandBuildResult({
          ok: true,
          idempotencyResult: 'created',
          failureClassification: null,
          updatedWorkflowProjection: null,
          couponProjection: null,
          promotionCodeProjection: null,
          reconciliationResult: null,
          auditEvent,
          reviewQueueItem: null,
          updatedVoucher: voucher,
          updatedAllocation: null,
        })
      }
      case 'route_mismatch_to_review': {
        if (!commandStateMatches(command.projection, command.context.expectedCurrentState) || command.projection.reconciliationState !== 'mismatch') {
          return commandFailure(this.deps.journal, {
            action: 'voucher_projection_review_routed',
            targetCollection: 'payload_membership_review_queue_items',
            targetId: command.projection.id,
            reason: 'review_required',
            notes: 'Voucher projection can only be routed to review when the reconciliation state is mismatch.',
            context: command.context,
            before: command.projection,
            now: command.context.now,
          })
        }
        const reviewQueueItem = this.deps.journal.enqueueReviewItem(
          commandBuildReviewQueueItem({
            action: 'voucher_projection_review_routed',
            targetId: command.projection.id,
            reason: 'webhook_mismatch',
            notes: 'Voucher projection routed to review.',
            approvalReference: command.projection.approvalReference,
            now: command.context.now,
            metadata: {
              reconciliationState: command.projection.reconciliationState,
              stripeCustomerId: command.projection.stripeCustomerId,
            },
          }),
        )
        const auditEvent = this.deps.journal.appendAuditEvent(
          commandBuildAuditEvent({
            action: 'voucher_projection_review_routed',
            targetCollection: 'payload_membership_review_queue_items',
            targetId: reviewQueueItem.id,
            actorId: operator.operatorId,
            actorType,
            approvalReference: command.projection.approvalReference,
            before: command.projection,
            after: reviewQueueItem,
            notes: 'Voucher projection routed to manual review.',
            severity: 'warning',
            metadata: { reconciliationState: command.projection.reconciliationState },
            now: command.context.now,
          }),
        )
        return commandBuildResult({
          ok: true,
          idempotencyResult: 'created',
          failureClassification: null,
          updatedWorkflowProjection: command.projection,
          couponProjection: null,
          promotionCodeProjection: null,
          reconciliationResult: null,
          auditEvent,
          reviewQueueItem,
          updatedVoucher: null,
          updatedAllocation: null,
        })
      }
      case 'resolve_review': {
        if (!commandStateMatches(command.reviewQueueItem, command.context.expectedCurrentState) || (command.reviewQueueItem.queueState !== 'needs_review' && command.reviewQueueItem.queueState !== 'in_review')) {
          return commandFailure(this.deps.journal, {
            action: 'voucher_review_resolved',
            targetCollection: 'payload_membership_review_queue_items',
            targetId: command.reviewQueueItem.id,
            reason: 'illegal_transition',
            notes: 'Review can only be resolved from needs_review or in_review.',
            context: command.context,
            before: command.reviewQueueItem,
            now: command.context.now,
          })
        }
        const resolvedReviewQueueItem = commandFreeze({
          ...command.reviewQueueItem,
          queueState: 'closed' as const,
          resolvedAt: command.context.now.toISOString(),
          notes: `${command.reviewQueueItem.notes}${command.reviewQueueItem.notes ? '\n' : ''}Resolved by administrator.`,
          updatedAt: command.context.now.toISOString(),
          projection: {
            ...command.reviewQueueItem.projection,
            status: 'closed' as const,
            updatedAt: command.context.now.toISOString(),
            resolutionNote: `${command.reviewQueueItem.notes}${command.reviewQueueItem.notes ? '\n' : ''}Resolved by administrator.`,
            resolvedAt: command.context.now.toISOString(),
            assignedOperator: operator.operatorId,
          },
        })
        this.deps.journal.enqueueReviewItem(resolvedReviewQueueItem)
        const auditEvent = this.deps.journal.appendAuditEvent(
          commandBuildAuditEvent({
            action: 'voucher_review_resolved',
            targetCollection: 'payload_membership_review_queue_items',
            targetId: resolvedReviewQueueItem.id,
            actorId: operator.operatorId,
            actorType,
            approvalReference: command.reviewQueueItem.notes || command.context.approvalReference || `review:${command.reviewQueueItem.id}`,
            before: command.reviewQueueItem,
            after: resolvedReviewQueueItem,
            notes: 'Voucher review resolved by administrator.',
            now: command.context.now,
          }),
        )
        return commandBuildResult({
          ok: true,
          idempotencyResult: 'created',
          failureClassification: null,
          updatedWorkflowProjection: null,
          couponProjection: null,
          promotionCodeProjection: null,
          reconciliationResult: null,
          auditEvent,
          reviewQueueItem: resolvedReviewQueueItem,
          updatedVoucher: null,
          updatedAllocation: null,
        })
      }
    }
  }

  private async executePayItForwardCommandInternal(command: MembershipSupportPayItForwardCommand): Promise<MembershipSupportCommandResult> {
    const operator = commandValidateOperator(command.context)
    if (!operator) {
      return commandFailure(this.deps.journal, {
        action: command.command,
        targetCollection: 'payload_pay_it_forward_funding',
        targetId: command.context.recordId,
        reason: 'missing_operator',
        notes: 'Pay-it-forward command rejected because the trusted operator context is missing.',
        context: command.context,
        before: 'allocation' in command ? command.allocation : null,
        now: command.context.now,
      })
    }
    const approvalReference = commandValidateApprovalReference(command.context)
    const actorType = operator.actorType

    switch (command.command) {
      case 'create_funding_allocation': {
        const allocation = commandBuildAllocationRecord({
          id: command.input.id,
          memberId: command.input.memberId,
          memberEmail: command.input.memberEmail,
          donorName: command.input.donorName,
          billingCadence: command.input.billingCadence,
          allocatedAmountMinor: command.input.allocatedAmountMinor,
          currency: command.input.currency,
          approvalState: 'draft',
          stripeCustomerId: command.input.stripeCustomerId,
          stripeCouponId: command.input.stripeCouponId,
          stripePromotionCodeId: command.input.stripePromotionCodeId,
          stripeSubscriptionId: command.input.stripeSubscriptionId,
          approvalReference: null,
          issuedBy: operator.operatorId,
          approvedBy: null,
          issuedAt: null,
          expiresAt: null,
          redeemedAt: null,
          revokedAt: null,
          reason: command.input.reason,
          notes: command.input.notes,
          metadata: command.input.metadata,
          now: command.context.now,
        })
        const auditEvent = this.deps.journal.appendAuditEvent(
          commandBuildAuditEvent({
            action: 'pay_it_forward_allocation_created',
            targetCollection: 'payload_pay_it_forward_funding',
            targetId: allocation.id,
            actorId: operator.operatorId,
            actorType,
            approvalReference: `draft:${allocation.id}`,
            before: null,
            after: allocation,
            notes: allocation.reason,
            now: command.context.now,
          }),
        )
        this.deps.journal.upsertPayItForwardAllocation(allocation)
        return commandBuildResult({
          ok: true,
          idempotencyResult: 'created',
          failureClassification: null,
          updatedWorkflowProjection: null,
          couponProjection: null,
          promotionCodeProjection: null,
          reconciliationResult: null,
          auditEvent,
          reviewQueueItem: null,
          updatedVoucher: null,
          updatedAllocation: allocation,
        })
      }
      case 'submit_for_approval': {
        if (!commandStateMatches(command.allocation, command.context.expectedCurrentState) || command.allocation.approvalState !== 'draft') {
          return commandFailure(this.deps.journal, {
            action: 'pay_it_forward_allocation_submitted',
            targetCollection: 'payload_pay_it_forward_funding',
            targetId: command.allocation.id,
            reason: 'illegal_transition',
            notes: 'Pay-it-forward allocation cannot be submitted from the current state.',
            context: command.context,
            before: command.allocation,
            now: command.context.now,
          })
        }
        const allocation = commandBuildAllocationRecord({
          id: command.allocation.id,
          memberId: command.allocation.memberId,
          memberEmail: command.allocation.memberEmail,
          donorName: command.allocation.donorName,
          billingCadence: command.allocation.billingCadence,
          allocatedAmountMinor: command.allocation.allocatedAmountMinor,
          currency: command.allocation.currency,
          approvalState: 'pending_approval',
          stripeCustomerId: command.allocation.stripeCustomerId,
          stripeCouponId: command.allocation.stripeCouponId,
          stripePromotionCodeId: command.allocation.stripePromotionCodeId,
          stripeSubscriptionId: command.allocation.stripeSubscriptionId,
          approvalReference: approvalReference ?? `submit:${command.allocation.id}`,
          issuedBy: command.allocation.issuedBy,
          approvedBy: command.allocation.approvedBy,
          issuedAt: command.allocation.issuedAt ? new Date(command.allocation.issuedAt) : null,
          expiresAt: command.allocation.expiresAt ? new Date(command.allocation.expiresAt) : null,
          redeemedAt: command.allocation.redeemedAt ? new Date(command.allocation.redeemedAt) : null,
          revokedAt: command.allocation.revokedAt ? new Date(command.allocation.revokedAt) : null,
          reason: command.allocation.reason,
          notes: command.allocation.notes,
          metadata: command.allocation.metadata,
          now: command.context.now,
        })
        const reviewQueueItem = this.deps.journal.enqueueReviewItem(
          commandBuildReviewQueueItem({
            action: 'pay_it_forward_allocation_submitted',
            targetId: allocation.id,
            reason: 'approval_required',
            notes: 'Pay-it-forward allocation submitted for approval.',
            approvalReference: approvalReference ?? `submit:${allocation.id}`,
            now: command.context.now,
          }),
        )
        const auditEvent = this.deps.journal.appendAuditEvent(
          commandBuildAuditEvent({
            action: 'pay_it_forward_allocation_submitted',
            targetCollection: 'payload_membership_review_queue_items',
            targetId: reviewQueueItem.id,
            actorId: operator.operatorId,
            actorType,
            approvalReference: approvalReference ?? `submit:${allocation.id}`,
            before: command.allocation,
            after: reviewQueueItem,
            notes: 'Pay-it-forward allocation submitted for administrator approval.',
            now: command.context.now,
          }),
        )
        this.deps.journal.upsertPayItForwardAllocation(allocation)
        return commandBuildResult({
          ok: true,
          idempotencyResult: 'created',
          failureClassification: null,
          updatedWorkflowProjection: null,
          couponProjection: null,
          promotionCodeProjection: null,
          reconciliationResult: null,
          auditEvent,
          reviewQueueItem,
          updatedVoucher: null,
          updatedAllocation: allocation,
        })
      }
      case 'approve': {
        if (!approvalReference) {
          return commandFailure(this.deps.journal, {
            action: 'pay_it_forward_allocation_approved',
            targetCollection: 'payload_pay_it_forward_funding',
            targetId: command.allocation.id,
            reason: 'missing_approval',
            notes: 'Pay-it-forward approval requires a trusted approval reference.',
            context: command.context,
            before: command.allocation,
            now: command.context.now,
          })
        }
        if (!commandStateMatches(command.allocation, command.context.expectedCurrentState) || command.allocation.approvalState !== 'pending_approval') {
          return commandFailure(this.deps.journal, {
            action: 'pay_it_forward_allocation_approved',
            targetCollection: 'payload_pay_it_forward_funding',
            targetId: command.allocation.id,
            reason: 'illegal_transition',
            notes: 'Pay-it-forward allocation cannot be approved from the current state.',
            context: command.context,
            before: command.allocation,
            now: command.context.now,
          })
        }
        const allocation = commandBuildAllocationRecord({
          id: command.allocation.id,
          memberId: command.allocation.memberId,
          memberEmail: command.allocation.memberEmail,
          donorName: command.allocation.donorName,
          billingCadence: command.allocation.billingCadence,
          allocatedAmountMinor: command.allocation.allocatedAmountMinor,
          currency: command.allocation.currency,
          approvalState: 'approved',
          stripeCustomerId: command.allocation.stripeCustomerId,
          stripeCouponId: command.allocation.stripeCouponId,
          stripePromotionCodeId: command.allocation.stripePromotionCodeId,
          stripeSubscriptionId: command.allocation.stripeSubscriptionId,
          approvalReference,
          issuedBy: command.allocation.issuedBy,
          approvedBy: operator.operatorId,
          issuedAt: command.allocation.issuedAt ? new Date(command.allocation.issuedAt) : null,
          expiresAt: command.allocation.expiresAt ? new Date(command.allocation.expiresAt) : null,
          redeemedAt: command.allocation.redeemedAt ? new Date(command.allocation.redeemedAt) : null,
          revokedAt: command.allocation.revokedAt ? new Date(command.allocation.revokedAt) : null,
          reason: command.allocation.reason,
          notes: command.allocation.notes,
          metadata: command.allocation.metadata,
          now: command.context.now,
        })
        const auditEvent = this.deps.journal.appendAuditEvent(
          commandBuildAuditEvent({
            action: 'pay_it_forward_allocation_approved',
            targetCollection: 'payload_pay_it_forward_funding',
            targetId: allocation.id,
            actorId: operator.operatorId,
            actorType,
            approvalReference,
            before: command.allocation,
            after: allocation,
            notes: 'Pay-it-forward allocation approved by administrator.',
            now: command.context.now,
          }),
        )
        this.deps.journal.upsertPayItForwardAllocation(allocation)
        return commandBuildResult({
          ok: true,
          idempotencyResult: 'created',
          failureClassification: null,
          updatedWorkflowProjection: null,
          couponProjection: null,
          promotionCodeProjection: null,
          reconciliationResult: null,
          auditEvent,
          reviewQueueItem: null,
          updatedVoucher: null,
          updatedAllocation: allocation,
        })
      }
      case 'issue_one_month_funded_membership':
      case 'issue_one_year_funded_membership':
      case 'retry_failed_issuance': {
        const allocation = command.allocation
        const targetDuration =
          command.command === 'issue_one_month_funded_membership'
            ? 'one_month'
            : command.command === 'issue_one_year_funded_membership'
              ? 'one_year'
              : allocation.billingCadence === 'monthly'
                ? 'one_month'
                : 'one_year'
        if (!approvalReference) {
          return commandFailure(this.deps.journal, {
            action: 'pay_it_forward_projection_issued',
            targetCollection: 'payload_membership_support_records',
            targetId: allocation.id,
            reason: 'missing_approval',
            notes: 'Pay-it-forward issuance requires a trusted approval reference.',
            context: command.context,
            before: allocation,
            now: command.context.now,
          })
        }
        if (!commandStateMatches(allocation, command.context.expectedCurrentState)) {
          return commandFailure(this.deps.journal, {
            action: 'pay_it_forward_projection_issued',
            targetCollection: 'payload_membership_support_records',
            targetId: allocation.id,
            reason: 'illegal_transition',
            notes: 'Pay-it-forward issuance rejected because the current state does not match expectation.',
            context: command.context,
            before: allocation,
            now: command.context.now,
          })
        }
        if (allocation.approvalState !== 'approved' && !(command.command === 'retry_failed_issuance' && allocation.approvalState === 'failed')) {
          return commandFailure(this.deps.journal, {
            action: 'pay_it_forward_projection_issued',
            targetCollection: 'payload_membership_support_records',
            targetId: allocation.id,
            reason: 'illegal_transition',
            notes: 'Pay-it-forward issuance rejected until approval is present.',
            context: command.context,
            before: allocation,
            now: command.context.now,
          })
        }
        if (allocation.billingCadence === 'monthly' && targetDuration !== 'one_month') {
          return commandFailure(this.deps.journal, {
            action: 'pay_it_forward_projection_issued',
            targetCollection: 'payload_membership_support_records',
            targetId: allocation.id,
            reason: 'unsupported_duration',
            notes: 'Pay-it-forward issuance rejected because the requested duration does not match the allocation cadence.',
            context: command.context,
            before: allocation,
            now: command.context.now,
          })
        }
        if (allocation.billingCadence === 'annual' && targetDuration !== 'one_year') {
          return commandFailure(this.deps.journal, {
            action: 'pay_it_forward_projection_issued',
            targetCollection: 'payload_membership_support_records',
            targetId: allocation.id,
            reason: 'unsupported_duration',
            notes: 'Pay-it-forward issuance rejected because the requested duration does not match the allocation cadence.',
            context: command.context,
            before: allocation,
            now: command.context.now,
          })
        }
        const issuingAllocation = command.command === 'retry_failed_issuance'
          ? commandBuildAllocationRecord({
              id: allocation.id,
              memberId: allocation.memberId,
              memberEmail: allocation.memberEmail,
              donorName: allocation.donorName,
              billingCadence: allocation.billingCadence,
              allocatedAmountMinor: allocation.allocatedAmountMinor,
              currency: allocation.currency,
              approvalState: 'approved',
              stripeCustomerId: allocation.stripeCustomerId,
              stripeCouponId: allocation.stripeCouponId,
              stripePromotionCodeId: allocation.stripePromotionCodeId,
              stripeSubscriptionId: allocation.stripeSubscriptionId,
              approvalReference,
              issuedBy: allocation.issuedBy,
              approvedBy: allocation.approvedBy,
              issuedAt: allocation.issuedAt ? new Date(allocation.issuedAt) : null,
              expiresAt: allocation.expiresAt ? new Date(allocation.expiresAt) : null,
              redeemedAt: allocation.redeemedAt ? new Date(allocation.redeemedAt) : null,
              revokedAt: allocation.revokedAt ? new Date(allocation.revokedAt) : null,
              reason: allocation.reason,
              notes: allocation.notes,
              metadata: allocation.metadata,
              now: command.context.now,
            })
          : allocation
        try {
          const supportRecord: MembershipSupportRecord = {
            id: commandDeriveStableId('support', [issuingAllocation.id, approvalReference]),
            fundingSource: 'pay_it_forward' as const,
            voucherDuration: targetDuration as MembershipVoucherDuration,
            issuanceState: 'approved' as const,
            intendedRecipientEmail: issuingAllocation.memberEmail,
            stripeCustomerId: issuingAllocation.stripeCustomerId,
            stripeCouponId: issuingAllocation.stripeCouponId,
            stripePromotionCodeId: issuingAllocation.stripePromotionCodeId,
            stripeSubscriptionId: issuingAllocation.stripeSubscriptionId,
            billingCadence: issuingAllocation.billingCadence,
            issuedBy: operator.operatorId,
            approvedBy: issuingAllocation.approvedBy,
            issuedAt: issuingAllocation.issuedAt ? new Date(issuingAllocation.issuedAt) : null,
            expiresAt: issuingAllocation.expiresAt ? new Date(issuingAllocation.expiresAt) : null,
            redeemedAt: issuingAllocation.redeemedAt ? new Date(issuingAllocation.redeemedAt) : null,
            deactivatedAt: issuingAllocation.revokedAt ? new Date(issuingAllocation.revokedAt) : null,
            reason: issuingAllocation.reason,
            approvalReference,
            reconciliationState: 'pending' as const,
            lastWebhookAt: command.context.now,
          }
          const issuance = await issueMembershipSupportVoucher({
            record: supportRecord,
            adapter: command.adapter,
            now: command.context.now,
          })
          const updatedProjection = buildMembershipSupportProjectionRecord({
            source: 'pay_it_forward',
            recordId: issuingAllocation.id,
            memberId: issuingAllocation.memberId,
            memberEmail: issuingAllocation.memberEmail,
            voucherDuration: targetDuration,
            billingCadence: issuingAllocation.billingCadence,
            stripeCustomerId: issuance.stripeCustomerId,
            stripeSubscriptionId: issuingAllocation.stripeSubscriptionId,
            couponId: issuance.couponId,
            promotionCodeId: issuance.promotionCodeId,
            approvalReference,
            operatorId: operator.operatorId,
            reason: issuingAllocation.reason,
            now: command.context.now,
            reconciliationState: issuance.reconciliationState,
          })
          const updatedAllocation = commandBuildAllocationRecord({
            id: issuingAllocation.id,
            memberId: issuingAllocation.memberId,
            memberEmail: issuingAllocation.memberEmail,
            donorName: issuingAllocation.donorName,
            billingCadence: issuingAllocation.billingCadence,
            allocatedAmountMinor: issuingAllocation.allocatedAmountMinor,
            currency: issuingAllocation.currency,
            approvalState: issuance.reconciliationState === 'mismatch' ? 'failed' : 'issued',
            stripeCustomerId: issuance.stripeCustomerId,
            stripeCouponId: issuance.coupon.id,
            stripePromotionCodeId: issuance.promotionCode.id,
            stripeSubscriptionId: issuingAllocation.stripeSubscriptionId,
            approvalReference,
            issuedBy: operator.operatorId,
            approvedBy: issuingAllocation.approvedBy ?? operator.operatorId,
            issuedAt: command.context.now,
            expiresAt: new Date(updatedProjection.expiresAt),
            redeemedAt: issuingAllocation.redeemedAt ? new Date(issuingAllocation.redeemedAt) : null,
            revokedAt: issuingAllocation.revokedAt ? new Date(issuingAllocation.revokedAt) : null,
            reason: issuingAllocation.reason,
            notes: issuingAllocation.notes,
            metadata: issuingAllocation.metadata,
            now: command.context.now,
          })
          this.deps.journal.upsertPayItForwardAllocation(updatedAllocation)
          this.deps.journal.upsertSupportProjection(updatedProjection)
          const auditEvent = this.deps.journal.appendAuditEvent(
            commandBuildAuditEvent({
              action: 'pay_it_forward_projection_issued',
              targetCollection: 'payload_membership_support_records',
              targetId: updatedProjection.id,
              actorId: operator.operatorId,
              actorType,
              approvalReference,
              before: allocation,
              after: updatedProjection,
              notes: `Pay-it-forward projection issued with reconciliation ${issuance.reconciliationState}.`,
              severity: issuance.reconciliationState === 'matched' ? 'info' : 'warning',
              metadata: {
                couponId: issuance.couponId,
                promotionCodeId: issuance.promotionCodeId,
                reconciliationReasons: issuance.reconciliationReasons,
              },
              now: command.context.now,
            }),
          )
          if (issuance.reconciliationState === 'mismatch') {
            const reviewQueueItem = this.deps.journal.enqueueReviewItem(
              commandBuildReviewQueueItem({
                action: 'pay_it_forward_projection_issued',
                targetId: updatedProjection.id,
                reason: 'webhook_mismatch',
                notes: `Pay-it-forward projection reconciled with mismatch: ${issuance.reconciliationReasons.join(',') || 'unknown'}.`,
                approvalReference,
                now: command.context.now,
                metadata: {
                  reconciliationReasons: issuance.reconciliationReasons,
                  couponId: issuance.couponId,
                  promotionCodeId: issuance.promotionCodeId,
                },
              }),
            )
            return commandBuildResult({
              ok: false,
              idempotencyResult: command.command === 'retry_failed_issuance' ? 'retried' : 'created',
              failureClassification: 'reconciliation_mismatch',
              updatedWorkflowProjection: updatedProjection,
              couponProjection: issuance.coupon,
              promotionCodeProjection: issuance.promotionCode,
              reconciliationResult: issuance.reconciliation,
              auditEvent,
              reviewQueueItem,
              updatedVoucher: null,
              updatedAllocation,
            })
          }
          return commandBuildResult({
            ok: true,
            idempotencyResult: command.command === 'retry_failed_issuance' ? 'retried' : 'created',
            failureClassification: null,
            updatedWorkflowProjection: updatedProjection,
            couponProjection: issuance.coupon,
            promotionCodeProjection: issuance.promotionCode,
            reconciliationResult: issuance.reconciliation,
            auditEvent,
            reviewQueueItem: null,
            updatedVoucher: null,
            updatedAllocation,
          })
        } catch (error) {
          const failedAllocation = commandBuildAllocationRecord({
            id: allocation.id,
            memberId: allocation.memberId,
            memberEmail: allocation.memberEmail,
            donorName: allocation.donorName,
            billingCadence: allocation.billingCadence,
            allocatedAmountMinor: allocation.allocatedAmountMinor,
            currency: allocation.currency,
            approvalState: 'failed',
            stripeCustomerId: allocation.stripeCustomerId,
            stripeCouponId: allocation.stripeCouponId,
            stripePromotionCodeId: allocation.stripePromotionCodeId,
            stripeSubscriptionId: allocation.stripeSubscriptionId,
            approvalReference,
            issuedBy: allocation.issuedBy,
            approvedBy: allocation.approvedBy,
            issuedAt: allocation.issuedAt ? new Date(allocation.issuedAt) : null,
            expiresAt: allocation.expiresAt ? new Date(allocation.expiresAt) : null,
            redeemedAt: allocation.redeemedAt ? new Date(allocation.redeemedAt) : null,
            revokedAt: allocation.revokedAt ? new Date(allocation.revokedAt) : null,
            reason: allocation.reason,
            notes: `${allocation.notes}${allocation.notes ? '\n' : ''}Issuance failed.`,
            metadata: {
              ...allocation.metadata,
              failure: error instanceof Error ? error.message : 'provider_failure',
            },
            now: command.context.now,
          })
          this.deps.journal.upsertPayItForwardAllocation(failedAllocation)
          const reviewQueueItem = this.deps.journal.enqueueReviewItem(
            commandBuildReviewQueueItem({
              action: 'pay_it_forward_projection_issued',
              targetId: failedAllocation.id,
              reason: 'manual_override',
              notes: error instanceof Error ? error.message : 'provider_failure',
              approvalReference,
              now: command.context.now,
              metadata: {
                failure: error instanceof Error ? error.message : 'provider_failure',
              },
            }),
          )
          const auditEvent = this.deps.journal.appendAuditEvent(
            commandBuildAuditEvent({
              action: 'pay_it_forward_projection_issued',
              targetCollection: 'payload_membership_review_queue_items',
              targetId: reviewQueueItem.id,
              actorId: operator.operatorId,
              actorType,
              approvalReference,
              before: allocation,
              after: reviewQueueItem,
              notes: error instanceof Error ? error.message : 'provider_failure',
              severity: 'warning',
              metadata: {
                failure: error instanceof Error ? error.message : 'provider_failure',
              },
              now: command.context.now,
            }),
          )
          return commandBuildResult({
            ok: false,
            idempotencyResult: command.command === 'retry_failed_issuance' ? 'retried' : 'created',
            failureClassification: 'provider_failure',
            updatedWorkflowProjection: null,
            couponProjection: null,
            promotionCodeProjection: null,
            reconciliationResult: null,
            auditEvent,
            reviewQueueItem,
            updatedVoucher: null,
            updatedAllocation: failedAllocation,
          })
        }
      }
      case 'revoke_unused_allocation': {
        if (!commandStateMatches(command.allocation, command.context.expectedCurrentState) || command.allocation.approvalState === 'revoked') {
          return commandFailure(this.deps.journal, {
            action: 'pay_it_forward_allocation_revoked',
            targetCollection: 'payload_pay_it_forward_funding',
            targetId: command.allocation.id,
            reason: 'illegal_transition',
            notes: 'Pay-it-forward allocation cannot be revoked from the current state.',
            context: command.context,
            before: command.allocation,
            now: command.context.now,
          })
        }
        const allocation = commandBuildAllocationRecord({
          id: command.allocation.id,
          memberId: command.allocation.memberId,
          memberEmail: command.allocation.memberEmail,
          donorName: command.allocation.donorName,
          billingCadence: command.allocation.billingCadence,
          allocatedAmountMinor: command.allocation.allocatedAmountMinor,
          currency: command.allocation.currency,
          approvalState: 'revoked',
          stripeCustomerId: command.allocation.stripeCustomerId,
          stripeCouponId: command.allocation.stripeCouponId,
          stripePromotionCodeId: command.allocation.stripePromotionCodeId,
          stripeSubscriptionId: command.allocation.stripeSubscriptionId,
          approvalReference: approvalReference ?? `revoke:${command.allocation.id}`,
          issuedBy: command.allocation.issuedBy,
          approvedBy: command.allocation.approvedBy,
          issuedAt: command.allocation.issuedAt ? new Date(command.allocation.issuedAt) : null,
          expiresAt: command.allocation.expiresAt ? new Date(command.allocation.expiresAt) : null,
          redeemedAt: command.allocation.redeemedAt ? new Date(command.allocation.redeemedAt) : null,
          revokedAt: command.context.now,
          reason: command.allocation.reason,
          notes: command.allocation.notes,
          metadata: command.allocation.metadata,
          now: command.context.now,
        })
        const auditEvent = this.deps.journal.appendAuditEvent(
          commandBuildAuditEvent({
            action: 'pay_it_forward_allocation_revoked',
            targetCollection: 'payload_pay_it_forward_funding',
            targetId: allocation.id,
            actorId: operator.operatorId,
            actorType,
            approvalReference: approvalReference ?? `revoke:${allocation.id}`,
            before: command.allocation,
            after: allocation,
            notes: 'Pay-it-forward allocation revoked by administrator.',
            now: command.context.now,
          }),
        )
        this.deps.journal.upsertPayItForwardAllocation(allocation)
        return commandBuildResult({
          ok: true,
          idempotencyResult: 'created',
          failureClassification: null,
          updatedWorkflowProjection: null,
          couponProjection: null,
          promotionCodeProjection: null,
          reconciliationResult: null,
          auditEvent,
          reviewQueueItem: null,
          updatedVoucher: null,
          updatedAllocation: allocation,
        })
      }
      case 'route_mismatch_to_review': {
        if (!commandStateMatches(command.projection, command.context.expectedCurrentState) || command.projection.reconciliationState !== 'mismatch') {
          return commandFailure(this.deps.journal, {
            action: 'pay_it_forward_projection_review_routed',
            targetCollection: 'payload_membership_review_queue_items',
            targetId: command.projection.id,
            reason: 'review_required',
            notes: 'Pay-it-forward projection can only be routed to review when the reconciliation state is mismatch.',
            context: command.context,
            before: command.projection,
            now: command.context.now,
          })
        }
        const reviewQueueItem = this.deps.journal.enqueueReviewItem(
          commandBuildReviewQueueItem({
            action: 'pay_it_forward_projection_review_routed',
            targetId: command.projection.id,
            reason: 'webhook_mismatch',
            notes: 'Pay-it-forward projection routed to review.',
            approvalReference: command.projection.approvalReference,
            now: command.context.now,
            metadata: {
              reconciliationState: command.projection.reconciliationState,
              stripeCustomerId: command.projection.stripeCustomerId,
            },
          }),
        )
        const auditEvent = this.deps.journal.appendAuditEvent(
          commandBuildAuditEvent({
            action: 'pay_it_forward_projection_review_routed',
            targetCollection: 'payload_membership_review_queue_items',
            targetId: reviewQueueItem.id,
            actorId: operator.operatorId,
            actorType,
            approvalReference: command.projection.approvalReference,
            before: command.projection,
            after: reviewQueueItem,
            notes: 'Pay-it-forward projection routed to manual review.',
            severity: 'warning',
            metadata: { reconciliationState: command.projection.reconciliationState },
            now: command.context.now,
          }),
        )
        return commandBuildResult({
          ok: true,
          idempotencyResult: 'created',
          failureClassification: null,
          updatedWorkflowProjection: command.projection,
          couponProjection: null,
          promotionCodeProjection: null,
          reconciliationResult: null,
          auditEvent,
          reviewQueueItem,
          updatedVoucher: null,
          updatedAllocation: null,
        })
      }
      case 'resolve_review': {
        if (!commandStateMatches(command.reviewQueueItem, command.context.expectedCurrentState) || (command.reviewQueueItem.queueState !== 'needs_review' && command.reviewQueueItem.queueState !== 'in_review')) {
          return commandFailure(this.deps.journal, {
            action: 'pay_it_forward_review_resolved',
            targetCollection: 'payload_membership_review_queue_items',
            targetId: command.reviewQueueItem.id,
            reason: 'illegal_transition',
            notes: 'Review can only be resolved from needs_review or in_review.',
            context: command.context,
            before: command.reviewQueueItem,
            now: command.context.now,
          })
        }
        const resolvedReviewQueueItem = commandFreeze({
          ...command.reviewQueueItem,
          queueState: 'closed' as const,
          resolvedAt: command.context.now.toISOString(),
          notes: `${command.reviewQueueItem.notes}${command.reviewQueueItem.notes ? '\n' : ''}Resolved by administrator.`,
          updatedAt: command.context.now.toISOString(),
          projection: {
            ...command.reviewQueueItem.projection,
            status: 'closed' as const,
            updatedAt: command.context.now.toISOString(),
            resolutionNote: `${command.reviewQueueItem.notes}${command.reviewQueueItem.notes ? '\n' : ''}Resolved by administrator.`,
            resolvedAt: command.context.now.toISOString(),
            assignedOperator: operator.operatorId,
          },
        })
        this.deps.journal.enqueueReviewItem(resolvedReviewQueueItem)
        const auditEvent = this.deps.journal.appendAuditEvent(
          commandBuildAuditEvent({
            action: 'pay_it_forward_review_resolved',
            targetCollection: 'payload_membership_review_queue_items',
            targetId: resolvedReviewQueueItem.id,
            actorId: operator.operatorId,
            actorType,
            approvalReference: command.reviewQueueItem.notes || command.context.approvalReference || `review:${command.reviewQueueItem.id}`,
            before: command.reviewQueueItem,
            after: resolvedReviewQueueItem,
            notes: 'Pay-it-forward review resolved by administrator.',
            now: command.context.now,
          }),
        )
        return commandBuildResult({
          ok: true,
          idempotencyResult: 'created',
          failureClassification: null,
          updatedWorkflowProjection: null,
          couponProjection: null,
          promotionCodeProjection: null,
          reconciliationResult: null,
          auditEvent,
          reviewQueueItem: resolvedReviewQueueItem,
          updatedVoucher: null,
          updatedAllocation: null,
        })
      }
    }
  }
}
