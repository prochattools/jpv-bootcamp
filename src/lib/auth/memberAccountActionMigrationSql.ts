import { quotePgIdentifier } from '@/lib/payloadMigrationSchema'
import { getMemberEmailVerificationSchema } from './memberEmailVerificationSql'

const actionPurposeType = 'enum_payload_member_verification_tokens_purpose'
const securityEventType = 'enum_payload_member_security_events_event_type'

export const MEMBER_ACCOUNT_ACTION_PURPOSES = [
  'member_invitation',
  'set_password',
  'password_reset',
  'email_change_confirmation',
] as const

export const MEMBER_ACCOUNT_SECURITY_EVENTS = [
  'invitation_created',
  'invitation_consumed',
  'profile_changed',
  'email_change_requested',
  'email_changed',
  'account_suspended',
  'account_deleted',
] as const

function addEnumValueSql(typeName: string, value: string): string {
  return `ALTER TYPE ${typeName} ADD VALUE IF NOT EXISTS '${value}';`
}

export function buildMemberAccountActionPurposeUpSql(
  databaseUrl = process.env.DATABASE_URL,
): string {
  const schemaName = getMemberEmailVerificationSchema(databaseUrl)
  const schema = quotePgIdentifier(schemaName)
  const purposeType = `${schema}.${quotePgIdentifier(actionPurposeType)}`
  const eventType = `${schema}.${quotePgIdentifier(securityEventType)}`

  return [
    ...MEMBER_ACCOUNT_ACTION_PURPOSES.map((value) => addEnumValueSql(purposeType, value)),
    ...MEMBER_ACCOUNT_SECURITY_EVENTS.map((value) => addEnumValueSql(eventType, value)),
  ].join('\n')
}

export function buildMemberAccountActionPurposeDownSql(): string {
  return '-- PostgreSQL enum values are intentionally retained on rollback to avoid destructive type recreation.'
}
