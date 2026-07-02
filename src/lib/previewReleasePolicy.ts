export const PREVIEW_RELEASE_SCHEMA_VERSION = 1

export const REQUIRED_PAYLOAD_MIGRATIONS = [
  '20260701_201500_member_email_verification',
  '20260702_001500_member_account_action_purposes',
] as const

export const ACCOUNT_EMAIL_PROVIDER_FLOWS = [
  'member-email-verification',
  'member-invitation',
  'member-password-reset',
  'member-password-changed',
  'member-email-change-confirmation',
  'member-email-change-requested',
  'member-email-changed',
  'access-blocked',
  'access-restored',
] as const

export type PreviewReleaseAuthorizationCategory =
  | 'gitPush'
  | 'imagePublication'
  | 'payloadMigration'
  | 'prismaDatabaseDeploy'
  | 'providerDryRun'
  | 'providerApply'
  | 'previewDeployment'
  | 'smokeVerification'

export const PREVIEW_RELEASE_AUTHORIZATION_CATEGORIES = [
  'gitPush',
  'imagePublication',
  'payloadMigration',
  'prismaDatabaseDeploy',
  'providerDryRun',
  'providerApply',
  'previewDeployment',
  'smokeVerification',
] as const satisfies readonly PreviewReleaseAuthorizationCategory[]

export function isFullGitSha(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-fA-F]{40}$/.test(value)
}

export function isImmutableImageReference(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false
  if (/:latest(?:$|@)/.test(value)) return false
  if (!value.includes('/')) return false
  if (value.includes('@sha256:')) return true
  const tag = value.split(':').at(-1)
  return Boolean(tag && /^[0-9a-fA-F]{40}$/.test(tag))
}

export function hasExactMigrationOrder(value: unknown): value is string[] {
  return Array.isArray(value) &&
    value.length === REQUIRED_PAYLOAD_MIGRATIONS.length &&
    REQUIRED_PAYLOAD_MIGRATIONS.every((migration, index) => value[index] === migration)
}

export function knownProviderFlows(flows: unknown): flows is string[] {
  return Array.isArray(flows) &&
    flows.length > 0 &&
    flows.every((flow) =>
      typeof flow === 'string' &&
      (ACCOUNT_EMAIL_PROVIDER_FLOWS as readonly string[]).includes(flow)
    )
}
