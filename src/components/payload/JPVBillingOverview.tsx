import Link from 'next/link'
import config from '@payload-config'
import { getPayload } from 'payload'

type Doc = { id: string | number; [key: string]: unknown }

function idOf(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value
  if (typeof value === 'number') return String(value)
  if (value && typeof value === 'object') {
    const id = (value as { id?: unknown }).id
    return typeof id === 'string' && id.trim() ? id : typeof id === 'number' ? String(id) : null
  }
  return null
}

function textOf(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function dateOf(value: unknown): string | null {
  const text = textOf(value)
  if (!text || !Number.isFinite(new Date(text).getTime())) return null
  return new Date(text).toLocaleDateString('en-GB')
}

function latestBy<T extends Doc>(docs: readonly T[], field: string, value: string | null): T | null {
  if (!value) return null
  return docs
    .filter((doc) => idOf(doc[field]) === value)
    .sort((a, b) => String(b.updatedAt ?? b.createdAt ?? '').localeCompare(String(a.updatedAt ?? a.createdAt ?? '')))[0] ?? null
}

function metadataText(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const metadata = value as Record<string, unknown>
  for (const key of ['coupon', 'couponCode', 'promotionCode', 'discountCode']) {
    const text = textOf(metadata[key])
    if (text) return text
  }
  return null
}

function displayStatus(value: string | null): string {
  return value ? value.replaceAll('_', ' ') : 'Not linked'
}

function formatDate(value: string | null): string {
  return value ? dateOf(value) ?? 'Unknown' : '—'
}

export async function JPVBillingOverview() {
  let billingData: {
    members: Doc[]
    accounts: Doc[]
    subscriptions: Doc[]
    payments: Doc[]
  } | null = null

  try {
    const payload = await getPayload({ config })
    const [membersResult, accountsResult, subscriptionsResult, paymentsResult] = await Promise.all([
      payload.find({ collection: 'payload_members', limit: 1000, depth: 0, sort: 'email', overrideAccess: true }),
      payload.find({ collection: 'payload_billing_accounts', limit: 1000, depth: 0, sort: 'displayName', overrideAccess: true }),
      payload.find({ collection: 'payload_subscriptions', limit: 1000, depth: 0, sort: '-updatedAt', overrideAccess: true }),
      payload.find({ collection: 'payload_payments', limit: 1000, depth: 0, sort: '-updatedAt', overrideAccess: true }),
    ])

    billingData = {
      members: membersResult.docs as unknown as Doc[],
      accounts: accountsResult.docs as unknown as Doc[],
      subscriptions: subscriptionsResult.docs as unknown as Doc[],
      payments: paymentsResult.docs as unknown as Doc[],
    }
  } catch {
    billingData = null
  }

  if (!billingData) {
    return <p className='jpv-notice jpv-notice-danger'>Billing overview is temporarily unavailable. Open the read-only billing collections or run a guarded reconciliation action.</p>
  }

  const { members, accounts, subscriptions, payments } = billingData

  return (
    <section style={{ display: 'grid', gap: 16 }} aria-labelledby='jpv-billing-overview-heading'>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <p style={{ color: 'var(--jpv-ink)', fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', margin: 0, textTransform: 'uppercase' }}>Stripe snapshot</p>
          <h2 id='jpv-billing-overview-heading' style={{ color: 'var(--jpv-ink)', fontSize: 20, margin: '6px 0 0' }}>Member billing overview</h2>
        </div>
        <Link href='/admin/collections/payload_billing_actions/create' style={{ color: 'var(--jpv-brand-deep)', fontSize: 13, fontWeight: 700 }}>Open Billing Actions →</Link>
      </div>
      <p style={{ color: 'var(--jpv-muted)', fontSize: 13, lineHeight: 1.5, margin: 0 }}>
        Read-only Payload projections of Stripe. Use a Billing Action to reconcile or request a guarded Stripe change; never edit projection records directly.
      </p>
      <div style={{ border: '1px solid var(--jpv-border)', borderRadius: 'var(--jpv-radius-card)', overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', minWidth: 1120, width: '100%' }}>
          <thead>
            <tr style={{ background: 'var(--jpv-surface)' }}>
              {['Member', 'Access', 'Stripe customer', 'Subscription', 'Payment', 'Coupon', 'Last sync'].map((heading) => (
                <th key={heading} scope='col' style={{ color: 'var(--jpv-ink)', fontSize: 11, padding: '12px 14px', textAlign: 'left', whiteSpace: 'nowrap' }}>{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.map((member) => {
              const memberId = String(member.id)
              const account = accounts.find((doc) => idOf(doc.member) === memberId) ?? null
              const accountId = account ? String(account.id) : null
              const subscription = latestBy(subscriptions, 'billingAccount', accountId)
              const subscriptionId = subscription ? String(subscription.id) : null
              const payment = payments.find((doc) => (
                (subscriptionId && idOf(doc.subscription) === subscriptionId) ||
                (!subscriptionId && idOf(doc.member) === memberId)
              )) ?? null
              const hold = textOf(member.billingHoldReason)
              const name = textOf(member.displayName) ?? textOf(member.email) ?? memberId
              const stripeCustomerId = textOf(account?.stripeCustomerId)
              const memberHref = `/admin/collections/payload_members/${member.id}`
              const accountHref = account ? `/admin/collections/payload_billing_accounts/${account.id}` : null
              return (
                <tr key={memberId} style={{ borderTop: '1px solid var(--jpv-border)' }}>
                  <td style={{ color: 'var(--jpv-ink)', fontSize: 13, padding: '12px 14px' }}>
                    <Link href={memberHref} style={{ color: 'var(--jpv-brand-deep)', fontWeight: 700 }}>{name}</Link>
                    <div style={{ color: 'var(--jpv-muted)', fontSize: 12, marginTop: 3 }}>{textOf(member.email) ?? 'No email'}</div>
                  </td>
                  <td style={{ color: hold ? 'var(--jpv-danger-ink)' : 'var(--jpv-ink)', fontSize: 13, padding: '12px 14px', whiteSpace: 'nowrap' }}>
                    {displayStatus(textOf(member.accountStatus))}{hold ? ` · Hold: ${hold}` : ''}
                  </td>
                  <td style={{ color: 'var(--jpv-muted)', fontSize: 13, padding: '12px 14px', whiteSpace: 'nowrap' }}>
                    {accountHref ? <Link href={accountHref} style={{ color: 'var(--jpv-brand-deep)' }}>{stripeCustomerId ?? 'Linked, ID missing'}</Link> : 'Not linked'}
                    <div style={{ fontSize: 12, marginTop: 3 }}>{displayStatus(textOf(account?.billingStatus))}</div>
                  </td>
                  <td style={{ color: 'var(--jpv-muted)', fontSize: 13, padding: '12px 14px', whiteSpace: 'nowrap' }}>
                    {displayStatus(textOf(subscription?.status))}
                    <div style={{ fontSize: 12, marginTop: 3 }}>{textOf(subscription?.plan) ?? 'No plan'} · ends {formatDate(textOf(subscription?.currentPeriodEnd))}</div>
                  </td>
                  <td style={{ color: 'var(--jpv-muted)', fontSize: 13, padding: '12px 14px', whiteSpace: 'nowrap' }}>
                    {displayStatus(textOf(payment?.status))}
                    <div style={{ fontSize: 12, marginTop: 3 }}>{textOf(payment?.invoiceNumber) ?? 'No invoice'} · {formatDate(textOf(payment?.paidAt))}</div>
                  </td>
                  <td style={{ color: 'var(--jpv-muted)', fontSize: 13, padding: '12px 14px' }}>{metadataText(account?.metadata) ?? '—'}</td>
                  <td style={{ color: 'var(--jpv-muted)', fontSize: 13, padding: '12px 14px', whiteSpace: 'nowrap' }}>{formatDate(textOf(account?.lastSyncedAt) ?? textOf(subscription?.lastSyncedAt))}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {members.length === 0 ? <p style={{ color: 'var(--jpv-muted)', fontSize: 13, margin: 0 }}>No member records were returned.</p> : null}
    </section>
  )
}
