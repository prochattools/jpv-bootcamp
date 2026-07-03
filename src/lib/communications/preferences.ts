import { COMMUNICATION_REGISTRY, getCommunicationRegistryEntry } from './registry'

export type CommunicationPreferenceKey =
  | 'communityReplies'
  | 'communityMentions'
  | 'announcements'
  | 'moderationOutcomes'
  | 'groupChanges'
  | 'communityDigest'
  | 'learningReminders'
  | 'partnerUpdates'
  | 'billingReminders'
  | 'broadcasts'

export type MemberCommunicationPreferences = Record<CommunicationPreferenceKey, boolean>

const defaultPreferences: MemberCommunicationPreferences = {
  communityReplies: true,
  communityMentions: true,
  announcements: true,
  moderationOutcomes: true,
  groupChanges: true,
  communityDigest: false,
  learningReminders: false,
  partnerUpdates: true,
  billingReminders: false,
  broadcasts: false,
}

export function buildDefaultMemberCommunicationPreferences(): MemberCommunicationPreferences {
  return { ...defaultPreferences }
}

export function sanitizeMemberCommunicationPreferences(
  input: Partial<MemberCommunicationPreferences> | null | undefined,
): MemberCommunicationPreferences {
  const next = buildDefaultMemberCommunicationPreferences()
  for (const key of Object.keys(next) as CommunicationPreferenceKey[]) {
    const value = input?.[key]
    if (typeof value === 'boolean') next[key] = value
  }
  return next
}

export function canDisableCommunication(key: string): boolean {
  const entry = getCommunicationRegistryEntry(key)
  return Boolean(entry && !entry.required && entry.preferenceKey)
}

export function preferenceKeyForCommunication(key: string): CommunicationPreferenceKey | null {
  const entry = getCommunicationRegistryEntry(key)
  if (!entry?.preferenceKey) return null
  return entry.preferenceKey as CommunicationPreferenceKey
}

export function communicationPreferenceDefaults(): Record<CommunicationPreferenceKey, boolean> {
  return buildDefaultMemberCommunicationPreferences()
}

export function registeredPreferenceKeys(): CommunicationPreferenceKey[] {
  return Object.keys(defaultPreferences) as CommunicationPreferenceKey[]
}

export function isRequiredPreferenceKey(key: CommunicationPreferenceKey): boolean {
  return COMMUNICATION_REGISTRY.some((entry) => entry.preferenceKey === key && entry.required)
}
