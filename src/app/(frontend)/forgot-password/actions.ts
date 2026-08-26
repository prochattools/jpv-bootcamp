'use server'

import { getPayloadMemberAccountActionContext } from '@/lib/auth/memberAccountActionApplication'
import { requestPasswordReset } from '@/lib/members/requestPasswordReset'

export type ForgotPasswordActionState = {
  submitted?: boolean
  message?: string
}

function formString(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.trim() : ''
}

export async function requestPasswordResetAction(
  _previousState: ForgotPasswordActionState,
  formData: FormData,
): Promise<ForgotPasswordActionState> {
  const { payload, service } = await getPayloadMemberAccountActionContext()
  const result = await requestPasswordReset(payload, service, {
    email: formString(formData.get('email')),
  })

  return {
    submitted: true,
    message: result.message,
  }
}
