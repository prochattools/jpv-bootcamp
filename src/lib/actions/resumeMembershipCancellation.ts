'use server'

import 'server-only'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requirePortalMember } from '@/lib/auth/requirePortalMember'
import { reverseCancellationRequest } from '@/lib/billing/commitmentProjection'

export async function resumeMembershipCancellation(_formData: FormData): Promise<never> {
  const member = await requirePortalMember('/portal/billing')
  const result = await reverseCancellationRequest({ memberEmail: member.memberEmail })

  if (result.ok === false) redirect(`/portal/billing?cancellation_error=${result.error}`)

  revalidatePath('/portal/billing')
  redirect('/portal/billing?cancellation_reversed=1')
}
