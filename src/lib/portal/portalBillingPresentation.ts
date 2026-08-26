import type { BillingStatus } from '@/lib/billing/billingStatusHelper'
import type { MemberBillingOverview } from '@/lib/payloadCourse/memberPortal'

export type PortalBillingProjectionSyncState = 'status_missing' | 'projection_missing' | null

export type PortalBillingPresentation = {
  displayPlanLabel: string | null
  displaySubscriptionStatus: string | null
  displayPeriodEndDate: Date | null
  overviewPlanLabel: string
  overviewSubscriptionStatus: string | null
  overviewPeriodEndDate: Date | null
  billingCadenceLabel: string | null
  commitmentStatusLabel: string | null
  allowCheckout: boolean
  projectionSyncState: PortalBillingProjectionSyncState
  hasProjectionData: boolean
}

function titleCase(value: string | null | undefined): string | null {
  if (!value) return null
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ')
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function billingCadenceLabel(value: string | null): string | null {
  switch (value) {
    case 'monthly_commitment':
      return 'Monthly'
    case 'annual':
      return 'Annual'
    case 'monthly':
      return 'Monthly'
    default:
      return titleCase(value)
  }
}

function commitmentStatusLabel(value: string | null): string | null {
  switch (value) {
    case 'cancellation_requested':
      return 'Cancellation requested'
    case 'pending':
      return 'Pending'
    case 'active':
      return 'Active'
    case 'completed':
      return 'Completed'
    case 'terminated':
      return 'Terminated'
    default:
      return titleCase(value)
  }
}

export function resolvePortalBillingPresentation(
  billingStatus: BillingStatus,
  overview: MemberBillingOverview,
): PortalBillingPresentation {
  const hasProjectionData = Boolean(overview.billingAccount || overview.subscription)

  const overviewPlanLabel =
    overview.hasPaidSubscription && overview.plan != null
      ? 'JPV Bootcamp Membership'
      : 'No active membership'

  const projectionSyncState =
    !billingStatus.hasBillingAccount && (overview.billingAccount || overview.hasPaidSubscription)
      ? 'status_missing'
      : billingStatus.hasBillingAccount && !hasProjectionData
        ? 'projection_missing'
        : null

  return {
    displayPlanLabel:
      billingStatus.planLabel ??
      (overview.hasPaidSubscription ? overviewPlanLabel : null),
    displaySubscriptionStatus:
      billingStatus.subscriptionStatus ?? overview.subscriptionStatus,
    displayPeriodEndDate:
      billingStatus.periodEndDate ?? parseDate(overview.currentPeriodEnd),
    overviewPlanLabel,
    overviewSubscriptionStatus: overview.subscriptionStatus,
    overviewPeriodEndDate: parseDate(overview.currentPeriodEnd),
    billingCadenceLabel: billingCadenceLabel(billingStatus.billingCadence),
    commitmentStatusLabel: commitmentStatusLabel(billingStatus.commitmentStatus),
    allowCheckout: !billingStatus.hasActiveSubscription && !overview.hasPaidSubscription,
    projectionSyncState,
    hasProjectionData,
  }
}
