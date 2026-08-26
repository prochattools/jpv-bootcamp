import config from '@payload-config'
import { getPayload } from 'payload'

import prisma from '@/libs/prisma'
import { getMembershipReadModel } from '@/lib/billing/membershipReadModel'

type CountPayload = {
  count(args: {
    collection: string
    overrideAccess?: boolean
    where?: Record<string, unknown>
  }): Promise<{ totalDocs: number }>
}

async function safeCount(
  payload: CountPayload,
  collection: string,
  where?: Record<string, unknown>,
): Promise<number | null> {
  try {
    const result = await payload.count({ collection, where, overrideAccess: true })
    return result.totalDocs
  } catch {
    return null
  }
}

async function safeOpenSupportCount(): Promise<number | null> {
  try {
    return await prisma.supportRequest.count({
      where: { reviewStatus: { in: ['pending', 'in_review'] } },
    })
  } catch {
    return null
  }
}

async function safeSponsoredSeatCount(): Promise<number | null> {
  try {
    return await prisma.sponsoredSeat.count({ where: { tier: 'free' } })
  } catch {
    return null
  }
}

async function safeSponsoredApplicationCount(): Promise<number | null> {
  try {
    return await prisma.sponsoredApplication.count({ where: { status: 'pending' } })
  } catch {
    return null
  }
}

function formatCount(value: number | null): string {
  return value === null ? 'Unavailable' : String(value)
}

type KpiState = 'healthy' | 'attention' | 'unavailable'

function kpiState(value: number | null, actionable = false): KpiState {
  if (value === null) return 'unavailable'
  return actionable && value > 0 ? 'attention' : 'healthy'
}

