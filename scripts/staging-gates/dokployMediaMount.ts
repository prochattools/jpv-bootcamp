import {
  assertStagingDeployment,
  STAGING_APP_ID,
  STAGING_BRANCH,
  STAGING_ORIGIN,
} from './stagingPolicy'

export const STAGING_MEDIA_MOUNT_PATH = '/app/public/media'
export const STAGING_MEDIA_VOLUME_NAME = 'jpv-bootcamp-preview-media'
export const STAGING_DOKPLOY_APPLICATION_ID = 'I_2Vukga3cc3ZhaG-mUzU'
export const PRODUCTION_DOKPLOY_APPLICATION_IDS = [
  'aPR9SvYn_JvGdMTk3CzeI',
  'web-public-jpv-bootcamp-l66egq',
] as const

type UnknownRecord = Record<string, unknown>

export interface DokployMountRecord extends UnknownRecord {
  mountPath?: unknown
  type?: unknown
  volumeName?: unknown
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function collectMountRecords(value: unknown, output: DokployMountRecord[]): void {
  if (Array.isArray(value)) {
    for (const entry of value) collectMountRecords(entry, output)
    return
  }

  if (!isRecord(value)) return

  if (typeof value.mountPath === 'string') output.push(value)
  for (const nested of Object.values(value)) collectMountRecords(nested, output)
}

export function findStagingMediaMounts(response: unknown): DokployMountRecord[] {
  const mounts: DokployMountRecord[] = []
  collectMountRecords(response, mounts)
  return mounts.filter((mount) => mount.mountPath === STAGING_MEDIA_MOUNT_PATH)
}

export function assertCompatibleStagingMediaMount(mount: DokployMountRecord): void {
  if (mount.type !== 'volume') {
    throw new Error(
      `MEDIA-MOUNT-DENIED: ${STAGING_MEDIA_MOUNT_PATH} must use a Docker volume mount`,
    )
  }

  if (
    typeof mount.volumeName !== 'string' ||
    mount.volumeName.trim() !== STAGING_MEDIA_VOLUME_NAME
  ) {
    throw new Error(
      `MEDIA-MOUNT-DENIED: ${STAGING_MEDIA_MOUNT_PATH} must use volume ${STAGING_MEDIA_VOLUME_NAME}`,
    )
  }
}

export function assertSingleCompatibleStagingMediaMount(response: unknown): boolean {
  const mounts = findStagingMediaMounts(response)
  if (mounts.length === 0) return false
  if (mounts.length !== 1) {
    throw new Error(
      `MEDIA-MOUNT-DENIED: expected one mount at ${STAGING_MEDIA_MOUNT_PATH}, found ${mounts.length}`,
    )
  }

  assertCompatibleStagingMediaMount(mounts[0])
  return true
}

export function assertStagingDokployTarget(target: string): void {
  if ((PRODUCTION_DOKPLOY_APPLICATION_IDS as readonly string[]).includes(target)) {
    throw new Error('DEPLOY-DENIED: Dokploy target is on the production deny-list')
  }

  if (target !== STAGING_APP_ID && target !== STAGING_DOKPLOY_APPLICATION_ID) {
    throw new Error('DEPLOY-DENIED: Dokploy target is not the documented staging application')
  }

  assertStagingDeployment({
    appId: STAGING_APP_ID,
    origin: STAGING_ORIGIN,
    branch: STAGING_BRANCH,
  })
}

export function buildStagingMediaMountPayload(target: string): Record<string, string> {
  assertStagingDokployTarget(target)

  return {
    type: 'volume',
    volumeName: STAGING_MEDIA_VOLUME_NAME,
    mountPath: STAGING_MEDIA_MOUNT_PATH,
    serviceType: 'application',
    serviceId: STAGING_DOKPLOY_APPLICATION_ID,
  }
}
