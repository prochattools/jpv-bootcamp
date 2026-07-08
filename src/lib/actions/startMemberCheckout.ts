'use server'

import 'server-only'

import prisma from '@/libs/prisma'
import { requirePortalMember } from '@/lib/auth/requirePortalMember'
import { getStripeConfig } from '@/lib/config'
import { normalizeEmail } from '@/lib/normalize-email'
import { getStripe } from '@/lib/stripe'

export type MemberCheckoutPlan = 'pro'
export type MemberCheckoutBilling = 'monthly' | 'annual'

export type StartMemberCheckoutResult =
  | { ok: true; checkoutUrl: string }
  | { ok: false; error: 'unauthenticated' | 'invalid_plan' | 'existing_subscription' | 'stripe_error' }

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing', 'past_due', 'unpaid'])

export async function startMemberCheckout(
  plan: string,
  billing: MemberCheckoutBilling = 'monthly'
): Promise<StartMemberCheckoutResult> {
  if (plan !== 'pro') return { ok: false, error: 'invalid_plan' }
  if (billing !== 'monthly' && billing !== 'annual') return { ok: false, error: 'invalid_plan' }

  let memberEmail: string
  try {
    const member = await requirePortalMember('/portal/billing')
    memberEmail = member.memberEmail
  } catch {
    return { ok: false, error: 'unauthenticated' }
  }

  const normalizedEmail = normalizeEmail(memberEmail)
  if (!normalizedEmail) return { ok: false, error: 'unauthenticated' }

  try {
    const record = await prisma.customerProvisioning.findUnique({
      where: { normalizedEmail },
      select: { stripeCustomerId: true, subscriptionStatus: true },
    })

    if (record?.subscriptionStatus && ACTIVE_SUBSCRIPTION_STATUSES.has(record.subscriptionStatus)) {
      return { ok: false, error: 'existing_subscription' }
    }

    const config = getStripeConfig()
    const priceId = billing === 'annual' ? config.stripe.priceProAnnual : config.stripe.pricePro
    const successUrl = new URL('/portal/billing?checkout=success', config.app.url).toString()
    const cancelUrl = new URL('/portal/billing?checkout=cancelled', config.app.url).toString()

    const session = await getStripe().checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      ...(record?.stripeCustomerId
        ? { customer: record.stripeCustomerId }
        : { customer_email: memberEmail }),
      metadata: { plan: 'pro', billing, source: 'member_portal' },
      subscription_data: { metadata: { plan: 'pro', billing, source: 'member_portal' } },
    })

    if (!session.url) return { ok: false, error: 'stripe_error' }
    return { ok: true, checkoutUrl: session.url }
  } catch (error) {
    console.error('Failed to create member checkout session', error)
    return { ok: false, error: 'stripe_error' }
  }
}
