import { quotePgIdentifier } from '@/lib/payloadMigrationSchema'

const tableName = 'payload_member_verification_tokens'

export function buildReplaceActiveMemberAccountActionSql(schemaName: string): string {
  const schema = quotePgIdentifier(schemaName)
  const table = `${schema}.${quotePgIdentifier(tableName)}`

  return `
INSERT INTO ${table} (
  "member_id", "email", "purpose", "token_digest", "expires_at", "last_sent_at",
  "send_attempts", "idempotency_key", "created_at", "updated_at"
)
VALUES (
  $1::integer, $2::varchar, $3, $4::varchar, $5::timestamptz, $6::timestamptz,
  $7::numeric, $9::varchar, $8::timestamptz, $8::timestamptz
)
ON CONFLICT ("member_id", "purpose")
WHERE "consumed_at" IS NULL AND "invalidated_at" IS NULL
DO UPDATE SET
  "email" = EXCLUDED."email",
  "token_digest" = EXCLUDED."token_digest",
  "expires_at" = EXCLUDED."expires_at",
  "last_sent_at" = EXCLUDED."last_sent_at",
  "send_attempts" = EXCLUDED."send_attempts",
  "idempotency_key" = EXCLUDED."idempotency_key",
  "created_at" = EXCLUDED."created_at",
  "updated_at" = EXCLUDED."updated_at"
RETURNING "id";
`
}

export function buildConsumeMemberAccountActionSql(schemaName: string): string {
  const schema = quotePgIdentifier(schemaName)
  const table = `${schema}.${quotePgIdentifier(tableName)}`

  return `
UPDATE ${table}
SET "consumed_at" = $3::timestamptz,
    "updated_at" = $3::timestamptz
WHERE "token_digest" = $1::varchar
  AND "purpose" = $2
  AND "consumed_at" IS NULL
  AND "invalidated_at" IS NULL
  AND "expires_at" > $3::timestamptz
RETURNING "member_id";
`
}
