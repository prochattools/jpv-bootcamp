import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

import {
  InMemoryBunnyProtectedMediaAdapter,
  redactBunnyDiagnostics,
  resolveBunnyProtectedPlayback,
  type BunnyProtectedVideo,
} from '../src/lib/payloadCourse/bunnyProtectedMedia'

const NOW = new Date('2026-07-18T10:00:00.000Z')

function video(overrides: Partial<BunnyProtectedVideo> = {}): BunnyProtectedVideo {
  return {
    provider: 'bunny_stream',
    videoId: '123e4567-e89b-12d3-a456-426614174000',
    libraryId: '987654',
    lessonId: 'lesson_1',
    title: 'Protected lesson',
    playbackAssetId: 'asset_1',
    thumbnailUrl: 'https://vz-987654.b-cdn.net/123e4567-e89b-12d3-a456-426614174000/thumbnail.jpg',
    status: 'ready',
    ...overrides,
  }
}

function adapter(videos = [video()]) {
  return new InMemoryBunnyProtectedMediaAdapter({ videos, signingKey: 'test_signing_key' })
}

const activeEntitlement = {
  lifecycleState: 'active' as const,
  subscriptionStatus: 'active',
  reconciliationState: 'matched' as const,
  fundingSource: 'direct_payment' as const,
}

async function testReadyAsset() {
  const projection = await resolveBunnyProtectedPlayback({
    adapter: adapter(),
    config: { streamHostname: 'vz-987654.b-cdn.net', signingKey: 'test_signing_key', tokenTtlSeconds: 600 },
    lessonId: 'lesson_1',
    memberId: 'member_1',
    entitlement: activeEntitlement,
    now: NOW,
  })

  assert.equal(projection.available, true)
  if (!projection.available) throw new Error('expected available projection')
  assert.equal(projection.provider, 'bunny_stream')
  assert.equal(projection.status, 'ready')
  assert.equal(projection.libraryId, '987654')
  assert.equal(projection.videoId, '123e4567-e89b-12d3-a456-426614174000')
  assert.equal(projection.playbackAssetId, 'asset_1')
  assert.equal(projection.expiresAt, '2026-07-18T10:10:00.000Z')
  assert.match(projection.token, /^[a-f0-9]{64}$/)

  // Verify Bunny iframe embed token algorithm: SHA256(signingKey + videoId + expiresUnix)
  const expiresUnix = Math.floor(new Date('2026-07-18T10:10:00.000Z').getTime() / 1000)
  const expectedToken = createHash('sha256')
    .update('test_signing_key' + '123e4567-e89b-12d3-a456-426614174000' + String(expiresUnix))
    .digest('hex')
  assert.equal(projection.token, expectedToken, 'token must be SHA256(signingKey+videoId+expiresUnix)')
  assert.equal(projection.expiresUnix, expiresUnix, 'expiresUnix must match')
  // Verify iframeUrl follows official Bunny embed format
  const expectedIframeUrl = `https://iframe.mediadelivery.net/embed/987654/123e4567-e89b-12d3-a456-426614174000?token=${expectedToken}&expires=${expiresUnix}`
  assert.equal(projection.iframeUrl, expectedIframeUrl, 'iframeUrl must use official Bunny embed format')
  // Token must be plain hex — no colons (old colon-delimited format is wrong)
  assert.doesNotMatch(projection.token, /:/, 'token must not contain colons')
}

