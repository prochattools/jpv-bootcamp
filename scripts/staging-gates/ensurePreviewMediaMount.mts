import {
  assertSingleCompatibleStagingMediaMount,
  buildStagingMediaMountPayload,
  STAGING_DOKPLOY_APPLICATION_ID,
  STAGING_MEDIA_MOUNT_PATH,
  STAGING_MEDIA_VOLUME_NAME,
} from './dokployMediaMount'

const appId = process.env.DOKPLOY_PREVIEW_APP_ID?.trim() ?? ''
const apiKey = process.env.DOKPLOY_API_KEY?.trim() ?? ''
const apiBase = (process.env.DOKPLOY_API_BASE_URL?.trim() || 'https://dokploy.prochat.tools/api').replace(/\/$/, '')

if (!appId) throw new Error('MEDIA-MOUNT-DENIED: DOKPLOY_PREVIEW_APP_ID is required')
if (!apiKey) throw new Error('MEDIA-MOUNT-DENIED: DOKPLOY_API_KEY is required')

const createPayload = buildStagingMediaMountPayload(appId)

async function request(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      ...(init?.headers ?? {}),
    },
    redirect: 'error',
  })

  const text = await response.text()
  let body: unknown = {}
  if (text.trim()) {
    try {
      body = JSON.parse(text)
    } catch {
      throw new Error(`MEDIA-MOUNT-FAILED: Dokploy returned non-JSON HTTP ${response.status}`)
    }
  }

  if (!response.ok) {
    throw new Error(`MEDIA-MOUNT-FAILED: Dokploy returned HTTP ${response.status}`)
  }

  return body
}

async function readMounts(): Promise<unknown> {
  const query = new URLSearchParams({
    serviceType: 'application',
    serviceId: STAGING_DOKPLOY_APPLICATION_ID,
  })
  return request(`/mounts.listByServiceId?${query.toString()}`)
}

const before = await readMounts()
if (assertSingleCompatibleStagingMediaMount(before)) {
  console.log(JSON.stringify({
    ok: true,
    action: 'already_present',
    mountPath: STAGING_MEDIA_MOUNT_PATH,
    volumeName: STAGING_MEDIA_VOLUME_NAME,
  }))
  process.exit(0)
}

await request('/mounts.create', {
  method: 'POST',
  body: JSON.stringify(createPayload),
})

const after = await readMounts()
if (!assertSingleCompatibleStagingMediaMount(after)) {
  throw new Error('MEDIA-MOUNT-FAILED: mount was not visible after creation')
}

console.log(JSON.stringify({
  ok: true,
  action: 'created',
  mountPath: STAGING_MEDIA_MOUNT_PATH,
  volumeName: STAGING_MEDIA_VOLUME_NAME,
}))
