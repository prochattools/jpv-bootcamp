import type { PayloadDocument } from '@/lib/payloadCourse/accessService'
import { renderBrandedEmail } from '@/lib/communications/brandedEmail'

export const MEMBER_EMAIL_VERIFICATION_TEMPLATE_KEY = 'member-email-verification'
export const MEMBER_INVITATION_TEMPLATE_KEY = 'member-invitation'
export const MEMBER_PASSWORD_RESET_TEMPLATE_KEY = 'member-password-reset'
export const MEMBER_PASSWORD_CHANGED_TEMPLATE_KEY = 'member-password-changed'
export const MEMBER_ACCOUNT_READY_TEMPLATE_KEY = 'member-account-ready'
export const MEMBER_PROFILE_CHANGED_TEMPLATE_KEY = 'member-profile-changed'
export const MEMBER_EMAIL_CHANGE_CONFIRMATION_TEMPLATE_KEY = 'member-email-change-confirmation'
export const MEMBER_EMAIL_CHANGE_REQUESTED_TEMPLATE_KEY = 'member-email-change-requested'
export const MEMBER_EMAIL_CHANGED_TEMPLATE_KEY = 'member-email-changed'
export const BILLING_PAYMENT_FAILED_TEMPLATE_KEY = 'billing-payment-failed'
export const BILLING_PAYMENT_RECOVERED_TEMPLATE_KEY = 'billing-payment-recovered'
export const BILLING_PAYMENT_REFUNDED_TEMPLATE_KEY = 'billing-payment-refunded'
export const BILLING_PAYMENT_DISPUTED_TEMPLATE_KEY = 'billing-payment-disputed'
export const ACCESS_BLOCKED_TEMPLATE_KEY = 'access-blocked'
export const ACCESS_SUSPENDED_TEMPLATE_KEY = 'access-suspended'
export const ACCESS_RESTORED_TEMPLATE_KEY = 'access-restored'
export const ACCESS_DELETED_TEMPLATE_KEY = 'access-deleted'
export const SUPPORT_REQUEST_RECEIVED_TEMPLATE_KEY = 'support-request-received'
export const SUPPORT_REQUEST_ADMIN_NOTIFICATION_TEMPLATE_KEY = 'support-request-admin-notification'
export const PORTAL_ANNOUNCEMENT_TEMPLATE_KEY = 'portal-announcement'
export const LIVE_SESSION_INVITATION_TEMPLATE_KEY = 'live-session-invitation'
export const ROOM_INVITATION_TEMPLATE_KEY = 'room-invitation'
export const ROOM_CREATED_TEMPLATE_KEY = 'room-created'

function brandedTemplate(input: {
  key: string
  name: string
  subject: string
  preheader: string
  heading: string
  paragraphs: string[]
  actionLabel?: string
  actionUrlVariable?: string
  secondaryActionLabel?: string
  secondaryActionUrlVariable?: string
}): PayloadDocument {
  const textLines = [
    'Hi {{displayName}},',
    '',
    ...input.paragraphs.flatMap((paragraph) => [paragraph, '']),
  ]
  if (input.actionUrlVariable) {
    textLines.push(`${input.actionLabel ?? 'Continue'}: ${input.actionUrlVariable}`, '')
  }
  if (input.secondaryActionUrlVariable) {
    textLines.push(`${input.secondaryActionLabel ?? 'More information'}: ${input.secondaryActionUrlVariable}`, '')
  }
  textLines.push('JPV Bootcamp')

  const paragraphs = input.paragraphs
    .map((paragraph) => `<p style="margin:0 0 16px">${paragraph}</p>`)
    .join('')

  return {
    id: `system-${input.key}`,
    name: input.name,
    templateKey: input.key,
    status: 'active',
    purpose: 'account_created',
    subject: input.subject,
    preheader: input.preheader,
    textBody: textLines.join('\n'),
    htmlBody: renderBrandedEmail({
      preheader: input.preheader,
      heading: input.heading,
      bodyHtml: `<p style="margin:0 0 16px">Hi {{displayName}},</p>${paragraphs}`,
      actions: [
        ...(input.actionUrlVariable
          ? [{ label: input.actionLabel ?? 'Continue', url: input.actionUrlVariable }]
          : []),
        ...(input.secondaryActionUrlVariable
          ? [{
              label: input.secondaryActionLabel ?? 'More information',
              url: input.secondaryActionUrlVariable,
              tone: 'secondary' as const,
            }]
          : []),
      ],
    }),
    adminCopyRequired: false,
  }
}

