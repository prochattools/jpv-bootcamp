import type { PayloadDocument } from '@/lib/payloadCourse/accessService'

const MEMBER_EMAIL_VERIFICATION_TEMPLATE_KEY = 'member-email-verification'

const memberEmailVerificationTemplate: PayloadDocument = {
  id: 'system-member-email-verification',
  name: 'Member email verification',
  templateKey: MEMBER_EMAIL_VERIFICATION_TEMPLATE_KEY,
  status: 'active',
  purpose: 'account_created',
  subject: 'Verify your JPV Bootcamp email address',
  preheader: 'Secure your JPV Bootcamp member account by verifying your email address.',
  textBody: [
    'Hi {{displayName}},',
    '',
    'Please verify your email address to finish securing your JPV Bootcamp member account.',
    '{{verificationUrl}}',
    '',
    'This link expires in one hour and can only be used once.',
    'If you did not request this, you can ignore this message.',
  ].join('\n'),
  htmlBody: '<!doctype html><html><body style="font-family:Arial,sans-serif;color:#17202a"><div style="max-width:560px;margin:auto;padding:24px"><img src="{{logoUrl}}" alt="JPV" style="max-width:180px;height:auto"/><h1>Verify your email</h1><p>Hi {{displayName}},</p><p>Please verify your email address to finish securing your JPV Bootcamp member account.</p><p><a href="{{verificationUrl}}" style="display:inline-block;background:#111;color:#fff;padding:12px 18px;text-decoration:none;border-radius:6px">Verify email address</a></p><p>This link expires in one hour and can only be used once.</p><p>If you did not request this, you can ignore this message.</p></div></body></html>',
  adminCopyRequired: false,
}

export function getSystemEmailTemplate(templateKey: string): PayloadDocument | null {
  if (templateKey === MEMBER_EMAIL_VERIFICATION_TEMPLATE_KEY) {
    return memberEmailVerificationTemplate
  }
  return null
}

export { MEMBER_EMAIL_VERIFICATION_TEMPLATE_KEY }
