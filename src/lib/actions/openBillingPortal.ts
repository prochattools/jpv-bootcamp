'use server'

import 'server-only'

import prisma from '@/libs/prisma'
import { getStripe } from '@/lib/stripe'
import { getStripeConfig } from '@/lib/stripe-config'
import { normalizeEmail } from '@/lib/normalize-email'
import { requirePortalMember } from '@/lib/auth/requirePortalMember'

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

  try {
    const portalMember = await requirePortalMember('/portal/billing')
    memberEmail = portalMember.memberEmail
  } catch {
    return { ok: false, error: 'unauthenticated' }
  }

  const normalizedEmail = normalizeEmail(memberEmail)
  if (!normalizedEmail) return { ok: false, error: 'unauthenticated' }

  try {
    const customerRecord = await prisma.customerProvisioning.findUnique({
      where: { normalizedEmail },
      select: { stripeCustomerId: true },
    })

    if (!customerRecord?.stripeCustomerId) {
      console.warn('No Stripe customer found')
      return { ok: false, error: 'no_stripe_customer' }
    }

    const stripeConfig = getStripeConfig()
    const session = await getStripe().billingPortal.sessions.create({
      customer: customerRecord.stripeCustomerId,
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