const templates: Record<string, PayloadDocument> = {
  [MEMBER_EMAIL_VERIFICATION_TEMPLATE_KEY]: brandedTemplate({
    key: MEMBER_EMAIL_VERIFICATION_TEMPLATE_KEY,
    name: 'Member email verification',
    subject: 'Verify your JPV Bootcamp email address',
    preheader: 'Secure your JPV Bootcamp member account by verifying your email address.',
    heading: 'Verify your email',
    paragraphs: [
      'Please verify your email address to finish securing your JPV Bootcamp member account.',
      'This link expires in one hour and can only be used once.',
      'If you did not request this, you can ignore this message.',
    ],
    actionLabel: 'Verify email address',
    actionUrlVariable: '{{verificationUrl}}',
  }),
  [MEMBER_INVITATION_TEMPLATE_KEY]: brandedTemplate({
    key: MEMBER_INVITATION_TEMPLATE_KEY,
    name: 'Member invitation',
    subject: 'Set up your JPV Bootcamp member account',
    preheader: 'Create your password and finish setting up your member account.',
    heading: 'You are invited',
    paragraphs: [
      'An administrator created a pending JPV Bootcamp member account for this email address.',
      'Use the secure link below to choose a password. The link expires in 24 hours and can only be used once.',
      'If you were not expecting this invitation, you can ignore this message.',
    ],
    actionLabel: 'Set your password',
    actionUrlVariable: '{{actionUrl}}',
  }),
  [MEMBER_PASSWORD_RESET_TEMPLATE_KEY]: brandedTemplate({
    key: MEMBER_PASSWORD_RESET_TEMPLATE_KEY,
    name: 'Member password reset',
    subject: 'Reset your JPV Bootcamp password',
    preheader: 'Use this secure, single-use link to reset your password.',
    heading: 'Reset your password',
    paragraphs: [
      'A password reset was requested for your JPV Bootcamp member account.',
      'This link expires in one hour and can only be used once.',
      'If you did not request a reset, you can ignore this message and your password will remain unchanged.',
    ],
    actionLabel: 'Choose a new password',
    actionUrlVariable: '{{actionUrl}}',
  }),
  [MEMBER_PASSWORD_CHANGED_TEMPLATE_KEY]: brandedTemplate({
    key: MEMBER_PASSWORD_CHANGED_TEMPLATE_KEY,
    name: 'Member password changed',
    subject: 'Your JPV Bootcamp password was changed',
    preheader: 'A security confirmation for your member account.',
    heading: 'Password changed',
    paragraphs: [
      'The password for your JPV Bootcamp member account was changed successfully.',
      'If you did not make this change, contact support immediately.',
    ],
  }),
  [MEMBER_ACCOUNT_READY_TEMPLATE_KEY]: brandedTemplate({
    key: MEMBER_ACCOUNT_READY_TEMPLATE_KEY,
    name: 'Member account ready',
    subject: 'Your JPV Bootcamp member account is ready',
    preheader: 'Your password is set and you can now sign in.',
    heading: 'Your account is ready',
    paragraphs: [
      'Your password was set successfully and your pending member account is now active.',
      'For security, this confirmation did not sign you in automatically. Return to the JPV Bootcamp sign-in page to continue.',
    ],
  }),
  [MEMBER_PROFILE_CHANGED_TEMPLATE_KEY]: brandedTemplate({
    key: MEMBER_PROFILE_CHANGED_TEMPLATE_KEY,
    name: 'Member profile changed',
    subject: 'Your JPV Bootcamp profile was updated',
    preheader: 'A confirmation of changes to your member profile.',
    heading: 'Profile updated',
    paragraphs: [
      'Your JPV Bootcamp member profile was updated successfully.',
      'If you did not make this change, contact support.',
    ],
  }),
  [MEMBER_EMAIL_CHANGE_CONFIRMATION_TEMPLATE_KEY]: brandedTemplate({
    key: MEMBER_EMAIL_CHANGE_CONFIRMATION_TEMPLATE_KEY,
    name: 'Member email change confirmation',
    subject: 'Confirm your new JPV Bootcamp email address',
    preheader: 'Confirm this address before it becomes your member sign-in email.',
    heading: 'Confirm your new email',
    paragraphs: [
      'A request was made to use this address for a JPV Bootcamp member account.',
      'Confirm the change with the secure link below. The link expires in one hour and can only be used once.',
      'If you did not request this, you can ignore this message.',
    ],
    actionLabel: 'Confirm new email address',
    actionUrlVariable: '{{actionUrl}}',
  }),
  [MEMBER_EMAIL_CHANGE_REQUESTED_TEMPLATE_KEY]: brandedTemplate({
    key: MEMBER_EMAIL_CHANGE_REQUESTED_TEMPLATE_KEY,
    name: 'Member email change requested',
    subject: 'A JPV Bootcamp email change was requested',
    preheader: 'Your current sign-in email remains unchanged until confirmation.',
    heading: 'Email change requested',
    paragraphs: [
      'A request was made to change the email address on your JPV Bootcamp member account.',
      'Your current sign-in email remains active until the new address is confirmed.',
      'If you did not request this change, contact support.',
    ],
  }),
  [MEMBER_EMAIL_CHANGED_TEMPLATE_KEY]: brandedTemplate({
    key: MEMBER_EMAIL_CHANGED_TEMPLATE_KEY,
    name: 'Member email changed',
    subject: 'Your JPV Bootcamp email address was changed',
    preheader: 'A security confirmation for your member sign-in email.',
    heading: 'Email address changed',
    paragraphs: [
      'The sign-in email for your JPV Bootcamp member account was changed successfully.',
      'For security, you were not signed in automatically. Use the new address the next time you sign in.',
      'If you did not make this change, contact support immediately.',
    ],
  }),
  [BILLING_PAYMENT_FAILED_TEMPLATE_KEY]: brandedTemplate({
    key: BILLING_PAYMENT_FAILED_TEMPLATE_KEY,
    name: 'Membership payment failed',
    subject: 'Your JPV Bootcamp payment needs attention',
    preheader: 'Review your billing details to avoid future membership disruption.',
    heading: 'Payment needs attention',
    paragraphs: [
      'We could not process a recent payment for your JPV Bootcamp membership.',
      'Your account access has not been changed by this notice. Review your billing details in the member portal.',
      'If you recently updated your payment method, no further action may be needed.',
    ],
    actionLabel: 'Review billing',
    actionUrlVariable: '{{billingUrl}}',
    secondaryActionLabel: 'Contact support',
    secondaryActionUrlVariable: '{{supportUrl}}',
  }),
  [BILLING_PAYMENT_RECOVERED_TEMPLATE_KEY]: brandedTemplate({
    key: BILLING_PAYMENT_RECOVERED_TEMPLATE_KEY,
    name: 'Membership payment recovered',
    subject: 'Your JPV Bootcamp payment was received',
    preheader: 'A previously unsuccessful membership payment has now completed.',
    heading: 'Payment received',
    paragraphs: [
      'A previously unsuccessful payment for your JPV Bootcamp membership was received successfully.',
      'No action is required. This message did not sign you in or change your account security settings.',
    ],
  }),
  [BILLING_PAYMENT_REFUNDED_TEMPLATE_KEY]: brandedTemplate({
    key: BILLING_PAYMENT_REFUNDED_TEMPLATE_KEY,
    name: 'Membership payment refunded',
    subject: 'A JPV Bootcamp payment was refunded',
    preheader: 'A refund was recorded for a recent membership payment.',
    heading: 'Refund recorded',
    paragraphs: [
      'A refund was recorded for a recent JPV Bootcamp membership payment.',
      'This notice does not change your account access by itself. Your subscription status remains the source of truth for membership access.',
      'Review your billing history in the member portal if you need more detail.',
    ],
    actionLabel: 'Review billing history',
    actionUrlVariable: '{{billingUrl}}',
    secondaryActionLabel: 'Contact support',
    secondaryActionUrlVariable: '{{supportUrl}}',
  }),
  [BILLING_PAYMENT_DISPUTED_TEMPLATE_KEY]: brandedTemplate({
    key: BILLING_PAYMENT_DISPUTED_TEMPLATE_KEY,
    name: 'Membership payment disputed',
    subject: 'A JPV Bootcamp payment is under review',
    preheader: 'A recent membership payment entered a dispute review.',
    heading: 'Payment under review',
    paragraphs: [
      'A recent JPV Bootcamp membership payment entered a dispute review.',
      'This notice does not change your account access by itself. Subscription status remains authoritative.',
      'Contact support if you do not recognize this billing activity.',
    ],
    actionLabel: 'Contact support',
    actionUrlVariable: '{{supportUrl}}',
  }),
  [ACCESS_BLOCKED_TEMPLATE_KEY]: brandedTemplate({
    key: ACCESS_BLOCKED_TEMPLATE_KEY,
    name: 'Member account blocked',
    subject: 'Your JPV Bootcamp account access changed',
    preheader: 'Your member account is currently blocked.',
    heading: 'Account access changed',
    paragraphs: [
      'Your JPV Bootcamp member account is currently blocked and cannot sign in.',
      'Contact support if you believe this is unexpected.',
    ],
    actionLabel: 'Contact support',
    actionUrlVariable: '{{supportUrl}}',
  }),
  [ACCESS_SUSPENDED_TEMPLATE_KEY]: brandedTemplate({
    key: ACCESS_SUSPENDED_TEMPLATE_KEY,
    name: 'Member account suspended',
    subject: 'Your JPV Bootcamp account is suspended',
    preheader: 'Your member account is temporarily unavailable.',
    heading: 'Account suspended',
    paragraphs: [
      'Your JPV Bootcamp member account is temporarily suspended and cannot sign in.',
      'Contact support for assistance.',
    ],
    actionLabel: 'Contact support',
    actionUrlVariable: '{{supportUrl}}',
  }),
  [ACCESS_RESTORED_TEMPLATE_KEY]: brandedTemplate({
    key: ACCESS_RESTORED_TEMPLATE_KEY,
    name: 'Member account restored',
    subject: 'Your JPV Bootcamp account access was restored',
    preheader: 'Your member account is active again.',
    heading: 'Account access restored',
    paragraphs: [
      'Access to your JPV Bootcamp member account was restored.',
      'This did not sign you in automatically or change your email verification status.',
    ],
    actionLabel: 'Open member portal',
    actionUrlVariable: '{{portalUrl}}',
  }),
  [SUPPORT_REQUEST_RECEIVED_TEMPLATE_KEY]: brandedTemplate({
    key: SUPPORT_REQUEST_RECEIVED_TEMPLATE_KEY,
    name: 'Support request received',
    subject: 'We received your JPV Bootcamp support request',
    preheader: 'Your question is safely with the JPV Bootcamp team.',
    heading: 'We received your question',
    paragraphs: [
      'Thank you for contacting JPV Bootcamp. Your support request has been received and saved for review.',
      'A member of our team will respond as soon as possible using this email address.',
      'You do not need to submit the same question again.',
    ],
    actionLabel: 'Return to JPV Bootcamp',
    actionUrlVariable: '{{supportUrl}}',
  }),
  [SUPPORT_REQUEST_ADMIN_NOTIFICATION_TEMPLATE_KEY]: brandedTemplate({
    key: SUPPORT_REQUEST_ADMIN_NOTIFICATION_TEMPLATE_KEY,
    name: 'Support request — admin notification',
    subject: 'New support request from {{requesterName}}',
    preheader: 'A new support request is waiting for review.',
    heading: 'New support request',
    paragraphs: [
      'A new support request has been received from {{requesterName}} ({{requesterEmail}}) and is waiting for review.',
      'Requester telephone: {{requesterPhone}}.',
      'Log in to the JPV Bootcamp admin panel to view and respond.',
    ],
    actionLabel: 'Open admin panel',
    actionUrlVariable: '{{portalUrl}}',
  }),
  [PORTAL_ANNOUNCEMENT_TEMPLATE_KEY]: brandedTemplate({
    key: PORTAL_ANNOUNCEMENT_TEMPLATE_KEY,
    name: 'Member portal announcement',
    subject: '{{announcementTitle}} — JPV Bootcamp update',
    preheader: 'A new update is available in your JPV Bootcamp member portal.',
    heading: '{{announcementTitle}}',
    paragraphs: [
      'A new update has been published for you in the JPV Bootcamp member portal.',
      '{{announcementBody}}',
    ],
    actionLabel: 'Open update',
    actionUrlVariable: '{{announcementUrl}}',
  }),
  [LIVE_SESSION_INVITATION_TEMPLATE_KEY]: brandedTemplate({
    key: LIVE_SESSION_INVITATION_TEMPLATE_KEY,
    name: 'Live session invitation',
    subject: 'You are invited to {{sessionTitle}}',
    preheader: 'A JPV Bootcamp live session is scheduled for you.',
    heading: 'Live session invitation',
    paragraphs: [
      'You are invited to {{sessionTitle}}.',
      'Scheduled time: {{scheduledAt}}.',
      'Open the member portal to see the session and join when the host starts it.',
    ],
    actionLabel: 'Open live sessions',
    actionUrlVariable: '{{sessionUrl}}',
  }),
  [ROOM_INVITATION_TEMPLATE_KEY]: brandedTemplate({
    key: ROOM_INVITATION_TEMPLATE_KEY,
    name: 'Room invitation',
    subject: 'You are invited to {{roomTitle}}',
    preheader: 'A JPV Bootcamp Room is ready for you.',
    heading: 'Room invitation',
    paragraphs: [
      'You are invited to {{roomTitle}} in the JPV Bootcamp member portal.',
      'Scheduled time: {{scheduledAt}}.',
      'Open the Room page to see its status and join when the host starts it.',
    ],
    actionLabel: 'Open Room',
    actionUrlVariable: '{{roomUrl}}',
  }),
  [ROOM_CREATED_TEMPLATE_KEY]: brandedTemplate({
    key: ROOM_CREATED_TEMPLATE_KEY,
    name: 'Room created acknowledgement',
    subject: 'Room created: {{roomTitle}}',
    preheader: 'Your JPV Bootcamp Room was created successfully.',
    heading: 'Room created',
    paragraphs: [
      'Your Room, {{roomTitle}}, was created successfully.',
      'Scheduled time: {{scheduledAt}}.',
      'Audience reconciliation and invitation delivery have been queued through the application outbox.',
    ],
    actionLabel: 'Open Rooms',
    actionUrlVariable: '{{portalUrl}}',
  }),
  [ACCESS_DELETED_TEMPLATE_KEY]: brandedTemplate({
    key: ACCESS_DELETED_TEMPLATE_KEY,
    name: 'Member account deleted',
    subject: 'Your JPV Bootcamp account was closed',
    preheader: 'A confirmation that member access was removed.',
    heading: 'Account closed',
    paragraphs: [
      'Your JPV Bootcamp member account was closed and can no longer sign in.',
      'Contact support if you believe this is unexpected.',
    ],
    actionLabel: 'Contact support',
    actionUrlVariable: '{{supportUrl}}',
  }),
}

export function getSystemEmailTemplate(templateKey: string): PayloadDocument | null {
  return templates[templateKey] ?? null
}