async function testProcessingAndFailedAssetsFailClosed() {
  const processing = await resolveBunnyProtectedPlayback({
    adapter: adapter([video({ status: 'processing' })]),
    config: { streamHostname: 'vz-987654.b-cdn.net', signingKey: 'test_signing_key' },
    lessonId: 'lesson_1',
    memberId: 'member_1',
    entitlement: activeEntitlement,
    now: NOW,
  })
  assert.deepEqual(processing, {
    available: false,
    provider: 'bunny_stream',
    status: 'processing',
    lessonId: 'lesson_1',
    diagnostics: {},
  })

  const failed = await resolveBunnyProtectedPlayback({
    adapter: adapter([video({ status: 'failed', diagnostics: { providerToken: 'secret', reason: 'transcode_failed' } })]),
    config: { streamHostname: 'vz-987654.b-cdn.net', signingKey: 'test_signing_key' },
    lessonId: 'lesson_1',
    memberId: 'member_1',
    entitlement: activeEntitlement,
    now: NOW,
  })
  assert.equal(failed.available, false)
  if (failed.available) throw new Error('expected failed projection')
  assert.equal(failed.status, 'failed')
  assert.equal(failed.diagnostics?.providerToken, '[redacted]')
  assert.equal(failed.diagnostics?.reason, 'transcode_failed')
}

async function testMissingConfigAndUnauthorisedMember() {
  const missingConfig = await resolveBunnyProtectedPlayback({
    adapter: adapter(),
    config: { streamHostname: null, signingKey: null },
    lessonId: 'lesson_1',
    memberId: 'member_1',
    entitlement: activeEntitlement,
    now: NOW,
  })
  assert.equal(missingConfig.available, false)
  if (missingConfig.available) throw new Error('expected missing config projection')
  assert.equal(missingConfig.status, 'misconfigured')
  assert.equal(missingConfig.diagnostics?.signingKey, '[redacted]')

  const denied = await resolveBunnyProtectedPlayback({
    adapter: adapter(),
    config: { streamHostname: 'vz-987654.b-cdn.net', signingKey: 'test_signing_key' },
    lessonId: 'lesson_1',
    memberId: 'member_1',
    entitlement: { lifecycleState: 'pending', subscriptionStatus: 'incomplete', reconciliationState: 'pending' },
    now: NOW,
  })
  assert.equal(denied.available, false)
  if (denied.available) throw new Error('expected denied projection')
  assert.equal(denied.status, 'denied')
  assert.equal(denied.diagnostics?.entitlementReason, 'unreconciled_failed_closed')
}

async function testVoucherPayItForwardAndLessonAssociation() {
  for (const fundingSource of ['voucher', 'pay_it_forward'] as const) {
    const projection = await resolveBunnyProtectedPlayback({
      adapter: adapter(),
      config: { streamHostname: 'vz-987654.b-cdn.net', signingKey: 'test_signing_key' },
      lessonId: 'lesson_1',
      memberId: `member_${fundingSource}`,
      entitlement: {
        lifecycleState: 'active',
        subscriptionStatus: 'active',
        reconciliationState: 'matched',
        fundingSource,
      },
      now: NOW,
    })
    assert.equal(projection.available, true)
  }

  const wrongLesson = await resolveBunnyProtectedPlayback({
    adapter: adapter([video({ lessonId: 'lesson_2' })]),
    config: { streamHostname: 'vz-987654.b-cdn.net', signingKey: 'test_signing_key' },
    lessonId: 'lesson_1',
    memberId: 'member_1',
    entitlement: activeEntitlement,
    now: NOW,
  })
  assert.equal(wrongLesson.available, false)
  if (wrongLesson.available) throw new Error('expected missing projection')
  assert.equal(wrongLesson.status, 'missing')
}

function testSecretRedactionAndNoS3Fallback() {
  assert.deepEqual(redactBunnyDiagnostics({ apiKey: 'abc', secret: 'def', hostname: 'ok' }), {
    apiKey: '[redacted]',
    secret: '[redacted]',
    hostname: 'ok',
  })

  const source = String(resolveBunnyProtectedPlayback)
  assert.doesNotMatch(source, /amazon|aws|s3/i)
}

async function main() {
  await testReadyAsset()
  await testProcessingAndFailedAssetsFailClosed()
  await testMissingConfigAndUnauthorisedMember()
  await testVoucherPayItForwardAndLessonAssociation()
  testSecretRedactionAndNoS3Fallback()
  console.log('bunny_protected_media.test.ts passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
