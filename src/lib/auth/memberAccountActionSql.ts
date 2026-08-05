import { quotePgIdentifier } from '@/lib/payloadMigrationSchema'

const tableName = 'payload_member_verification_tokens'

function accountActionTable(schemaName: string): string {
  return `${quotePgIdentifier(schemaName)}.${quotePgIdentifier(tableName)}`
}

export function buildReplaceActiveMemberAccountActionSql(schemaName: string): string {
  const table = accountActionTable(schemaName)

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
  "updated_at" = EXCLUDED."updated_at",
  "reservation_nonce" = NULL,
  "reserved_at" = NULL,
  "lease_expires_at" = NULL,
  "result_fingerprint" = NULL
WHERE (
    ${table}."reservation_nonce" IS NULL
    OR ${table}."lease_expires_at" <= now()
  )
  AND ${table}."result_fingerprint" IS NULL
RETURNING "id";
`
}

export function buildReserveMemberAccountActionSql(schemaName: string): string {
  const table = accountActionTable(schemaName)

  return `
WITH candidate AS (
  SELECT
    "id",
    ("reservation_nonce" IS NOT NULL) AS "reclaimed"
  FROM ${table}
  WHERE "token_digest" = $1::varchar
    AND "purpose" = $2
    AND "consumed_at" IS NULL
    AND "invalidated_at" IS NULL
    AND "expires_at" > now()
    AND (
      "reservation_nonce" IS NULL
      OR "lease_expires_at" <= now()
    )
  ORDER BY "id" ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED
), reserved AS (
  UPDATE ${table} AS action
  SET "reservation_nonce" = $3::varchar,
      "reserved_at" = now(),
      "lease_expires_at" = now() + ($4::bigint * interval '1 millisecond'),
      "updated_at" = now()
  FROM candidate
  WHERE action."id" = candidate."id"
  RETURNING
    action."member_id",
    action."email",
    action."reservation_nonce",
    action."reserved_at",
    action."lease_expires_at",
    action."result_fingerprint",
    candidate."reclaimed"
)
SELECT
  "member_id",
  "email",
  "reservation_nonce",
  "reserved_at",
  "lease_expires_at",
  "result_fingerprint",
  "reclaimed"
FROM reserved;
`
}

export function buildMarkMemberAccountActionMutationStartedSql(schemaName: string): string {
  const table = accountActionTable(schemaName)

  return `
UPDATE ${table}
SET "result_fingerprint" = $4::varchar,
    "updated_at" = now()
WHERE "token_digest" = $1::varchar
  AND "purpose" = $2
  AND "reservation_nonce" = $3::varchar
  AND "consumed_at" IS NULL
  AND "invalidated_at" IS NULL
  AND "lease_expires_at" > now()
  AND ("result_fingerprint" IS NULL OR "result_fingerprint" = $4::varchar)
RETURNING "member_id", "email", "result_fingerprint";
`
}

export function buildFinalizeMemberAccountActionSql(schemaName: string): string {
  const table = accountActionTable(schemaName)

  return `
UPDATE ${table}
SET "consumed_at" = now(),
    "result_fingerprint" = $4::varchar,
    "reservation_nonce" = NULL,
    "reserved_at" = NULL,
    "lease_expires_at" = NULL,
    "updated_at" = now()
WHERE "token_digest" = $1::varchar
  AND "purpose" = $2
  AND "reservation_nonce" = $3::varchar
  AND "result_fingerprint" = $4::varchar
  AND "consumed_at" IS NULL
  AND "invalidated_at" IS NULL
  AND "lease_expires_at" > now()
RETURNING "member_id", "email", "result_fingerprint", "consumed_at";
`
}

export function buildReleaseMemberAccountActionSql(schemaName: string): string {
  const table = accountActionTable(schemaName)

  return `
UPDATE ${table}
SET "reservation_nonce" = NULL,
    "reserved_at" = NULL,
    "lease_expires_at" = NULL,
    "result_fingerprint" = NULL,
    "updated_at" = now()
WHERE "token_digest" = $1::varchar
  AND "purpose" = $2
  AND "reservation_nonce" = $3::varchar
  AND "consumed_at" IS NULL
  AND "invalidated_at" IS NULL
RETURNING "member_id";
`
}

export function buildFindCompletedMemberAccountActionSql(schemaName: string): string {
  const table = accountActionTable(schemaName)

  return `
SELECT "member_id", "email", "result_fingerprint", "consumed_at"
FROM ${table}
WHERE "token_digest" = $1::varchar
  AND "purpose" = $2
  AND "consumed_at" IS NOT NULL
ORDER BY "id" ASC
LIMIT 1;
`
}
