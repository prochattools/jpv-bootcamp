import assert from 'node:assert/strict'

import {
  fetchLegacyBunnyVideoDetail,
  readLegacyBunnyConfigFromEnv,
  verifyBunnyInventoryGuids,
} from './legacyBunnyReadOnly'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

async function run(): Promise<void> {
  const config = readLegacyBunnyConfigFromEnv({
    BUNNY_STREAM_API_KEY: 'fixture-key',
    BUNNY_STREAM_LIBRARY_ID: '581531',
  })
  assert.deepEqual(config, { apiKey: 'fixture-key', libraryId: '581531' })
  assert.throws(() => readLegacyBunnyConfigFromEnv({}), /BUNNY_READ_CONFIG_MISSING/)

  const calls: Array<{ url: string; method: string; key: string }> = []
  const fetchMock = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    const guid = url.split('/').pop() ?? ''
    calls.push({
      url,
      method: init?.method ?? 'GET',
      key: new Headers(init?.headers).get('AccessKey') ?? '',
    })
    return jsonResponse({
      videoLibraryId: 581531,
      guid,
      title: `Video ${guid}`,
      status: 3,
      length: 42,
      width: 1280,
      height: 720,
      framerate: 30,
      thumbnailUrl: `https://cdn.invalid/${guid}.jpg`,
    })
  }) as typeof fetch

  const detail = await fetchLegacyBunnyVideoDetail(config, '56266f09-d651-4bc5-a5b0-ac9185018018', fetchMock)
  assert.equal(detail.guid, '56266f09-d651-4bc5-a5b0-ac9185018018')
  assert.equal(calls[0].method, 'GET')
  assert.equal(calls[0].key, 'fixture-key')
  assert.equal(calls[0].url, 'https://video.bunnycdn.com/library/581531/videos/56266f09-d651-4bc5-a5b0-ac9185018018')

  const verified = await verifyBunnyInventoryGuids({
    library: { id: 581531 },
    videos: [
      {
        video_guid: '56266f09-d651-4bc5-a5b0-ac9185018018',
        title: 'Legacy lesson video',
        status: 'resolution_finished',
        library_id: 581531,
      },
      {
        video_guid: 'cda4b492-91af-430d-9bba-4268ccaf8cc2',
        title: 'Second lesson video',
        status: 'resolution_finished',
        library_id: 581531,
      },
      {
        video_guid: '5fda17bf-3547-494e-8664-12edcdb7f7cb',
        title: 'staging-proof-upload-test',
        status: 'failed',
        library_id: 581531,
      },
    ],
  }, config, fetchMock)

  assert.equal(verified.verification?.verified_guids, 2)
  assert.equal(verified.verification?.failed_videos_skipped, 1)
  assert.equal(verified.videos[0].duration_seconds, 42)
  assert.equal(verified.videos[2].status, 'failed')
  assert.equal(calls.length, 3, 'one direct GET plus two verification GETs; failed video skipped')

  await assert.rejects(
    () => fetchLegacyBunnyVideoDetail(config, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', async () => jsonResponse({
      videoLibraryId: 999999,
      guid: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      title: 'Wrong library',
      status: 3,
    }) as typeof fetch),
    /BUNNY_READ_LIBRARY_MISMATCH/,
  )

  console.log('Legacy Bunny read-only GUID verification contract: PASS')
}

void run().catch((error) => {
  console.error('Legacy Bunny read-only GUID verification contract: FAIL')
  console.error(error)
  process.exitCode = 1
})
