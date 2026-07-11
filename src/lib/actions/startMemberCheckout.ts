'use server'

import 'server-only'

import prisma from '@/libs/prisma'
import { requirePortalMember } from '@/lib/auth/requirePortalMember'
import { getStripeConfig } from '@/lib/config'
import { normalizeEmail } from '@/lib/normalize-email'
import { getStripe } from '@/lib/stripe'
import { buildCheckoutContractMetadata } from '@/lib/stripe-commitment'

export type MemberCheckoutPlan = 'pro'
export type MemberCheckoutBilling = 'monthly' | 'annual'
export type MemberCheckoutConsent = {
  contractAccepted: boolean
  immediateAccessRequested: boolean
}

export type StartMemberCheckoutResult =
  | { ok: true; checkoutUrl: string }
  | {
      ok: false
      error:
        | 'unauthenticated'
        | 'invalid_plan'
        | 'consent_required'
        | 'existing_subscription'
        | 'stripe_error'
    }

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing', 'past_due', 'unpaid'])
const ACTIVE_COMMITMENT_STATUSES = new Set(['pending', 'active', 'cancellation_requested'])

export async function startMemberCheckout(
  plan: string,
  billing: MemberCheckoutBilling = 'monthly',
  consent?: MemberCheckoutConsent,
): Promise<StartMemberCheckoutResult> {
  if (plan !== 'pro') return { ok: false, error: 'invalid_plan' }
  if (billing !== 'monthly' && billing !== 'annual') return { ok: false, error: 'invalid_plan' }
  if (
    billing === 'monthly' &&
    (!consent?.contractAccepted || !consent.immediateAccessRequested)
  ) {
    return { ok: false, error: 'consent_required' }
  }

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
      select: {
        stripeCustomerId: true,
        subscriptionStatus: true,
        commitmentStatus: true,
      },
    })

    if (
      (record?.subscriptionStatus && ACTIVE_SUBSCRIPTION_STATUSES.has(record.subscriptionStatus)) ||
      (record?.commitmentStatus && ACTIVE_COMMITMENT_STATUSES.has(record.commitmentStatus))
    ) {
      return { ok: false, error: 'existing_subscription' }
    }

    const config = getStripeConfig()
    const priceId = billing === 'annual' ? config.stripe.priceProAnnual : config.stripe.pricePro
    const successUrl = new URL('/portal/billing?checkout=success', config.app.url).toString()
    const cancelUrl = new URL('/portal/billing?checkout=cancelled', config.app.url).toString()
    const metadata = buildCheckoutContractMetadata({
      billing,
      source: 'member_portal',
      consent:
        billing === 'monthly'
          ? {
              contractAccepted: true,
              immediateAccessRequested: true,
              acceptedAt: new Date(),
            }
          : null,
    })

    const session = await getStripe().checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: billing === 'annual',
      ...(record?.stripeCustomerId
        ? { customer: record.stripeCustomerId }
        : { customer_email: memberEmail }),
      metadata,
      subscription_data: { metadata },
    })

    if (!session.url) return { ok: false, error: 'stripe_error' }
    return { ok: true, checkoutUrl: session.url }
  } catch (error) {
    console.error('Failed to create member checkout session', error)
    return { ok: false, error: 'stripe_error' }
  }
}
