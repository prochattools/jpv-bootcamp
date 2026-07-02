'use server'

import { redirect } from 'next/navigation'

import { getCurrentPayloadMember } from '@/lib/members/currentMember'
import {
  createMemberBillingPortalSession,
  MemberBillingPortalUnavailableError,
} from '@/lib/payloadCourse/memberBillingPortal'
import {
  createAuthenticatedVipUpgradeSession,
  MemberVipUpgradeUnavailableError,
} from '@/lib/payloadCourse/memberVipUpgrade'

export async function openMemberBillingPortalAction(): Promise<void> {
  const { member, payload } = await getCurrentPayloadMember()
  if (!member) {
    redirect('/learn/login?next=/learn/billing')
  }

  let portalUrl: string
  try {
    portalUrl = await createMemberBillingPortalSession(payload, member.id)
  } catch (error) {
    console.warn('member_billing_portal_unavailable', {
      reason:
        error instanceof MemberBillingPortalUnavailableError
          ? error.code
          : 'unexpected_error',
    })
    redirect('/learn/billing')
  }

  redirect(portalUrl)
}



export async function openMemberVipUpgradeAction(): Promise<void> {
  const { member, payload } = await getCurrentPayloadMember()
  if (!member) {
    redirect('/learn/login?next=/learn/billing')
  }

  let portalUrl: string
  try {
    portalUrl = await createAuthenticatedVipUpgradeSession(payload, member.id)
  } catch (error) {
    console.warn('member_vip_upgrade_unavailable', {
      reason:
        error instanceof MemberVipUpgradeUnavailableError ||
        error instanceof MemberBillingPortalUnavailableError
          ? error.code
          : 'unexpected_error',
    })
    redirect('/learn/billing')
  }

  redirect(portalUrl)
}
