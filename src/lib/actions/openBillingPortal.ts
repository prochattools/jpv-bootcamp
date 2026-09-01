'use server'

import 'server-only'

import prisma from '@/libs/prisma'
import { getStripe } from '@/lib/stripe'
import { getStripeConfig } from '@/lib/stripe-config'
import { normalizeEmail } from '@/lib/normalize-email'
import { requirePortalMember } from '@/lib/auth/requirePortalMember'
import config from '@payload-config'
import { getPayload } from 'payload'

const BILLING_PORTAL_RETURN_PATH = '/billing-return'

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
    const url = new URL(BILLING_PORTAL_RETURN_PATH, base)
    return url.toString()
  } catch {
    return `https://jpvbootcamp.com${BILLING_PORTAL_RETURN_PATH}`
  }
}

function isMissingStripeCustomer(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const stripeError = error as { code?: string; message?: string }
  return stripeError.code === 'resource_missing' || Boolean(
    stripeError.message?.includes('No such customer') || stripeError.message?.includes('Invalid customer ID')
  )
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

    const stripeConfig = getStripeConfig()
    const stripe = getStripe()
    const knownCustomerIds = [payloadCustomerId, customerRecord?.stripeCustomerId?.trim() || '']
      .filter((id, index, values): id is string => Boolean(id) && values.indexOf(id) === index)

    async function createSession(customerId: string) {
      return stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: resolveReturnUrl(),
        configuration: stripeConfig.portalConfigurationId,
      })
    }

    // Try trusted local links first. If a legacy link points at a deleted
    // customer, recover by exact email without creating a new Stripe customer.
    for (const customerId of knownCustomerIds) {
      try {
        const session = await createSession(customerId)
        if (session.url) return { ok: true, portalUrl: session.url }
      } catch (error) {
        if (!isMissingStripeCustomer(error)) throw error
      }
    }

    const matches = await stripe.customers.list({ email: normalizedEmail, limit: 10 })
    const exactMatches = matches.data.filter((customer) => normalizeEmail(customer.email ?? '') === normalizedEmail)
    if (exactMatches.length !== 1) return { ok: false, error: 'no_stripe_customer' }

    const session = await createSession(exactMatches[0].id)
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
