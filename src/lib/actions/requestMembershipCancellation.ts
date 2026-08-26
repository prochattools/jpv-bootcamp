'use server'

import 'server-only'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requirePortalMember } from '@/lib/auth/requirePortalMember'
import { recordCancellationRequest } from '@/lib/billing/commitmentProjection'

export async function requestMembershipCancellation(_formData: FormData): Promise<never> {
  const member = await requirePortalMember('/portal/billing')
  const result = await recordCancellationRequest({ memberEmail: member.memberEmail })

  if (result.ok === false) {
    redirect(`/portal/billing?cancellation_error=${result.error}`)
  }

  revalidatePath('/portal/billing')
  const effectiveAt = encodeURIComponent(result.effectiveAt.toISOString())
  redirect(
    `/portal/billing?cancellation_requested=1&cancellation_effective_at=${effectiveAt}`,
  )
}
