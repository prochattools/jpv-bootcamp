'use server'

import 'server-only'

import prisma from '@/libs/prisma'
import { getStripe } from '@/lib/stripe'
import { getStripeConfig } from '@/lib/stripe-config'
import { normalizeEmail } from '@/lib/normalize-email'
import { requirePortalMember } from '@/lib/auth/requirePortalMember'
import config from '@payload-config'
import { getPayload } from 'payload'

export type OpenBillingPortalResult =
  | { ok: true; portalUrl: string }
  | {
      ok: false
      error:
        | 'unauthenticated'
        | 'no_stripe_customer'
        | 'stripe_error'
        | 'unexpected_error'
    }

function resolveReturnUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_PUBLIC_URL ||
    process.env.NEXT_PUBLIC_SERVER_URL ||
    'https://jpvbootcamp.com'
  try {
    const url = new URL('/portal/billing', base)
    return url.toString()
  } catch {
    return 'https://jpvbootcamp.com/portal/billing'
  }
}

export async function openBillingPortal(): Promise<OpenBillingPortalResult> {
  let memberEmail: string
  let memberId: string

  try {
    const portalMember = await requirePortalMember('/portal/billing')
    memberEmail = portalMember.memberEmail
    memberId = portalMember.memberId
  } catch {
    return { ok: false, error: 'unauthenticated' }
  }

  const normalizedEmail = normalizeEmail(memberEmail)
  if (!normalizedEmail) return { ok: false, error: 'unauthenticated' }

  try {
    const payload = await getPayload({ config })
    const payloadAccounts = await payload.find({
      collection: 'payload_billing_accounts',
      where: { member: { equals: memberId } },
      limit: 2,
      depth: 0,
      overrideAccess: true,
    })
    const payloadCustomerId = typeof payloadAccounts.docs[0]?.stripeCustomerId === 'string'
      ? payloadAccounts.docs[0].stripeCustomerId.trim()
      : ''

    const customerRecord = await prisma.customerProvisioning.findUnique({
      where: { normalizedEmail },
      select: { stripeCustomerId: true },
    })

    let stripeCustomerId = payloadCustomerId || customerRecord?.stripeCustomerId?.trim() || ''
    if (!stripeCustomerId) {
      // Read-only recovery for legacy/coupon members whose projection has not
      // been linked yet. Never auto-link an ambiguous email match.
      const matches = await getStripe().customers.list({ email: memberEmail, limit: 10 })
      const exactMatches = matches.data.filter((customer) => normalizeEmail(customer.email ?? '') === normalizedEmail)
      if (exactMatches.length !== 1) return { ok: false, error: 'no_stripe_customer' }
      stripeCustomerId = exactMatches[0].id
    }

    const stripeConfig = getStripeConfig()
    const session = await getStripe().billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: resolveReturnUrl(),
      configuration: stripeConfig.portalConfigurationId,
    })

    if (!session.url) {
      console.error('Billing portal session created but no URL returned')
      return { ok: false, error: 'stripe_error' }
    }

    return { ok: true, portalUrl: session.url }
  } catch (error) {
    const errorMessage = (error as Error).message || 'Unknown error'
    console.error('Failed to open billing portal: internal server error')

    if (
      errorMessage.includes('No such customer') ||
      errorMessage.includes('Invalid customer ID')
    ) {
      return { ok: false, error: 'no_stripe_customer' }
    }

    if (errorMessage.includes('Stripe')) return { ok: false, error: 'stripe_error' }
    return { ok: false, error: 'unexpected_error' }
  }
}
