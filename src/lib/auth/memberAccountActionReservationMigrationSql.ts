import { getMemberEmailVerificationSchema } from './memberEmailVerificationSql'
import { quotePgIdentifier } from '@/lib/payloadMigrationSchema'

const tableName = 'payload_member_verification_tokens'
const stateConstraint = 'payload_member_verification_tokens_reservation_state_check'
const resultConstraint = 'payload_member_verification_tokens_result_state_check'
const leaseIndex = 'payload_member_verification_tokens_active_lease_idx'
const fingerprintIndex = 'payload_member_verification_tokens_result_fingerprint_idx'

export function buildMemberAccountActionReservationUpSql(
  databaseUrl = process.env.DATABASE_URL,
): string {
  const schemaName = getMemberEmailVerificationSchema(databaseUrl)
  const schema = quotePgIdentifier(schemaName)
  const table = `${schema}.${quotePgIdentifier(tableName)}`

  return `
ALTER TABLE ${table}
  ADD COLUMN IF NOT EXISTS "reservation_nonce" varchar(64),
  ADD COLUMN IF NOT EXISTS "reserved_at" timestamp(3) with time zone,
  ADD COLUMN IF NOT EXISTS "lease_expires_at" timestamp(3) with time zone,
  ADD COLUMN IF NOT EXISTS "result_fingerprint" varchar(64);

ALTER TABLE ${table}
  DROP CONSTRAINT IF EXISTS ${quotePgIdentifier(stateConstraint)},
  ADD CONSTRAINT ${quotePgIdentifier(stateConstraint)} CHECK (
    (
      "reservation_nonce" IS NULL
      AND "reserved_at" IS NULL
      AND "lease_expires_at" IS NULL
    )
    OR
    (
      "reservation_nonce" IS NOT NULL
      AND "reserved_at" IS NOT NULL
      AND "lease_expires_at" IS NOT NULL
      AND "consumed_at" IS NULL
      AND "invalidated_at" IS NULL
      AND "lease_expires_at" > "reserved_at"
    )
  ) NOT VALID,
  DROP CONSTRAINT IF EXISTS ${quotePgIdentifier(resultConstraint)},
  ADD CONSTRAINT ${quotePgIdentifier(resultConstraint)} CHECK (
    "result_fingerprint" IS NULL
    OR "reservation_nonce" IS NOT NULL
    OR "consumed_at" IS NOT NULL
  ) NOT VALID;

ALTER TABLE ${table}
  VALIDATE CONSTRAINT ${quotePgIdentifier(stateConstraint)};
ALTER TABLE ${table}
  VALIDATE CONSTRAINT ${quotePgIdentifier(resultConstraint)};

CREATE INDEX IF NOT EXISTS ${quotePgIdentifier(leaseIndex)}
  ON ${table} ("lease_expires_at")
  WHERE "consumed_at" IS NULL
    AND "invalidated_at" IS NULL
    AND "reservation_nonce" IS NOT NULL;

CREATE INDEX IF NOT EXISTS ${quotePgIdentifier(fingerprintIndex)}
  ON ${table} ("result_fingerprint")
  WHERE "result_fingerprint" IS NOT NULL;
`
}

export function buildMemberAccountActionReservationDownSql(
  databaseUrl = process.env.DATABASE_URL,
): string {
  const schemaName = getMemberEmailVerificationSchema(databaseUrl)
  const schema = quotePgIdentifier(schemaName)
  const table = `${schema}.${quotePgIdentifier(tableName)}`

  return `
DROP INDEX IF EXISTS ${schema}.${quotePgIdentifier(fingerprintIndex)};
DROP INDEX IF EXISTS ${schema}.${quotePgIdentifier(leaseIndex)};

ALTER TABLE ${table}
  DROP CONSTRAINT IF EXISTS ${quotePgIdentifier(resultConstraint)},
  DROP CONSTRAINT IF EXISTS ${quotePgIdentifier(stateConstraint)},
  DROP COLUMN IF EXISTS "result_fingerprint",
  DROP COLUMN IF EXISTS "lease_expires_at",
  DROP COLUMN IF EXISTS "reserved_at",
  DROP COLUMN IF EXISTS "reservation_nonce";
`
}
