import type {
  StripeCustomerProjection,
  StripeSubscriptionProjection,
  MigrationCandidateInput,
  MigrationCadence,
} from '@/lib/billing/membershipMigrationPreview'

export type CandidateInventoryBuilder = {
  fromFixture: (fixture: unknown[]) => MigrationCandidateInput[]
  create: (params: {
    stableCandidateId: string
    memberId?: string | null
    normalizedEmail: string
    customerId?: string | null
    subscriptionId?: string | null
    itemId?: string | null
    currentPriceId?: string | null
    targetPriceId?: string | null
    currentCadence?: string | null
    targetCadence?: string | null
    currentPeriodStart?: Date | string | null
    currentPeriodEnd?: Date | string | null
    billingCycleAnchor?: string | null
    cancelAtPeriodEnd?: boolean
    status?: string | null
    paymentStatus?: string | null
    disputeStatus?: string | null
    scheduleState?: string | null
    itemCount?: number
    meteredState?: boolean
    activeDiscountAmount?: number | null
    taxBehavior?: string | null
    currentAmount?: number | null
    targetAmount?: number | null
  }) => MigrationCandidateInput
  asEligible: (input: MigrationCandidateInput) => MigrationCandidateInput
  asManualReview: (input: MigrationCandidateInput) => MigrationCandidateInput
  asIneligible: (input: MigrationCandidateInput) => MigrationCandidateInput
}

function normalizeDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function normalizeString(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function buildCustomerProjection(params: {
  customerId?: string | null
  memberId?: string | null
  normalizedEmail: string
}): StripeCustomerProjection {
  return {
    customerId: normalizeString(params.customerId ?? null) ?? null,
    memberId: normalizeString(params.memberId ?? null) ?? null,
    normalizedEmail: params.normalizedEmail,
  }
}

function buildSubscriptionProjection(params: {
  subscriptionId?: string | null
  itemId?: string | null
  currentPriceId?: string | null
  targetPriceId?: string | null
  currentCadence?: string | null
  targetCadence?: string | null
  currentPeriodStart?: Date | string | null
  currentPeriodEnd?: Date | string | null
  billingCycleAnchor?: string | null
  cancelAtPeriodEnd?: boolean
  status?: string | null
  paymentStatus?: string | null
  disputeStatus?: string | null
  scheduleState?: string | null
  itemCount?: number
  meteredState?: boolean
  activeDiscountAmount?: number | null
  taxBehavior?: string | null
  currentAmount?: number | null
  targetAmount?: number | null
}): StripeSubscriptionProjection {
  return {
    subscriptionId: normalizeString(params.subscriptionId ?? null) ?? null,
    itemId: normalizeString(params.itemId ?? null) ?? null,
    currentProductId: null,
    currentPriceId: normalizeString(params.currentPriceId ?? null) ?? null,
    targetProductId: null,
    targetPriceId: normalizeString(params.targetPriceId ?? null) ?? null,
    currentCadence: normalizeString(params.currentCadence ?? null) ?? null,
    targetCadence: normalizeString(params.targetCadence ?? null) ?? null,
    currentPeriodStart: normalizeDate(params.currentPeriodStart),
    currentPeriodEnd: normalizeDate(params.currentPeriodEnd),
    billingCycleAnchor: normalizeString(params.billingCycleAnchor ?? null) ?? null,
    cancelAtPeriodEnd: params.cancelAtPeriodEnd ?? false,
    status: normalizeString(params.status ?? null) ?? null,
    paymentStatus: normalizeString(params.paymentStatus ?? null) ?? null,
    disputeStatus: normalizeString(params.disputeStatus ?? null) ?? null,
    scheduleState: normalizeString(params.scheduleState ?? null) ?? null,
    itemCount: params.itemCount ?? 1,
    meteredState: params.meteredState ?? false,
    activeDiscountLabel: null,
    activeDiscountAmount: params.activeDiscountAmount ?? null,
    taxBehavior: normalizeString(params.taxBehavior ?? null) ?? null,
    currentAmount: params.currentAmount ?? null,
    targetAmount: params.targetAmount ?? null,
    reconciliationState: null,
  }
}

export const candidateInventory: CandidateInventoryBuilder = {
  fromFixture(fixture: unknown[]): MigrationCandidateInput[] {
    return fixture.map((item) => {
      const record = item as {
        normalizedEmail?: string
        stripeCustomerId?: string | null
        stripeSubscriptionId?: string
        stripePriceId?: string
        subscriptionStatus?: string
        subscriptionCurrentPeriodEnd?: string
        subscriptionCancelAtPeriodEnd?: boolean
        billingCadence?: string
        paymentStatus?: string
        paymentDisputeStatus?: string | null
      }

      const email = normalizeString(record.normalizedEmail ?? '')
      if (!email) throw new Error('fixture_missing_email')

      return {
        stableCandidateId: `fixture_${email.split('@')[0]}`,
        memberId: null,
        normalizedEmail: email,
        stripeCustomerProjection: buildCustomerProjection({
          customerId: record.stripeCustomerId ?? null,
          memberId: null,
          normalizedEmail: email,
        }),
        stripeSubscriptionProjection: buildSubscriptionProjection({
          subscriptionId: record.stripeSubscriptionId ?? null,
          itemId: null,
          currentPriceId: record.stripePriceId ?? null,
          targetPriceId: null,
          currentCadence: record.billingCadence ?? null,
          targetCadence: null,
          currentPeriodEnd: record.subscriptionCurrentPeriodEnd ?? null,
          cancelAtPeriodEnd: record.subscriptionCancelAtPeriodEnd ?? false,
          status: record.subscriptionStatus ?? null,
          paymentStatus: record.paymentStatus ?? null,
          disputeStatus: record.paymentDisputeStatus ?? null,
        }),
        preview: null,
      }
    })
  },

  create(params): MigrationCandidateInput {
    return {
      stableCandidateId: params.stableCandidateId,
      memberId: params.memberId ?? null,
      normalizedEmail: params.normalizedEmail,
      stripeCustomerProjection: buildCustomerProjection({
        customerId: params.customerId,
        memberId: params.memberId,
        normalizedEmail: params.normalizedEmail,
      }),
      stripeSubscriptionProjection: buildSubscriptionProjection({
        subscriptionId: params.subscriptionId,
        itemId: params.itemId,
        currentPriceId: params.currentPriceId,
        targetPriceId: params.targetPriceId,
        currentCadence: params.currentCadence,
        targetCadence: params.targetCadence,
        currentPeriodStart: params.currentPeriodStart,
        currentPeriodEnd: params.currentPeriodEnd,
        billingCycleAnchor: params.billingCycleAnchor,
        cancelAtPeriodEnd: params.cancelAtPeriodEnd,
        status: params.status,
        paymentStatus: params.paymentStatus,
        disputeStatus: params.disputeStatus,
        scheduleState: params.scheduleState,
        itemCount: params.itemCount,
        meteredState: params.meteredState,
        activeDiscountAmount: params.activeDiscountAmount,
        taxBehavior: params.taxBehavior,
        currentAmount: params.currentAmount,
        targetAmount: params.targetAmount,
      }),
      preview: null,
    }
  },

  asEligible(input: MigrationCandidateInput): MigrationCandidateInput {
    return {
      ...input,
      stripeCustomerProjection: {
        ...input.stripeCustomerProjection,
        customerId: input.stripeCustomerProjection.customerId ?? 'cus_test_eligible',
      },
      stripeSubscriptionProjection: {
        ...input.stripeSubscriptionProjection,
        subscriptionId: input.stripeSubscriptionProjection.subscriptionId ?? 'sub_test_eligible',
        itemId: input.stripeSubscriptionProjection.itemId ?? 'si_test_eligible',
        currentPriceId: input.stripeSubscriptionProjection.currentPriceId ?? 'price_test_current',
        targetPriceId: input.stripeSubscriptionProjection.targetPriceId ?? 'price_test_target',
        currentCadence: input.stripeSubscriptionProjection.currentCadence ?? 'monthly',
        targetCadence: input.stripeSubscriptionProjection.targetCadence ?? 'annual',
        status: input.stripeSubscriptionProjection.status ?? 'active',
        paymentStatus: input.stripeSubscriptionProjection.paymentStatus ?? 'paid',
        itemCount: input.stripeSubscriptionProjection.itemCount ?? 1,
      },
    }
  },

  asManualReview(input: MigrationCandidateInput): MigrationCandidateInput {
    return {
      ...input,
      stripeCustomerProjection: {
        ...input.stripeCustomerProjection,
        customerId: input.stripeCustomerProjection.customerId ?? 'cus_test_review',
      },
      stripeSubscriptionProjection: {
        ...input.stripeSubscriptionProjection,
        subscriptionId: input.stripeSubscriptionProjection.subscriptionId ?? 'sub_test_review',
        status: input.stripeSubscriptionProjection.status ?? 'past_due',
        paymentStatus: input.stripeSubscriptionProjection.paymentStatus ?? 'failed',
      },
    }
  },

  asIneligible(input: MigrationCandidateInput): MigrationCandidateInput {
    return {
      ...input,
      stripeCustomerProjection: {
        ...input.stripeCustomerProjection,
        customerId: null,
      },
      stripeSubscriptionProjection: {
        ...input.stripeSubscriptionProjection,
        subscriptionId: input.stripeSubscriptionProjection.subscriptionId ?? 'sub_test_ineligible',
      },
    }
  },
}
