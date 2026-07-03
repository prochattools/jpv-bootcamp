export type VerificationConfigChecklistItem = {
  category: string
  names: string[]
}

export const VERIFICATION_CONFIGURATION_CHECKLIST: VerificationConfigChecklistItem[] = [
  {
    category: 'Public origin',
    names: ['APP_PUBLIC_URL', 'NEXT_PUBLIC_APP_URL', 'PAYLOAD_SERVER_URL', 'NEXT_PUBLIC_SERVER_URL', 'NEXT_PUBLIC_APP_DOMAIN'],
  },
  {
    category: 'Email sender',
    names: ['RESEND_API_KEY', 'RESEND_FROM', 'EMAIL_FROM', 'EMAIL_REPLY_TO', 'SUPPORT_TO_EMAIL'],
  },
  {
    category: 'Payload and queue',
    names: ['PAYLOAD_SECRET', 'DISABLE_NON_WEBHOOK_EMAILS'],
  },
  {
    category: 'Webhook projection',
    names: ['RESEND_WEBHOOK_SECRET'],
  },
]

export function getVerificationConfigurationNames(): string[] {
  return [...new Set(VERIFICATION_CONFIGURATION_CHECKLIST.flatMap((item) => item.names))].sort()
}

