import { quotePgIdentifier } from '@/lib/payloadMigrationSchema'

const schemaIdentifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/
const tableName = 'payload_member_verification_tokens'
const purposeTypeName = 'enum_payload_member_verification_tokens_purpose'
const purpose = 'member_email_verification'

export function getMemberEmailVerificationSchema(databaseUrl = process.env.DATABASE_URL): string {
  if (!databaseUrl) throw new Error('DATABASE_URL is required for member email verification migration SQL')

  let schema: string | null
  try {
    schema = new URL(databaseUrl).searchParams.get('schema')
  } catch {
    throw new Error('Malformed DATABASE_URL')
  }

  if (!schema) throw new Error('DATABASE_URL must include an explicit schema parameter')
  if (!schemaIdentifierPattern.test(schema)) {
    throw new Error(`Invalid Payload migration schema: ${schema}`)
  }
  return schema
}

export function buildMemberEmailVerificationUpSql(
  databaseUrl = process.env.DATABASE_URL,
): string {
  const schemaName = getMemberEmailVerificationSchema(databaseUrl)
  const schema = quotePgIdentifier(schemaName)
  const table = `${schema}.${quotePgIdentifier(tableName)}`
  const purposeType = `${schema}.${quotePgIdentifier(purposeTypeName)}`

  return `
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = '${schemaName}'
      AND t.typname = '${purposeTypeName}'
  ) THEN
    CREATE TYPE ${purposeType} AS ENUM ('${purpose}');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS ${table} (
  "id" serial PRIMARY KEY NOT NULL,
  "member_id" integer NOT NULL,
  "email" varchar NOT NULL,
  "purpose" ${purposeType} DEFAULT '${purpose}' NOT NULL,
  "token_digest" varchar(64) NOT NULL,
  "expires_at" timestamp(3) with time zone NOT NULL,
  "consumed_at" timestamp(3) with time zone,
  "invalidated_at" timestamp(3) with time zone,
  "last_sent_at" timestamp(3) with time zone,
  "send_attempts" numeric DEFAULT 0 NOT NULL,
  "idempotency_key" varchar(64) NOT NULL,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "payload_member_verification_tokens_member_fk"
    FOREIGN KEY ("member_id") REFERENCES ${schema}."payload_members"("id") ON DELETE CASCADE,
  CONSTRAINT "payload_member_verification_tokens_send_attempts_nonnegative"
    CHECK ("send_attempts" >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "payload_member_verification_tokens_digest_unique"
  ON ${table} ("token_digest");
CREATE UNIQUE INDEX IF NOT EXISTS "payload_member_verification_tokens_idempotency_unique"
  ON ${table} ("idempotency_key");
CREATE INDEX IF NOT EXISTS "payload_member_verification_tokens_member_purpose_idx"
  ON ${table} ("member_id", "purpose");
CREATE INDEX IF NOT EXISTS "payload_member_verification_tokens_expires_idx"
  ON ${table} ("expires_at");
CREATE UNIQUE INDEX IF NOT EXISTS "payload_member_verification_tokens_one_active"
  ON ${table} ("member_id", "purpose")
  WHERE "consumed_at" IS NULL AND "invalidated_at" IS NULL;
`
}

export function buildMemberEmailVerificationDownSql(
  databaseUrl = process.env.DATABASE_URL,
): string {
  const schemaName = getMemberEmailVerificationSchema(databaseUrl)
  const schema = quotePgIdentifier(schemaName)
  const table = `${schema}.${quotePgIdentifier(tableName)}`
  const purposeType = `${schema}.${quotePgIdentifier(purposeTypeName)}`

  return `
DROP TABLE IF EXISTS ${table};
DROP TYPE IF EXISTS ${purposeType};
`
}

export function buildReplaceActiveVerificationSql(schemaName: string): string {
  const schema = quotePgIdentifier(schemaName)
  const table = `${schema}.${quotePgIdentifier(tableName)}`
  return `
WITH invalidated AS (
  UPDATE ${table}
  SET "invalidated_at" = $7::timestamptz,
      "updated_at" = $7::timestamptz
  WHERE "member_id" = $1::integer
    AND "purpose" = '${purpose}'
    AND "consumed_at" IS NULL
    AND "invalidated_at" IS NULL
)
INSERT INTO ${table} (
  "member_id", "email", "purpose", "token_digest", "expires_at", "last_sent_at",
  "send_attempts", "idempotency_key", "created_at", "updated_at"
)
VALUES (
  $1::integer, $2::varchar, '${purpose}', $3::varchar, $4::timestamptz, $5::timestamptz,
  $6::numeric, $8::varchar, $7::timestamptz, $7::timestamptz
)
RETURNING "id";
`
}

export function buildConsumeVerificationSql(schemaName: string): string {
  const schema = quotePgIdentifier(schemaName)
  const table = `${schema}.${quotePgIdentifier(tableName)}`
  return `
UPDATE ${table}
SET "consumed_at" = $2::timestamptz,
    "updated_at" = $2::timestamptz
WHERE "token_digest" = $1::varchar
  AND "consumed_at" IS NULL
  AND "invalidated_at" IS NULL
  AND "expires_at" > $2::timestamptz
RETURNING "member_id";
`
}
