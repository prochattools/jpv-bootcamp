export type CommunicationCategory =
  | 'security'
  | 'transactional'
  | 'required_service'
  | 'optional_notification'
  | 'broadcast'

export type CommunicationChannel = 'email' | 'in_app' | 'admin'

export type CommunicationDeduplicationStrategy =
  | 'single_use'
  | 'member_event'
  | 'content_member'
  | 'content_member_period'
  | 'event_recipient'

export type CommunicationRetryPolicy = 'none' | 'bounded' | 'manual' | 'provider'

export type CommunicationRegistryEntry = {
  key: string
  description: string
  category: CommunicationCategory
  required: boolean
  preferenceKey?: string
  defaultPreference?: boolean
  dedupeStrategy: CommunicationDeduplicationStrategy
  retryPolicy: CommunicationRetryPolicy
  auditEvent: string
  channels: CommunicationChannel[]
  unsubscribeAllowed: boolean
}

export const COMMUNICATION_REGISTRY: readonly CommunicationRegistryEntry[] = [
  {
    key: 'member-invitation',
    description: 'Invite a member to set up their account.',
    category: 'security',
    required: true,
    dedupeStrategy: 'single_use',
    retryPolicy: 'bounded',
    auditEvent: 'member.invitation.queued',
    channels: ['email'],
    unsubscribeAllowed: false,
  },
  {
    key: 'member-email-verification',
    description: 'Verify a member email address.',
    category: 'security',
    required: true,
    dedupeStrategy: 'single_use',
    retryPolicy: 'bounded',
    auditEvent: 'member.email_verification.queued',
    channels: ['email'],
    unsubscribeAllowed: false,
  },
  {
    key: 'member-password-reset',
    description: 'Reset a member password.',
    category: 'security',
    required: true,
    dedupeStrategy: 'single_use',
    retryPolicy: 'bounded',
    auditEvent: 'member.password_reset.queued',
    channels: ['email'],
    unsubscribeAllowed: false,
  },
  {
    key: 'member-password-changed',
    description: 'Confirm a password change.',
    category: 'security',
    required: true,
    dedupeStrategy: 'member_event',
    retryPolicy: 'bounded',
    auditEvent: 'member.password_changed.queued',
    channels: ['email'],
    unsubscribeAllowed: false,
  },
  {
    key: 'member-email-change-requested',
    description: 'Notify that a sign-in email change was requested.',
    category: 'security',
    required: true,
    dedupeStrategy: 'member_event',
    retryPolicy: 'bounded',
    auditEvent: 'member.email_change_requested.queued',
    channels: ['email'],
    unsubscribeAllowed: false,
  },
  {
    key: 'member-email-change-confirmation',
    description: 'Confirm a new sign-in email address.',
    category: 'security',
    required: true,
    dedupeStrategy: 'single_use',
    retryPolicy: 'bounded',
    auditEvent: 'member.email_change_confirmation.queued',
    channels: ['email'],
    unsubscribeAllowed: false,
  },
  {
    key: 'member-email-changed',
    description: 'Confirm a sign-in email address has changed.',
    category: 'security',
    required: true,
    dedupeStrategy: 'member_event',
    retryPolicy: 'bounded',
    auditEvent: 'member.email_changed.queued',
    channels: ['email'],
    unsubscribeAllowed: false,
  },
  {
    key: 'access-blocked',
    description: 'Notify that access is blocked.',
    category: 'security',
    required: true,
    dedupeStrategy: 'member_event',
    retryPolicy: 'bounded',
    auditEvent: 'member.access_blocked.queued',
    channels: ['email'],
    unsubscribeAllowed: false,
  },
  {
    key: 'access-restored',
    description: 'Notify that access is restored.',
    category: 'security',
    required: true,
    dedupeStrategy: 'member_event',
    retryPolicy: 'bounded',
    auditEvent: 'member.access_restored.queued',
    channels: ['email'],
    unsubscribeAllowed: false,
  },
  {
    key: 'billing-payment-failed',
    description: 'Notify about a failed payment.',
    category: 'transactional',
    required: true,
    dedupeStrategy: 'event_recipient',
    retryPolicy: 'bounded',
    auditEvent: 'billing.payment_failed.queued',
    channels: ['email'],
    unsubscribeAllowed: false,
  },
  {
    key: 'billing-payment-recovered',
    description: 'Notify that a previously failed payment recovered.',
    category: 'transactional',
    required: true,
    dedupeStrategy: 'event_recipient',
    retryPolicy: 'bounded',
    auditEvent: 'billing.payment_recovered.queued',
    channels: ['email'],
    unsubscribeAllowed: false,
  },
  {
    key: 'billing-payment-refunded',
    description: 'Notify about a refund.',
    category: 'transactional',
    required: true,
    dedupeStrategy: 'event_recipient',
    retryPolicy: 'bounded',
    auditEvent: 'billing.payment_refunded.queued',
    channels: ['email'],
    unsubscribeAllowed: false,
  },
  {
    key: 'billing-payment-disputed',
    description: 'Notify about a payment dispute.',
    category: 'transactional',
    required: true,
    dedupeStrategy: 'event_recipient',
    retryPolicy: 'bounded',
    auditEvent: 'billing.payment_disputed.queued',
    channels: ['email'],
    unsubscribeAllowed: false,
  },
  {
    key: 'community-announcement',
    description: 'Send a community announcement.',
    category: 'optional_notification',
    required: false,
    preferenceKey: 'announcements',
    defaultPreference: true,
    dedupeStrategy: 'content_member',
    retryPolicy: 'bounded',
    auditEvent: 'community.announcement.queued',
    channels: ['email', 'in_app'],
    unsubscribeAllowed: true,
  },
  {
    key: 'community-reply',
    description: 'Notify a member about a reply.',
    category: 'optional_notification',
    required: false,
    preferenceKey: 'communityReplies',
    defaultPreference: true,
    dedupeStrategy: 'content_member',
    retryPolicy: 'bounded',
    auditEvent: 'community.reply.queued',
    channels: ['email', 'in_app'],
    unsubscribeAllowed: true,
  },
  {
    key: 'community-mention',
    description: 'Notify a member about a mention.',
    category: 'optional_notification',
    required: false,
    preferenceKey: 'communityMentions',
    defaultPreference: true,
    dedupeStrategy: 'content_member',
    retryPolicy: 'bounded',
    auditEvent: 'community.mention.queued',
    channels: ['email', 'in_app'],
    unsubscribeAllowed: true,
  },
  {
    key: 'community-moderation-outcome',
    description: 'Notify a member about moderation outcome.',
    category: 'required_service',
    required: true,
    dedupeStrategy: 'content_member',
    retryPolicy: 'bounded',
    auditEvent: 'community.moderation_outcome.queued',
    channels: ['email', 'admin'],
    unsubscribeAllowed: false,
  },
  {
    key: 'community-group-change',
    description: 'Notify about a group membership change.',
    category: 'optional_notification',
    required: false,
    preferenceKey: 'groupChanges',
    defaultPreference: true,
    dedupeStrategy: 'content_member',
    retryPolicy: 'bounded',
    auditEvent: 'community.group_change.queued',
    channels: ['email', 'in_app'],
    unsubscribeAllowed: true,
  },
  {
    key: 'community-digest',
    description: 'Send a community digest on a schedule.',
    category: 'optional_notification',
    required: false,
    preferenceKey: 'communityDigest',
    defaultPreference: false,
    dedupeStrategy: 'content_member_period',
    retryPolicy: 'provider',
    auditEvent: 'community.digest.queued',
    channels: ['email'],
    unsubscribeAllowed: true,
  },
  {
    key: 'learning-progress-digest',
    description: 'Send a learning progress digest when enabled.',
    category: 'optional_notification',
    required: false,
    preferenceKey: 'learningReminders',
    defaultPreference: false,
    dedupeStrategy: 'content_member_period',
    retryPolicy: 'provider',
    auditEvent: 'learning.progress_digest.queued',
    channels: ['email'],
    unsubscribeAllowed: true,
  },
  {
    key: 'partner-application-received',
    description: 'Notify about a partner application.',
    category: 'transactional',
    required: true,
    dedupeStrategy: 'event_recipient',
    retryPolicy: 'bounded',
    auditEvent: 'partner.application_received.queued',
    channels: ['email', 'admin'],
    unsubscribeAllowed: false,
  },
  {
    key: 'partner-delivery-failed',
    description: 'Notify administrators when partner delivery fails.',
    category: 'required_service',
    required: true,
    dedupeStrategy: 'event_recipient',
    retryPolicy: 'manual',
    auditEvent: 'partner.delivery_failed.queued',
    channels: ['admin'],
    unsubscribeAllowed: false,
  },
  {
    key: 'broadcast',
    description: 'Send an administrator-selected broadcast.',
    category: 'broadcast',
    required: false,
    preferenceKey: 'broadcasts',
    defaultPreference: false,
    dedupeStrategy: 'event_recipient',
    retryPolicy: 'provider',
    auditEvent: 'broadcast.queued',
    channels: ['email'],
    unsubscribeAllowed: true,
  },
]

export function getCommunicationRegistryEntry(key: string): CommunicationRegistryEntry | null {
  return COMMUNICATION_REGISTRY.find((entry) => entry.key === key) ?? null
}

export function getRequiredCommunicationKeys(): string[] {
  return COMMUNICATION_REGISTRY.filter((entry) => entry.required).map((entry) => entry.key)
}

export function isRequiredCommunicationKey(key: string): boolean {
  const entry = getCommunicationRegistryEntry(key)
  return Boolean(entry?.required)
}
