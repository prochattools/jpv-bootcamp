import config from '@payload-config'
import { getPayload } from 'payload'

import {
  membershipSupportCockpitActionLabels,
  membershipSupportCockpitFields,
  membershipSupportCockpitStatusLabels,
  membershipSupportCockpitViews,
} from '@/lib/membership-support/cockpit'

type CountPayload = {
  count(args: {
    collection: string
    overrideAccess?: boolean
    where?: Record<string, unknown>
  }): Promise<{ totalDocs: number }>
}

type HealthCard = {
  label: string
  value: string
  detail: string
  href?: string
  warning?: boolean
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

function formatCount(value: number | null): string {
  return value === null ? 'Check' : String(value)
}

function warning(value: number | null): boolean {
  return value === null
}

export async function JPVAdminDashboard() {
  const payload = await getPayload({ config }) as unknown as CountPayload
  const [
    activeMembers,
    pendingMembers,
    activeSubscriptions,
    billingIssues,
    membershipSupportRecords,
    voucherReviewItems,
    payItForwardItems,
    reconciliationIssues,
    securityEvents,
    pendingPartnerApplications,
    pendingAffiliateCommissions,
    communityModeration,
  ] = await Promise.all([
    safeCount(payload, 'payload_members', { accountStatus: { equals: 'active' } }),
    safeCount(payload, 'payload_members', { accountStatus: { equals: 'pending' } }),
    safeCount(payload, 'payload_subscriptions', { status: { equals: 'active' } }),
    safeCount(payload, 'payload_payments', { status: { in: ['failed', 'refunded', 'disputed'] } }),
    safeCount(payload, 'payload_membership_support_records'),
    safeCount(payload, 'payload_membership_vouchers', { approvalState: { in: ['draft', 'pending_approval'] } }),
    safeCount(payload, 'payload_pay_it_forward_funding', { approvalState: { in: ['draft', 'pending_approval'] } }),
    safeCount(payload, 'payload_membership_reconciliations', { reconciliationState: { in: ['mismatch', 'failed'] } }),
    safeCount(payload, 'payload_member_security_events'),
    safeCount(payload, 'payload_partner_applications', { status: { in: ['submitted', 'delivery_pending', 'delivery_failed'] } }),
    safeCount(payload, 'payload_affiliate_commissions', { status: { equals: 'pending' } }),
    safeCount(payload, 'payload_space_posts', { moderationStatus: { in: ['pending_review', 'hidden'] } }),
  ])

  const cards: HealthCard[] = [
    {
      label: 'Active members',
      value: formatCount(activeMembers),
      detail: 'Verified member accounts currently able to use the portal.',
      href: '/admin/collections/payload_members',
      warning: warning(activeMembers),
    },
    {
      label: 'Pending / unverified members',
      value: formatCount(pendingMembers),
      detail: 'Members needing verification, setup, or support follow-up.',
      href: '/admin/collections/payload_members',
      warning: warning(pendingMembers),
    },
    {
      label: 'Active subscriptions',
      value: formatCount(activeSubscriptions),
      detail: 'Current paid access projections from billing.',
      href: '/admin/collections/payload_subscriptions',
      warning: warning(activeSubscriptions),
    },
    {
      label: 'Recent billing / webhook issues',
      value: formatCount(billingIssues),
      detail: 'Failed, refunded, or disputed payment projections to review.',
      href: '/admin/collections/payload_payments',
      warning: warning(billingIssues),
    },
    {
      label: 'Membership support records',
      value: formatCount(membershipSupportRecords),
      detail: 'Unified voucher, funding, and reconciliation records.',
      href: '/admin/collections/payload_membership_support_records',
      warning: warning(membershipSupportRecords),
    },
    {
      label: 'Voucher approvals',
      value: formatCount(voucherReviewItems),
      detail: 'Voucher records waiting for approval or issuance.',
      href: '/admin/collections/payload_membership_vouchers',
      warning: warning(voucherReviewItems),
    },
    {
      label: 'Pay-it-forward approvals',
      value: formatCount(payItForwardItems),
      detail: 'Sponsored funding items awaiting review or issue.',
      href: '/admin/collections/payload_pay_it_forward_funding',
      warning: warning(payItForwardItems),
    },
    {
      label: 'Reconciliation mismatches',
      value: formatCount(reconciliationIssues),
      detail: 'Webhook and Stripe shadow records needing attention.',
      href: '/admin/collections/payload_membership_reconciliations',
      warning: warning(reconciliationIssues),
    },
    {
      label: 'Recent system errors / security events',
      value: formatCount(securityEvents),
      detail: 'Authentication, account, and security event trail.',
      href: '/admin/collections/payload_member_security_events',
      warning: warning(securityEvents),
    },
    {
      label: 'Pending partner applications',
      value: formatCount(pendingPartnerApplications),
      detail: 'Partner applications awaiting delivery, retry, or export.',
      href: '/admin/collections/payload_partner_applications',
      warning: warning(pendingPartnerApplications),
    },
    {
      label: 'Pending affiliate / commission items',
      value: formatCount(pendingAffiliateCommissions),
      detail: 'Internal referral commissions awaiting administrator review.',
      href: '/admin/collections/payload_affiliate_commissions',
      warning: warning(pendingAffiliateCommissions),
    },
    {
      label: 'Community moderation / recent posts',
      value: formatCount(communityModeration),
      detail: 'Community posts needing review or moderation follow-up.',
      href: '/admin/collections/payload_space_posts',
      warning: warning(communityModeration),
    },
    {
      label: 'Deployment / schema health',
      value: 'Review',
      detail: 'Use deployment health plus migration status before live operations.',
      href: '/api/health/deployment',
    },
    {
      label: 'Upcoming course / live call',
      value: 'Placeholder',
      detail: 'No event source is configured yet; add course calendar integration later.',
    },
  ]

  const cockpitViews = membershipSupportCockpitViews.map((view) => ({
    ...view,
    href: view.href,
  }))

  return (
    <main style={{ display: 'grid', gap: 24, padding: '24px 0' }}>
      <section>
        <p style={{ color: '#64736c', fontSize: 12, fontWeight: 700, letterSpacing: '0.18em', margin: 0, textTransform: 'uppercase' }}>
          JPV Bootcamp operations
        </p>
        <h1 style={{ color: '#153f2e', fontSize: 34, lineHeight: 1.1, margin: '10px 0 0' }}>
          Operational dashboard
        </h1>
        <p style={{ color: '#64736c', fontSize: 15, lineHeight: 1.6, margin: '12px 0 0', maxWidth: 760 }}>
          Sidebar collections remain available for detail work. This dashboard surfaces the operational signals that need administrator attention first.
        </p>
      </section>
      <section style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        {cards.map((card) => (
          <article
            key={card.label}
            style={{
              background: card.warning ? '#fff7ed' : '#ffffff',
              border: `1px solid ${card.warning ? '#fed7aa' : '#dfe7e2'}`,
              borderRadius: 18,
              boxShadow: '0 14px 36px rgba(21, 63, 46, 0.07)',
              padding: 20,
            }}
          >
            <p style={{ color: '#64736c', fontSize: 13, fontWeight: 700, margin: 0 }}>{card.label}</p>
            <p style={{ color: '#153f2e', fontSize: 32, fontWeight: 800, margin: '10px 0 0' }}>{card.value}</p>
            <p style={{ color: '#64736c', fontSize: 13, lineHeight: 1.5, margin: '8px 0 0' }}>{card.detail}</p>
            {card.href ? (
              <a href={card.href} style={{ color: '#153f2e', display: 'inline-flex', fontSize: 13, fontWeight: 700, marginTop: 14 }}>
                Open
              </a>
            ) : null}
          </article>
        ))}
      </section>
      <section
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.96), rgba(244,249,246,0.96))',
          border: '1px solid #d7e1db',
          borderRadius: 24,
          boxShadow: '0 18px 42px rgba(21, 63, 46, 0.08)',
          display: 'grid',
          gap: 18,
          padding: 24,
        }}
      >
        <div>
          <p style={{ color: '#64736c', fontSize: 12, fontWeight: 700, letterSpacing: '0.18em', margin: 0, textTransform: 'uppercase' }}>
            Membership Support cockpit
          </p>
          <h2 style={{ color: '#153f2e', fontSize: 24, lineHeight: 1.2, margin: '8px 0 0' }}>
            Administrator views, statuses, and actions
          </h2>
          <p style={{ color: '#64736c', fontSize: 15, lineHeight: 1.6, margin: '10px 0 0', maxWidth: 820 }}>
            This cockpit keeps the operational surface bounded to the membership-support collections. It highlights the fields and actions that matter for voucher issuance, reconciliation, and manual review.
          </p>
        </div>
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
          <article style={{ background: '#fff', border: '1px solid #dde7e1', borderRadius: 18, padding: 18 }}>
            <p style={{ color: '#153f2e', fontSize: 15, fontWeight: 800, margin: 0 }}>Operational views</p>
            <ul style={{ color: '#49655a', display: 'grid', gap: 8, fontSize: 13, lineHeight: 1.5, margin: '14px 0 0', paddingLeft: 18 }}>
              {cockpitViews.map((view) => (
                <li key={view.label}>
                  <a href={view.href} style={{ color: '#153f2e', fontWeight: 700 }}>
                    {view.label}
                  </a>
                  <div>{view.description}</div>
                </li>
              ))}
            </ul>
          </article>
          <article style={{ background: '#fff', border: '1px solid #dde7e1', borderRadius: 18, padding: 18 }}>
            <p style={{ color: '#153f2e', fontSize: 15, fontWeight: 800, margin: 0 }}>Displayed fields</p>
            <div style={{ color: '#49655a', display: 'grid', gap: 8, fontSize: 13, lineHeight: 1.5, marginTop: 14 }}>
              {membershipSupportCockpitFields.map((field) => (
                <div key={field}>{field}</div>
              ))}
            </div>
          </article>
          <article style={{ background: '#fff', border: '1px solid #dde7e1', borderRadius: 18, padding: 18 }}>
            <p style={{ color: '#153f2e', fontSize: 15, fontWeight: 800, margin: 0 }}>Statuses and actions</p>
            <div style={{ color: '#49655a', display: 'grid', gap: 14, fontSize: 13, lineHeight: 1.5, marginTop: 14 }}>
              <div>
                <div style={{ color: '#64736c', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', marginBottom: 6, textTransform: 'uppercase' }}>
                  Statuses
                </div>
                <div>{membershipSupportCockpitStatusLabels.join(' · ')}</div>
              </div>
              <div>
                <div style={{ color: '#64736c', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', marginBottom: 6, textTransform: 'uppercase' }}>
                  Actions
                </div>
                <div>{membershipSupportCockpitActionLabels.join(' · ')}</div>
              </div>
            </div>
          </article>
        </div>
      </section>
    </main>
  )
}
