import type { StripeInvoicePreviewRequest } from '@/lib/billing/membershipMigrationPreview'
import type { StripeCouponCreateRequest, StripePromotionCodeCreateRequest } from '@/lib/membership-support/stripeRequests'

export type MembershipSupportStripeCoupon = { id: string; active: boolean; request: StripeCouponCreateRequest }
export type MembershipSupportStripePromotionCode = { id: string; active: boolean; request: StripePromotionCodeCreateRequest }
export type MembershipSupportStripeSubscription = { id: string; customerId: string; priceId: string; status: string }
export type MembershipSupportStripeReconciliation = {
  customerId: string
  subscriptionId: string | null
  promotionCodeId: string | null
  matched: boolean
  reasons: string[]
}

export interface MembershipSupportStripeAdapter {
  createOrReuseCoupon(request: StripeCouponCreateRequest, idempotencyKey: string): Promise<MembershipSupportStripeCoupon>
  createPromotionCode(request: StripePromotionCodeCreateRequest, idempotencyKey: string): Promise<MembershipSupportStripePromotionCode>
  deactivatePromotionCode(id: string, idempotencyKey: string): Promise<MembershipSupportStripePromotionCode>
  retrieveSubscription(id: string): Promise<MembershipSupportStripeSubscription | null>
  previewInvoice(request: StripeInvoicePreviewRequest): Promise<{ amountDue: number; currency: string; lines: number }>
  reconcile(params: { customerId: string; subscriptionId: string | null; promotionCodeId: string | null }): Promise<MembershipSupportStripeReconciliation>
}

export class InMemoryMembershipSupportStripeAdapter implements MembershipSupportStripeAdapter {
  private coupons = new Map<string, MembershipSupportStripeCoupon>()
  private promotionCodes = new Map<string, MembershipSupportStripePromotionCode>()
  private subscriptions = new Map<string, MembershipSupportStripeSubscription>()
  private responses = new Map<string, unknown>()

  seedSubscription(subscription: MembershipSupportStripeSubscription): void {
    this.subscriptions.set(subscription.id, subscription)
  }

  async createOrReuseCoupon(request: StripeCouponCreateRequest, idempotencyKey: string): Promise<MembershipSupportStripeCoupon> {
    const cached = this.responses.get(idempotencyKey) as MembershipSupportStripeCoupon | undefined
    if (cached) return cached
    const stableKey = `${request.metadata.fundingSource}:${request.metadata.voucherDuration}`
    const existing = this.coupons.get(stableKey)
    if (existing) {
      this.responses.set(idempotencyKey, existing)
      return existing
    }
    const created = { id: `coupon_${this.coupons.size + 1}`, active: true, request }
    this.coupons.set(stableKey, created)
    this.responses.set(idempotencyKey, created)
    return created
  }

  async createPromotionCode(request: StripePromotionCodeCreateRequest, idempotencyKey: string): Promise<MembershipSupportStripePromotionCode> {
    const cached = this.responses.get(idempotencyKey) as MembershipSupportStripePromotionCode | undefined
    if (cached) return cached
    const created = { id: `promo_${this.promotionCodes.size + 1}`, active: true, request }
    this.promotionCodes.set(created.id, created)
    this.responses.set(idempotencyKey, created)
    return created
  }

  async deactivatePromotionCode(id: string, idempotencyKey: string): Promise<MembershipSupportStripePromotionCode> {
    const cached = this.responses.get(idempotencyKey) as MembershipSupportStripePromotionCode | undefined
    if (cached) return cached
    const existing = this.promotionCodes.get(id)
    if (!existing) throw new Error('promotion_code_not_found')
    const updated = { ...existing, active: false }
    this.promotionCodes.set(id, updated)
    this.responses.set(idempotencyKey, updated)
    return updated
  }

  async retrieveSubscription(id: string): Promise<MembershipSupportStripeSubscription | null> {
    return this.subscriptions.get(id) ?? null
  }

  async previewInvoice(request: StripeInvoicePreviewRequest): Promise<{ amountDue: number; currency: string; lines: number }> {
    return { amountDue: request.subscription_details.items.length * 1000, currency: 'gbp', lines: request.subscription_details.items.length }
  }

  async reconcile(params: { customerId: string; subscriptionId: string | null; promotionCodeId: string | null }): Promise<MembershipSupportStripeReconciliation> {
    const reasons: string[] = []
    const subscription = params.subscriptionId ? this.subscriptions.get(params.subscriptionId) : null
    const promotion = params.promotionCodeId ? this.promotionCodes.get(params.promotionCodeId) : null
    if (!subscription) reasons.push('subscription_missing')
    else if (subscription.customerId !== params.customerId) reasons.push('subscription_customer_mismatch')
    if (!promotion) reasons.push('promotion_code_missing')
    return { ...params, matched: reasons.length === 0, reasons }
  }
}
