'use server'

import config from '@payload-config'
import { getPayload } from 'payload'

import { requestPasswordReset } from '@/lib/members/requestPasswordReset'
import type { PayloadMemberAuthAPI } from '@/lib/payloadCourse/accessService'

export type ForgotPasswordActionState = {
  submitted?: boolean
  message?: string
}

function formString(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.trim() : ''
}

function applicationBaseUrl(): string {
  const configured = process.env.PAYLOAD_SERVER_URL || process.env.NEXT_PUBLIC_SERVER_URL
  if (configured) return configured
  return 'http://localhost:3000'
}

export async function requestPasswordResetAction(
  _previousState: ForgotPasswordActionState,
  formData: FormData,
): Promise<ForgotPasswordActionState> {
  const payload = await getPayload({ config })
  const result = await requestPasswordReset(payload as unknown as PayloadMemberAuthAPI, {
    email: formString(formData.get('email')),
    baseUrl: applicationBaseUrl(),
  })

  return {
    submitted: true,
    message: result.message,
  }
}
