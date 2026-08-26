import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  SUPPORT_DEDUPE_WINDOW_MS,
  SUPPORT_NOTIFICATION_RETRY_MS,
  buildSupportDedupeKey,
  createSupportIntakeService,
  type SupportIntakeDependencies,
  type SupportIntakeInput,
  type SupportRequestCreateData,
  type SupportRequestUpdateData,
} from '../src/lib/support/supportIntake'

const fixedNow = new Date('2026-07-12T12:15:00.000Z')
const input: SupportIntakeInput = {
  normalizedEmail: 'person@example.com',
  name: '  Example   Person ',
  phone: '+441234567890',
  question: '  How can I access the programme?  ',
  source: ' footer modal ',
  page: ' / ',
}

function uniqueDedupeConflict(): Error & { code: string; meta: { target: string[] } } {
  return Object.assign(new Error('unique conflict'), {
    code: 'P2002',
    meta: { target: ['dedupe_key'] },
  })
}

function baseDependencies(overrides: Partial<SupportIntakeDependencies> = {}): SupportIntakeDependencies {
  return {
    async createRequest() {
      return { id: 'request-1' }
    },
    async updateRequest() {},
    async queueNotification() {},
    now: () => fixedNow,
    log() {},
    ...overrides,
  }
}

function testDedupePolicy(): void {
  const first = buildSupportDedupeKey(input, fixedNow)
  const equivalent = buildSupportDedupeKey(
    {
      ...input,
      normalizedEmail: 'PERSON@EXAMPLE.COM',
      name: 'example person',
      question: 'how can i access the programme?',
      source: 'footer modal',
      page: '/',
    },
    new Date(fixedNow.getTime() + 5 * 60_000),
  )
  const nextWindow = buildSupportDedupeKey(
    input,
    new Date(fixedNow.getTime() + SUPPORT_DEDUPE_WINDOW_MS),
  )
  const distinct = buildSupportDedupeKey(
    { ...input, question: 'How can I reset my account?' },
    fixedNow,
  )

  assert.match(first, /^[a-f0-9]{64}$/)
  assert.equal(first, equivalent)
  assert.notEqual(first, nextWindow)
  assert.notEqual(first, distinct)
  for (const raw of [input.normalizedEmail, input.name, input.question, input.source!, input.page!]) {
    assert.equal(first.includes(raw.trim()), false)
  }
}

async function testPersistenceBeforeQueueAndSafeSuccess(): Promise<void> {
  const order: string[] = []
  let created: SupportRequestCreateData | null = null
  let updated: SupportRequestUpdateData | null = null
  let queued: { requestId: string; dedupeKey: string; reviewStatus: 'pending' } | null = null

  const service = createSupportIntakeService(
    baseDependencies({
      async createRequest(data) {
        order.push('persist')
        created = data
        return { id: 'request-1' }
      },
      async queueNotification(data) {
        order.push('queue')
        queued = data
      },
      async updateRequest(_id, data) {
        order.push('update')
        updated = data
      },
    }),
  )

  const result = await service(input)
  assert.deepEqual(order, ['persist', 'queue', 'update'])
  assert.deepEqual(result, {
    ok: true,
    accepted: true,
    duplicate: false,
    notification: 'queued',
  })
  assert.equal(created?.normalizedEmail, input.normalizedEmail)
  assert.equal(created?.reviewStatus, 'pending')
  assert.equal(created?.notificationStatus, 'pending')
  assert.equal(created?.notificationAttemptCount, 0)
  assert.match(created?.dedupeKey ?? '', /^[a-f0-9]{64}$/)
  assert.deepEqual(queued, {
    requestId: 'request-1',
    dedupeKey: 'support-request-notification:request-1',
    reviewStatus: 'pending',
    requesterEmail: input.normalizedEmail,
    requesterName: input.name,
    requesterPhone: input.phone,
  })
  assert.equal(updated?.notificationStatus, 'queued')
  assert.equal(updated?.notificationAttemptCount, 1)
  assert.equal(updated?.notificationNextAttemptAt, null)
  assert.equal(updated?.notificationLastErrorCode, null)
}

async function testPersistenceFailureStopsQueue(): Promise<void> {
  let queueCalls = 0
  let updateCalls = 0
  const logs: unknown[] = []
  const service = createSupportIntakeService(
    baseDependencies({
      async createRequest() {
        throw new Error('database detail that must not escape')
      },
      async queueNotification() {
        queueCalls += 1
      },
      async updateRequest() {
        updateCalls += 1
      },
      log(event) {
        logs.push(event)
      },
    }),
  )

  const result = await service(input)
  assert.deepEqual(result, {
    ok: false,
    code: 'support_persistence_unavailable',
    retryable: true,
  })
  assert.equal(queueCalls, 0)
  assert.equal(updateCalls, 0)
  const serialized = JSON.stringify(logs)
  assert.equal(serialized.includes(input.normalizedEmail), false)
  assert.equal(serialized.includes(input.question.trim()), false)
  assert.equal(serialized.includes('database detail'), false)
}

async function testDuplicateSkipsQueue(): Promise<void> {
  let queueCalls = 0
  const service = createSupportIntakeService(
    baseDependencies({
      async createRequest() {
        throw uniqueDedupeConflict()
      },
      async queueNotification() {
        queueCalls += 1
      },
    }),
  )

  const result = await service(input)
  assert.deepEqual(result, {
    ok: true,
    accepted: true,
    duplicate: true,
    notification: 'not_queued',
  })
  assert.equal(queueCalls, 0)
}

