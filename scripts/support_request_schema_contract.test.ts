import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const schema = readFileSync('prisma/system.prisma', 'utf8')
const supportRoute = readFileSync('src/app/api/support/route.ts', 'utf8')

const modelMatch = schema.match(/model SupportRequest \{([\s\S]*?)\n\}/)
assert.ok(modelMatch, 'system Prisma schema must define SupportRequest')
const model = modelMatch?.[1] ?? ''

const requiredFields = [
  'id',
  'createdAt',
  'updatedAt',
  'normalizedEmail',
  'name',
  'phone',
  'question',
  'source',
  'page',
  'dedupeKey',
  'reviewStatus',
  'notificationStatus',
  'notificationAttemptCount',
  'notificationLastAttemptAt',
  'notificationNextAttemptAt',
  'notificationLastErrorCode',
  'reviewedAt',
  'reviewedByAccountId',
]

for (const field of requiredFields) {
  assert.match(model, new RegExp(`\\b${field}\\b`), `SupportRequest must include ${field}`)
}

assert.match(model, /id\s+String\s+@id\s+@default\(dbgenerated\("gen_random_uuid\(\)"\)\)\s+@db\.Uuid/)
assert.match(model, /dedupeKey\s+String\s+@unique\s+@map\("dedupe_key"\)/)
assert.match(model, /reviewStatus\s+String\s+@default\("pending"\)/)
assert.match(model, /notificationStatus\s+String\s+@default\("pending"\)/)
assert.match(model, /notificationAttemptCount\s+Int\s+@default\(0\)/)
assert.match(model, /@@index\(\[normalizedEmail\]\)/)
assert.match(model, /@@index\(\[reviewStatus\]\)/)
assert.match(model, /@@index\(\[notificationStatus\]\)/)
assert.match(model, /@@index\(\[createdAt\]\)/)
assert.match(model, /@@map\("support_requests"\)/)

for (const forbidden of [
  'SponsoredSeat',
  'SponsoredGrant',
  'CustomerProvisioning',
  'accountId',
  'tier',
  'claimToken',
  'entitlement',
]) {
  assert.equal(model.includes(forbidden), false, `SupportRequest must not couple to ${forbidden}`)
}

assert.match(supportRoute, /guardPublicRequest\(req/)
assert.match(supportRoute, /prisma\.supportRequest\.create/)
assert.match(supportRoute, /isValidInternationalPhone/)
assert.match(supportRoute, /queueAndAttemptEmailEvent/)
assert.match(supportRoute, /accepted:\s*true/)
assert.match(supportRoute, /duplicate:\s*result\.duplicate/)
assert.match(supportRoute, /status:\s*503/)
assert.equal(supportRoute.includes("error: 'preview_only'"), false)
assert.equal(supportRoute.includes('SponsoredApplication'), false)
assert.equal(supportRoute.includes('SponsoredGrant'), false)

console.log('support request schema contract test passed')
