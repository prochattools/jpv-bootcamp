import type {
  PayloadCourseAccessAPI,
  PayloadDocument,
  PayloadId,
} from '@/lib/payloadCourse/accessService'
import { relationshipId } from '@/lib/domain/relationships'

export type AffiliateSummary = {
  referralCount: number
  pendingCommissionTotalMinor: number
  approvedCommissionTotalMinor: number
  currency: string | null
}

const affiliateSummaryDeniedMessage = 'Affiliate summary was not found.'

function asString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number') return String(value)
  return null
}

function deny(): never {
  throw new Error(affiliateSummaryDeniedMessage)
}

async function findMember(
  payload: PayloadCourseAccessAPI,
  memberId: string
): Promise<PayloadDocument> {
  try {
    const member = await payload.findByID({
      collection: 'payload_members',
      id: memberId,
      depth: 0,
      overrideAccess: true,
    })
    if (!member || member.accountStatus !== 'active') deny()
    return member
  } catch {
    return deny()
  }
}

async function findOwnedActiveAffiliate(
  payload: PayloadCourseAccessAPI,
  memberId: string
): Promise<PayloadDocument> {
  const result = await payload.find({
    collection: 'payload_affiliates',
    where: {
      and: [
        { member: { equals: memberId } },
        { status: { equals: 'active' } },
      ],
    },
    limit: 2,
    depth: 0,
    overrideAccess: true,
  })

  if (result.docs.length !== 1) deny()
  const affiliate = result.docs[0] as PayloadDocument
  if (relationshipId(affiliate.member) !== memberId || affiliate.status !== 'active') deny()
  return affiliate
}

function normalizeCommissionAmount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) deny()
  return value
}

function normalizeCurrency(value: unknown): string {
  if (typeof value !== 'string') deny()
  const currency = value.trim().toUpperCase()
  if (!/^[A-Z]{3}$/.test(currency)) deny()
  return currency
}

export async function getAffiliateSummary(
  payload: PayloadCourseAccessAPI,
  memberIdInput: PayloadId
): Promise<AffiliateSummary> {
  const memberId = asString(memberIdInput)
  if (!memberId) deny()

  await findMember(payload, memberId)
  const affiliate = await findOwnedActiveAffiliate(payload, memberId)
  const affiliateId = String(affiliate.id)

  const [referralResult, commissionResult] = await Promise.all([
    payload.find({
      collection: 'payload_affiliate_referrals',
      where: { affiliate: { equals: affiliateId } },
      limit: 1000,
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'payload_affiliate_commissions',
      where: { affiliate: { equals: affiliateId } },
      limit: 1000,
      depth: 0,
      overrideAccess: true,
    }),
  ])

  const referralCount = referralResult.docs.filter((referral) => {
    if (relationshipId(referral.affiliate) !== affiliateId) deny()
    return (
      referral.status === 'tracked' ||
      referral.status === 'converted' ||
      referral.status === 'rejected'
    )
  }).length

  let pendingCommissionTotalMinor = 0
  let approvedCommissionTotalMinor = 0
  let currency: string | null = null

  for (const commission of commissionResult.docs) {
    if (relationshipId(commission.affiliate) !== affiliateId) deny()
    if (commission.status === 'void') continue
    if (commission.status !== 'pending' && commission.status !== 'approved') continue

    const amountMinor = normalizeCommissionAmount(commission.amountMinor)
    const commissionCurrency = normalizeCurrency(commission.currency)
    if (currency && currency !== commissionCurrency) deny()
    currency = commissionCurrency

    if (commission.status === 'pending') {
      pendingCommissionTotalMinor += amountMinor
    } else {
      approvedCommissionTotalMinor += amountMinor
    }
  }

  return {
    referralCount,
    pendingCommissionTotalMinor,
    approvedCommissionTotalMinor,
    currency,
  }
}