async function testConcurrentDuplicateCreatesOneRequest(): Promise<void> {
  let created = false
  let createCount = 0
  let queueCount = 0
  const dependencies = baseDependencies({
    async createRequest() {
      await Promise.resolve()
      if (created) throw uniqueDedupeConflict()
      created = true
      createCount += 1
      return { id: 'request-concurrent' }
    },
    async queueNotification() {
      queueCount += 1
    },
  })
  const service = createSupportIntakeService(dependencies)
  const results = await Promise.all([service(input), service(input)])

  assert.equal(createCount, 1)
  assert.equal(queueCount, 1)
  assert.equal(results.filter((result) => result.ok && result.duplicate).length, 1)
  assert.equal(results.filter((result) => result.ok && !result.duplicate).length, 1)
}

async function testQueueFailurePreservesAcceptanceAndRetryState(): Promise<void> {
  let update: SupportRequestUpdateData | null = null
  const logs: unknown[] = []
  const service = createSupportIntakeService(
    baseDependencies({
      async queueNotification() {
        throw new Error('provider response with private detail')
      },
      async updateRequest(_id, data) {
        update = data
      },
      log(event) {
        logs.push(event)
      },
    }),
  )

  const result = await service(input)
  assert.deepEqual(result, {
    ok: true,
    accepted: true,
    duplicate: false,
    notification: 'retry_pending',
  })
  assert.equal(update?.notificationStatus, 'retry_pending')
  assert.equal(update?.notificationAttemptCount, 1)
  assert.equal(update?.notificationLastAttemptAt.toISOString(), fixedNow.toISOString())
  assert.equal(
    update?.notificationNextAttemptAt?.toISOString(),
    new Date(fixedNow.getTime() + SUPPORT_NOTIFICATION_RETRY_MS).toISOString(),
  )
  assert.equal(update?.notificationLastErrorCode, 'support_notification_queue_failed')

  const serialized = JSON.stringify(logs)
  for (const forbidden of [input.normalizedEmail, input.question.trim(), 'provider response']) {
    assert.equal(serialized.includes(forbidden), false)
  }
}

function testRouteAndFormContracts(): void {
  const route = readFileSync('src/app/api/support/route.ts', 'utf8')
  const page = readFileSync('src/app/(frontend)/page.tsx', 'utf8')
  const schema = readFileSync('prisma/system.prisma', 'utf8')
  const migration = readFileSync(
    'prisma/migrations/20260712_151700_add_support_requests/migration.sql',
    'utf8',
  )

  const guardIndex = route.indexOf('guardPublicRequest(req')
  const serviceIndex = route.indexOf('const service = createSupportIntakeService')
  const persistenceIndex = route.indexOf('prisma.supportRequest.create')
  assert.ok(guardIndex >= 0 && guardIndex < serviceIndex && serviceIndex < persistenceIndex)
  assert.match(route, /SUPPORT_REQUEST_ADMIN_NOTIFICATION_TEMPLATE_KEY/)
  assert.match(route, /supportRequestId: input\.requestId/)
  assert.equal(route.includes('guarded.data.question,'), true)
  assert.equal(route.includes('guarded.data.phone'), true)
  assert.equal(route.includes('metadata: {\n          question:'), false)
  assert.equal(route.includes('sendSupportEmail'), false)
  assert.equal(route.includes('sponsoredApplication'), false)
  assert.match(route, /accepted: true/)
  assert.match(route, /duplicate: result\.duplicate/)
  assert.match(route, /error: result\.code/)
  assert.equal(route.includes('reference'), false)

  assert.match(page, /payload\?\.ok && payload\.accepted/)
  assert.match(page, /supportStatus === "sending"/)
  assert.match(page, /disabled=\{isSupportSending\}/)
  assert.match(page, /support-phone/)
  assert.match(page, /0208 092 2398/)
  assert.match(page, /Structured Learning/)
  assert.match(page, /Practical Application/)
  assert.match(page, /Live Experiences/)
  assert.match(page, /Community Support/)
  assert.equal(page.includes('name: "Raouda"'), false)
  assert.match(page, /pillar-structured-learning\.png/)
  assert.match(page, /pillar-practical-application\.png/)
  assert.match(page, /pillar-live-experiences\.png/)
  assert.match(page, /pillar-community-support\.png/)
  assert.match(page, /saved for review/)
  assert.match(page, /Saving your request/)
  assert.match(page, /We could not save your request\. Please try again shortly\./)
  assert.equal(page.includes('Support request failed:'), false)
  assert.equal(page.includes('reference'), false)
  assert.equal(page.includes('email was delivered'), false)

  assert.match(schema, /model SupportRequest \{/)
  assert.match(schema, /dedupeKey\s+String\s+@unique/)
  assert.match(schema, /phone\s+String\?\s+@map\("phone"\)/)
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS "support_requests_dedupe_key_key"/)

  const landingStyles = readFileSync('src/app/(frontend)/landing.module.scss', 'utf8')
  assert.match(landingStyles, /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/)
  assert.match(landingStyles, /aspect-ratio: 4 \/ 3/)
  assert.match(landingStyles, /grid-column: auto/)
}

async function main(): Promise<void> {
  testDedupePolicy()
  await testPersistenceBeforeQueueAndSafeSuccess()
  await testPersistenceFailureStopsQueue()
  await testDuplicateSkipsQueue()
  await testConcurrentDuplicateCreatesOneRequest()
  await testQueueFailurePreservesAcceptanceAndRetryState()
  testRouteAndFormContracts()
  console.log('support intake runtime tests passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
