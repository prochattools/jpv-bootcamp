import config from '@payload-config'
import { getPayload } from 'payload'

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
    voucherReviewItems,
    payItForwardItems,
    pendingPartnerApplications,
    pendingAffiliateCommissions,
    communityModeration,
  ] = await Promise.all([
    safeCount(payload, 'payload_members', { accountStatus: { equals: 'active' } }),
    safeCount(payload, 'payload_members', { accountStatus: { equals: 'pending' } }),
    safeCount(payload, 'payload_subscriptions', { status: { equals: 'active' } }),
    safeCount(payload, 'payload_payments', { status: { in: ['failed', 'refunded', 'disputed'] } }),
    safeCount(payload, 'payload_membership_vouchers', { approvalState: { in: ['draft', 'pending_approval'] } }),
    safeCount(payload, 'payload_pay_it_forward_funding', { approvalState: { in: ['draft', 'pending_approval'] } }),
    safeCount(payload, 'payload_partner_applications', { status: { in: ['submitted', 'delivery_pending', 'delivery_failed'] } }),
    safeCount(payload, 'payload_affiliate_commissions', { status: { equals: 'pending' } }),
    safeCount(payload, 'payload_space_posts', { moderationStatus: { in: ['pending_review', 'hidden'] } }),
  ])

  // KPI warning states: amber tint for null (query failed) OR actionable non-zero counts
  const kpis = [
    {
      label: 'Active members',
      value: formatCount(activeMembers),
      isWarning: warning(activeMembers),
    },
    {
      label: 'Pending members',
      value: formatCount(pendingMembers),
      isWarning: pendingMembers === null || pendingMembers > 0,
    },
    {
      label: 'Active subscriptions',
      value: formatCount(activeSubscriptions),
      isWarning: warning(activeSubscriptions),
    },
    {
      label: 'Billing issues',
      value: formatCount(billingIssues),
      isWarning: billingIssues === null || billingIssues > 0,
    },
    {
      label: 'Community moderation',
      value: formatCount(communityModeration),
      isWarning: communityModeration === null || communityModeration > 0,
    },
  ]

  // "Needs attention" items: only shown when count > 0 or query failed
  type AttentionItem = { label: string; count: number | null; href: string }
  const allAttentionItems: AttentionItem[] = [
    {
      label: 'Pending members',
      count: pendingMembers,
      href: '/admin/collections/payload_members?where[accountStatus][equals]=pending',
    },
    {
      label: 'Billing issues',
      count: billingIssues,
      href: '/admin/collections/payload_payments',
    },
    {
      label: 'Voucher approvals',
      count: voucherReviewItems,
      href: '/admin/collections/payload_membership_vouchers',
    },
    {
      label: 'Pay-it-forward approvals',
      count: payItForwardItems,
      href: '/admin/collections/payload_pay_it_forward_funding',
    },
    {
      label: 'Pending partner applications',
      count: pendingPartnerApplications,
      href: '/admin/collections/payload_partner_applications',
    },
    {
      label: 'Pending affiliate commissions',
      count: pendingAffiliateCommissions,
      href: '/admin/collections/payload_affiliate_commissions',
    },
    {
      label: 'Community moderation',
      count: communityModeration,
      href: '/admin/collections/payload_space_posts',
    },
  ]
  const attentionItems = allAttentionItems.filter(
    (item) => item.count === null || item.count > 0,
  )
  const allClear = attentionItems.length === 0

  // Quick actions
  const quickActions = [
    { label: 'Members', href: '/admin/collections/payload_members' },
    { label: 'Billing', href: '/admin/collections/payload_billing_accounts' },
    { label: 'Membership support', href: '/admin/collections/payload_membership_support_records' },
    { label: 'Partner applications', href: '/admin/collections/payload_partner_applications' },
    { label: 'Courses', href: '/admin/collections/payload_courses' },
  ]

  return (
    <main style={{ display: 'grid', gap: 32, padding: '32px 0' }}>
      {/* Hero */}
      <section>
        <p
          style={{
            color: 'var(--jpv-muted)',
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
            color: 'var(--jpv-muted)',
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
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          }}
        >
          {kpis.map((kpi) => (
            <div
              key={kpi.label}
              style={{
                background: kpi.isWarning
                  ? 'color-mix(in srgb, var(--jpv-sunshine) 10%, var(--jpv-canvas))'
                  : 'var(--jpv-canvas)',
                border: `1px solid ${
                  kpi.isWarning
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
                  color: 'var(--jpv-muted)',
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.1em',
                  margin: 0,
                  textTransform: 'uppercase',
                }}
              >
                {kpi.label}
              </p>
              <p
                style={{
                  color: 'var(--jpv-ink)',
                  fontFeatureSettings: '"tnum"',
                  fontSize: 28,
                  fontWeight: 800,
                  margin: '6px 0 0',
                }}
              >
                {kpi.value}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Needs attention */}
      <section>
        <p
          style={{
            color: 'var(--jpv-muted)',
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
              <span style={{ color: 'var(--jpv-green)', fontSize: 16, lineHeight: 1 }}>✓</span>
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
                    textDecoration: 'none',
                  }}
                >
                  <span
                    style={{
                      background: 'color-mix(in srgb, var(--jpv-sunshine) 20%, var(--jpv-canvas))',
                      border: '1px solid color-mix(in srgb, var(--jpv-sunshine) 40%, var(--jpv-border))',
                      borderRadius: 9999,
                      color:
                        item.count === null
                          ? 'var(--jpv-danger)'
                          : 'var(--jpv-sunshine-ink)',
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '1px 8px',
                    }}
                  >
                    {item.count === null ? '!' : item.count}
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
            color: 'var(--jpv-muted)',
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
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px 24px',
            padding: 20,
          }}
        >
          {quickActions.map((action) => (
            <a
              key={action.label}
              href={action.href}
              style={{
                color: 'var(--jpv-brand-deep)',
                fontSize: 13,
                fontWeight: 700,
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