export async function JPVAdminDashboard() {
  const payload = await getPayload({ config }) as unknown as CountPayload & Parameters<typeof getMembershipReadModel>[0]
  const membership = await getMembershipReadModel(payload).catch((_error): null => null)
  const activeMembers = membership?.members.active ?? null
  const pendingMembers = membership?.members.pending ?? null
  const activeSubscriptions = membership?.subscriptions.activeRecords ?? null
  const subscribedMembers = membership?.subscriptions.subscribedMembers ?? null
  const administrators = membership?.administrators.total ?? null
  const unlinkedAdministrators = membership?.administrators.unlinked ?? null
  const identityReviewItems = membership?.reviewQueue ?? null
  const [
    billingIssues,
    voucherReviewItems,
    payItForwardItems,
    pendingPartnerApplications,
    pendingAffiliateCommissions,
    communityModeration,
    openSupportRequests,
    fundedSponsoredSeats,
    availableSponsoredSeats,
    pendingSponsoredApplications,
  ] = await Promise.all([
    safeCount(payload, 'payload_payments', { status: { in: ['failed', 'action_required', 'disputed'] } }),
    safeCount(payload, 'payload_membership_vouchers', { approvalState: { in: ['draft', 'pending_approval'] } }),
    safeCount(payload, 'payload_pay_it_forward_funding', { approvalState: { in: ['draft', 'pending_approval'] } }),
    safeCount(payload, 'payload_partner_applications', { status: { in: ['submitted', 'delivery_pending', 'delivery_failed'] } }),
    safeCount(payload, 'payload_affiliate_commissions', { status: { equals: 'pending' } }),
    safeCount(payload, 'payload_space_posts', { moderationStatus: { equals: 'pending_review' } }),
    safeOpenSupportCount(),
    safeSponsoredSeatCount(),
    prisma.sponsoredSeat.count({
      where: { tier: 'free', claimedByAccountId: null, reservedByApplicationId: null },
    }).catch((): null => null),
    safeSponsoredApplicationCount(),
  ])

  const kpis = [
    {
      label: 'Subscribed members',
      value: formatCount(subscribedMembers),
      state: kpiState(subscribedMembers),
    },
    {
      label: 'Active member accounts',
      value: formatCount(activeMembers),
      state: kpiState(activeMembers),
    },
    {
      label: 'Administrators',
      value: formatCount(administrators),
      state: kpiState(administrators),
    },
    {
      label: 'Pending members',
      value: formatCount(pendingMembers),
      state: kpiState(pendingMembers, true),
    },
    {
      label: 'Active subscriptions',
      value: formatCount(activeSubscriptions),
      state: kpiState(activeSubscriptions),
    },
    {
      label: 'Pay-it-forward seats funded',
      value: formatCount(fundedSponsoredSeats),
      state: kpiState(fundedSponsoredSeats),
    },
    {
      label: 'Billing issues',
      value: formatCount(billingIssues),
      state: kpiState(billingIssues, true),
    },
    {
      label: 'Community moderation',
      value: formatCount(communityModeration),
      state: kpiState(communityModeration, true),
    },
  ]

  type AttentionItem = { label: string; count: number | null; href: string }
  const allAttentionItems: AttentionItem[] = [
    {
      label: 'Administrators to link',
      count: unlinkedAdministrators,
      href: '/admin/collections/payload_users',
    },
    {
      label: 'Stripe identities to review',
      count: identityReviewItems,
      href: '/admin/collections/payload_membership_review_queue_items?where[queueState][equals]=needs_review',
    },
    {
      label: 'Pending members',
      count: pendingMembers,
      href: '/admin/collections/payload_members?where[accountStatus][equals]=pending',
    },
    {
      label: 'Billing issues',
      count: billingIssues,
      href: '/admin/collections/payload_payments?where[or][0][status][equals]=failed&where[or][1][status][equals]=action_required&where[or][2][status][equals]=disputed',
    },
    {
      label: 'Voucher approvals',
      count: voucherReviewItems,
      href: '/admin/collections/payload_membership_vouchers?where[or][0][approvalState][equals]=draft&where[or][1][approvalState][equals]=pending_approval',
    },
    {
      label: 'Sponsored applications to review',
      count: pendingSponsoredApplications,
      href: '/admin/collections/payload_pay_it_forward_funding',
    },
    {
      label: 'Partner applications to review',
      count: pendingPartnerApplications,
      href: '/admin/collections/payload_partner_applications?where[or][0][status][equals]=submitted&where[or][1][status][equals]=delivery_pending&where[or][2][status][equals]=delivery_failed',
    },
    {
      label: 'Affiliate commissions to review',
      count: pendingAffiliateCommissions,
      href: '/admin/collections/payload_affiliate_commissions?where[status][equals]=pending',
    },
    {
      label: 'Community posts to review',
      count: communityModeration,
      href: '/admin/collections/payload_space_posts?where[moderationStatus][equals]=pending_review',
    },
    {
      label: 'Support requests to review',
      count: openSupportRequests,
      href: '/operations/support-requests',
    },
  ]
  const attentionItems = allAttentionItems.filter(
    (item): item is AttentionItem & { count: number } => item.count !== null && item.count > 0,
  )
  const unavailableCount = [
    activeMembers,
    pendingMembers,
    activeSubscriptions,
    unlinkedAdministrators,
    identityReviewItems,
    billingIssues,
    voucherReviewItems,
    payItForwardItems,
    fundedSponsoredSeats,
    availableSponsoredSeats,
    pendingSponsoredApplications,
    pendingPartnerApplications,
    pendingAffiliateCommissions,
    communityModeration,
    openSupportRequests,
  ].filter((value) => value === null).length
  const allClear = attentionItems.length === 0

  const quickActions = [
    { label: 'Members', href: '/admin/collections/payload_members' },
    { label: 'Billing', href: '/admin/collections/payload_billing_accounts' },
    { label: 'Support', href: '/operations/support-requests' },
    { label: 'Partner applications', href: '/admin/collections/payload_partner_applications' },
    { label: 'Courses', href: '/admin/collections/payload_courses' },
  ]

  return (
    <main
      style={{
        display: 'grid',
        gap: 24,
        marginInline: 'auto',
        maxWidth: 1360,
        padding: 'clamp(1.25rem, 3vw, 2.5rem)',
        width: '100%',
      }}
    >
      {/* Hero */}
      <section
        style={{
          background: 'var(--jpv-canvas)',
          border: '1px solid var(--jpv-border)',
          borderRadius: 'var(--jpv-radius-panel)',
          boxShadow: 'var(--jpv-shadow)',
          padding: 'clamp(1.25rem, 3vw, 2rem)',
        }}
      >
        <p
          style={{
            color: 'var(--jpv-ink)',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.14em',
            margin: 0,
            textTransform: 'uppercase',
          }}
        >
          JPV Bootcamp
        </p>
        <h1
          style={{
            color: 'var(--jpv-ink)',
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: '-0.01em',
            lineHeight: 1.2,
            margin: '6px 0 0',
          }}
        >
          Operations
        </h1>
      </section>

      {/* KPIs */}
      <section>
        <p
          style={{
            color: 'var(--jpv-ink)',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.14em',
            margin: '0 0 12px',
            textTransform: 'uppercase',
          }}
        >
          At a glance
        </p>
        <div
          style={{
            display: 'grid',
            gap: 12,
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))',
          }}
        >
          {kpis.map((kpi) => (
            <div
              key={kpi.label}
              style={{
                background:
                  kpi.state === 'attention'
                    ? 'color-mix(in srgb, var(--jpv-sunshine) 10%, var(--jpv-canvas))'
                    : kpi.state === 'unavailable'
                      ? 'var(--jpv-surface)'
                      : 'var(--jpv-canvas)',
                border: `1px solid ${
                  kpi.state === 'attention'
                    ? 'color-mix(in srgb, var(--jpv-sunshine) 40%, var(--jpv-border))'
                    : 'var(--jpv-border)'
                }`,
                borderRadius: 'var(--jpv-radius-card)',
                boxShadow: 'var(--jpv-shadow)',
                padding: 16,
              }}
            >
              <p
                style={{
                  color: 'color-mix(in srgb, var(--jpv-muted) 68%, var(--jpv-ink))',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  lineHeight: 1.45,
                  margin: 0,
                  minHeight: '2.9em',
                  textTransform: 'uppercase',
                }}
              >
                {kpi.label}
              </p>
              <p
                style={{
                  color: 'var(--jpv-ink)',
                  fontFeatureSettings: '"tnum"',
                  fontSize: 'clamp(1.5rem, 2.2vw, 1.875rem)',
                  fontWeight: 800,
                  lineHeight: 1.15,
                  margin: '8px 0 0',
                  overflowWrap: 'anywhere',
                }}
              >
                {kpi.value}
              </p>
            </div>
          ))}
        </div>
      </section>

      {unavailableCount > 0 ? (
        <p
          role='status'
          style={{
            background: 'var(--jpv-surface)',
            border: '1px solid var(--jpv-border)',
            borderRadius: 'var(--jpv-radius-card)',
            color: 'var(--jpv-muted)',
            fontSize: 13,
            margin: 0,
            padding: '12px 16px',
          }}
        >
          Some overview data is temporarily unavailable. Open the relevant section to review current records.
        </p>
      ) : null}

      {/* Needs attention */}
      <section>
        <p
          style={{
            color: 'var(--jpv-ink)',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.14em',
            margin: '0 0 12px',
            textTransform: 'uppercase',
          }}
        >
          Needs attention
        </p>
        <div
          style={{
            background: 'var(--jpv-canvas)',
            border: '1px solid var(--jpv-border)',
            borderRadius: 'var(--jpv-radius-panel)',
            boxShadow: 'var(--jpv-shadow)',
          }}
        >
          {allClear ? (
            <div
              style={{
                alignItems: 'center',
                display: 'flex',
                gap: 10,
                padding: '14px 20px',
              }}
            >
              <span style={{ color: 'var(--jpv-brand-deep)', fontSize: 16, lineHeight: 1 }}>✓</span>
              <span style={{ color: 'var(--jpv-muted)', fontSize: 13 }}>
                All clear — nothing requires immediate attention.
              </span>
            </div>
          ) : (
            attentionItems.map((item, i) => (
              <div
                key={item.label}
                style={{
                  alignItems: 'center',
                  borderTop: i > 0 ? '1px solid var(--jpv-border)' : undefined,
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '12px 20px',
                }}
              >
                <span
                  style={{ color: 'var(--jpv-ink)', fontSize: 13, fontWeight: 500 }}
                >
                  {item.label}
                </span>
                <a
                  href={item.href}
                  style={{
                    alignItems: 'center',
                    color: 'var(--jpv-brand-deep)',
                    display: 'inline-flex',
                    fontSize: 12,
                    fontWeight: 700,
                    gap: 6,
                    minHeight: 44,
                    textDecoration: 'none',
                  }}
                >
                  <span
                    style={{
                      background: 'color-mix(in srgb, var(--jpv-sunshine) 20%, var(--jpv-canvas))',
                      border: '1px solid color-mix(in srgb, var(--jpv-sunshine) 40%, var(--jpv-border))',
                      borderRadius: 9999,
                      color: 'var(--jpv-sunshine-ink)',
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '1px 8px',
                    }}
                  >
                    {item.count}
                  </span>
                  <span style={{ fontSize: 14 }}>→</span>
                </a>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Quick actions */}
      <section>
        <p
          style={{
            color: 'var(--jpv-ink)',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.14em',
            margin: '0 0 12px',
            textTransform: 'uppercase',
          }}
        >
          Quick actions
        </p>
        <div
          style={{
            background: 'var(--jpv-canvas)',
            border: '1px solid var(--jpv-border)',
            borderRadius: 'var(--jpv-radius-panel)',
            boxShadow: 'var(--jpv-shadow)',
            display: 'grid',
            gap: 10,
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
            padding: 16,
          }}
        >
          {quickActions.map((action) => (
            <a
              key={action.label}
              href={action.href}
              style={{
                alignItems: 'center',
                background: 'var(--jpv-surface)',
                border: '1px solid var(--jpv-border)',
                borderRadius: 'var(--jpv-radius-action)',
                color: 'var(--jpv-brand-deep)',
                display: 'inline-flex',
                fontSize: 13,
                fontWeight: 700,
                justifyContent: 'space-between',
                minHeight: 44,
                padding: '0.75rem 0.875rem',
                textDecoration: 'none',
              }}
            >
              {action.label} →
            </a>
          ))}
        </div>
      </section>
    </main>
  )
}
