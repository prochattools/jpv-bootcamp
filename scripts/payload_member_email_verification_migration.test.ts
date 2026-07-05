import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { PayloadMemberVerificationRecords } from '../src/collections/members/MemberEmailVerificationRecords'
import {
  buildConsumeVerificationSql,
  buildMemberEmailVerificationDownSql,
  buildMemberEmailVerificationUpSql,
  buildInsertVerificationSql,
  buildInvalidateActiveVerificationSql,
  buildReplaceActiveVerificationSql,
  getMemberEmailVerificationSchema,
} from '../src/lib/auth/memberEmailVerificationSql'

const stagingUrl = 'postgresql://redacted.invalid/app?schema=jpvbootcamp_staging'
const upSql = buildMemberEmailVerificationUpSql(stagingUrl)
const downSql = buildMemberEmailVerificationDownSql(stagingUrl)
const replaceSql = buildReplaceActiveVerificationSql('jpvbootcamp_staging')
const invalidateSql = buildInvalidateActiveVerificationSql('jpvbootcamp_staging')
const insertSql = buildInsertVerificationSql('jpvbootcamp_staging')
const consumeSql = buildConsumeVerificationSql('jpvbootcamp_staging')

assert.equal(getMemberEmailVerificationSchema(stagingUrl), 'jpvbootcamp_staging')
assert.throws(() => getMemberEmailVerificationSchema(), /DATABASE_URL is required/)
assert.throws(
  () => getMemberEmailVerificationSchema('postgresql://redacted.invalid/app'),
  /explicit schema/,
)
assert.throws(
  () => getMemberEmailVerificationSchema('postgresql://redacted.invalid/app?schema=unsafe-name'),
  /Invalid Payload migration schema/,
)

assert.match(upSql, /CREATE TABLE IF NOT EXISTS "jpvbootcamp_staging"\."payload_member_verification_tokens"/)
assert.match(upSql, /"email" varchar NOT NULL/)
assert.match(upSql, /"token_digest" varchar\(64\) NOT NULL/)
assert.match(upSql, /payload_member_verification_tokens_digest_unique/)
assert.match(upSql, /payload_member_verification_tokens_idempotency_unique/)
assert.match(upSql, /payload_member_verification_tokens_one_active/)
assert.match(upSql, /WHERE "consumed_at" IS NULL AND "invalidated_at" IS NULL/)
assert.match(upSql, /FOREIGN KEY \("member_id"\)/)
assert.match(upSql, /ON DELETE CASCADE/)
assert.doesNotMatch(upSql, /^\s*DELETE\s+FROM\b/im)
assert.doesNotMatch(upSql, /\bTRUNCATE\b/i)
assert.doesNotMatch(upSql, /UPDATE\s+"jpvbootcamp_staging"\."payload_members"/i)

assert.match(replaceSql, /WITH invalidated AS/)
assert.match(replaceSql, /UPDATE "jpvbootcamp_staging"\."payload_member_verification_tokens"/)
assert.match(replaceSql, /INSERT INTO "jpvbootcamp_staging"\."payload_member_verification_tokens"/)
assert.match(replaceSql, /\$1::integer/)
assert.match(replaceSql, /\$8::varchar/)
assert.doesNotMatch(replaceSql, /verification-token-value/)

assert.match(invalidateSql, /UPDATE "jpvbootcamp_staging"\."payload_member_verification_tokens"/)
assert.match(invalidateSql, /SET "invalidated_at" = \$2::timestamptz/)
assert.doesNotMatch(invalidateSql, /INSERT INTO/)

assert.match(insertSql, /INSERT INTO "jpvbootcamp_staging"\."payload_member_verification_tokens"/)
assert.match(insertSql, /RETURNING "id"/)
assert.doesNotMatch(insertSql, /UPDATE\s+"jpvbootcamp_staging"\."payload_member_verification_tokens"/)

assert.match(consumeSql, /"purpose" = 'member_email_verification'/)
assert.match(consumeSql, /"consumed_at" IS NULL/)
assert.match(consumeSql, /"invalidated_at" IS NULL/)
assert.match(consumeSql, /"expires_at" > \$2::timestamptz/)
assert.match(consumeSql, /RETURNING "member_id"/)
assert.match(downSql, /DROP TABLE IF EXISTS/)
assert.match(downSql, /DROP TYPE IF EXISTS/)
assert.doesNotMatch(downSql, /payload_members/)

assert.equal(PayloadMemberVerificationRecords.slug, 'payload_member_verification_tokens')
assert.equal(PayloadMemberVerificationRecords.admin?.hidden, true)
assert.equal(PayloadMemberVerificationRecords.access?.read instanceof Function, true)
const tokenDigestField = PayloadMemberVerificationRecords.fields.find(
  (field) => 'name' in field && field.name === 'tokenDigest',
)
assert(tokenDigestField && 'unique' in tokenDigestField && tokenDigestField.unique === true)
assert(tokenDigestField && 'index' in tokenDigestField && tokenDigestField.index === true)
assert(tokenDigestField && 'admin' in tokenDigestField && tokenDigestField.admin?.hidden === true)
assert(tokenDigestField && 'access' in tokenDigestField && tokenDigestField.access?.read instanceof Function)

const migrationIndexSource = readFileSync(
  new URL('../src/migrations/index.ts', import.meta.url),
  'utf8',
)
const previousRegistration = migrationIndexSource.lastIndexOf(
  "name: '20260630_190000_payload_preferences_id_constraint'",
)
const verificationRegistration = migrationIndexSource.lastIndexOf(
  "name: '20260701_201500_member_email_verification'",
)
assert(previousRegistration >= 0)
assert(verificationRegistration > previousRegistration)
assert.match(
  migrationIndexSource,
  /import \* as migration_20260701_201500_member_email_verification/,
)

console.log('member email verification migration checks passed')
