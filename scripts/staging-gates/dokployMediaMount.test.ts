import assert from 'node:assert/strict'

import {
  assertCompatibleStagingMediaMount,
  assertCompatibleStagingPrivateMediaMount,
  assertSingleCompatibleStagingMediaMount,
  assertSingleCompatibleStagingPrivateMediaMount,
  assertStagingDokployTarget,
  buildStagingMediaMountPayload,
  buildStagingPrivateMediaMountPayload,
  findStagingMediaMounts,
  findStagingPrivateMediaMounts,
  STAGING_DOKPLOY_APPLICATION_ID,
  STAGING_MEDIA_MOUNT_PATH,
  STAGING_MEDIA_VOLUME_NAME,
  STAGING_PRIVATE_MEDIA_MOUNT_PATH,
  STAGING_PRIVATE_MEDIA_VOLUME_NAME,
} from './dokployMediaMount'
import { STAGING_APP_ID } from './stagingPolicy'

const validMount = {
  type: 'volume',
  volumeName: STAGING_MEDIA_VOLUME_NAME,
  mountPath: STAGING_MEDIA_MOUNT_PATH,
}

const validPrivateMount = {
  type: 'volume',
  volumeName: STAGING_PRIVATE_MEDIA_VOLUME_NAME,
  mountPath: STAGING_PRIVATE_MEDIA_MOUNT_PATH,
}

assert.deepEqual(findStagingMediaMounts({ mounts: [validMount] }), [validMount])
assert.equal(assertSingleCompatibleStagingMediaMount({ mounts: [] }), false)
assert.equal(assertSingleCompatibleStagingMediaMount({ mounts: [validMount] }), true)
assert.doesNotThrow(() => assertCompatibleStagingMediaMount(validMount))

assert.throws(
  () => assertCompatibleStagingMediaMount({ ...validMount, type: 'bind' }),
  /must use a Docker volume mount/,
)
assert.throws(
  () => assertCompatibleStagingMediaMount({ ...validMount, volumeName: 'wrong-volume' }),
  /must use volume jpv-bootcamp-preview-media/,
)
assert.throws(
  () => assertSingleCompatibleStagingMediaMount({ mounts: [validMount, validMount] }),
  /expected one mount/,
)

assert.doesNotThrow(() => assertStagingDokployTarget(STAGING_APP_ID))
assert.doesNotThrow(() => assertStagingDokployTarget(STAGING_DOKPLOY_APPLICATION_ID))
assert.deepEqual(buildStagingMediaMountPayload(STAGING_DOKPLOY_APPLICATION_ID), {
  type: 'volume',
  volumeName: STAGING_MEDIA_VOLUME_NAME,
  mountPath: STAGING_MEDIA_MOUNT_PATH,
  serviceType: 'application',
  serviceId: STAGING_DOKPLOY_APPLICATION_ID,
})
assert.deepEqual(buildStagingMediaMountPayload(STAGING_APP_ID), {
  type: 'volume',
  volumeName: STAGING_MEDIA_VOLUME_NAME,
  mountPath: STAGING_MEDIA_MOUNT_PATH,
  serviceType: 'application',
  serviceId: STAGING_DOKPLOY_APPLICATION_ID,
})
assert.throws(
  () => buildStagingMediaMountPayload('web-public-jpv-bootcamp-l66egq'),
  /DEPLOY-DENIED/,
)
assert.throws(
  () => buildStagingMediaMountPayload('aPR9SvYn_JvGdMTk3CzeI'),
  /DEPLOY-DENIED/,
)
assert.throws(
  () => buildStagingMediaMountPayload('other-app'),
  /DEPLOY-DENIED/,
)

// --- Private media mount tests ---

assert.deepEqual(findStagingPrivateMediaMounts({ mounts: [validPrivateMount] }), [validPrivateMount])
assert.deepEqual(findStagingPrivateMediaMounts({ mounts: [validMount, validPrivateMount] }), [validPrivateMount])
assert.deepEqual(findStagingPrivateMediaMounts({ mounts: [validMount] }), [])

assert.equal(assertSingleCompatibleStagingPrivateMediaMount({ mounts: [] }), false)
assert.equal(assertSingleCompatibleStagingPrivateMediaMount({ mounts: [validPrivateMount] }), true)
assert.doesNotThrow(() => assertCompatibleStagingPrivateMediaMount(validPrivateMount))

assert.throws(
  () => assertCompatibleStagingPrivateMediaMount({ ...validPrivateMount, type: 'bind' }),
  /must use a Docker volume mount/,
)
assert.throws(
  () => assertCompatibleStagingPrivateMediaMount({ ...validPrivateMount, volumeName: 'wrong-volume' }),
  /must use volume jpv-bootcamp-preview-private-media/,
)
assert.throws(
  () => assertSingleCompatibleStagingPrivateMediaMount({ mounts: [validPrivateMount, validPrivateMount] }),
  /expected one mount/,
)

assert.doesNotThrow(() => buildStagingPrivateMediaMountPayload(STAGING_DOKPLOY_APPLICATION_ID))
assert.doesNotThrow(() => buildStagingPrivateMediaMountPayload(STAGING_APP_ID))
assert.deepEqual(buildStagingPrivateMediaMountPayload(STAGING_DOKPLOY_APPLICATION_ID), {
  type: 'volume',
  volumeName: STAGING_PRIVATE_MEDIA_VOLUME_NAME,
  mountPath: STAGING_PRIVATE_MEDIA_MOUNT_PATH,
  serviceType: 'application',
  serviceId: STAGING_DOKPLOY_APPLICATION_ID,
})
assert.throws(
  () => buildStagingPrivateMediaMountPayload('web-public-jpv-bootcamp-l66egq'),
  /DEPLOY-DENIED/,
)
assert.throws(
  () => buildStagingPrivateMediaMountPayload('aPR9SvYn_JvGdMTk3CzeI'),
  /DEPLOY-DENIED/,
)
assert.throws(
  () => buildStagingPrivateMediaMountPayload('other-app'),
  /DEPLOY-DENIED/,
)

// Confirm public mount functions are not confused by private mounts (cross-path isolation)
assert.deepEqual(findStagingMediaMounts({ mounts: [validPrivateMount] }), [])
assert.equal(assertSingleCompatibleStagingMediaMount({ mounts: [validPrivateMount] }), false)
assert.deepEqual(findStagingPrivateMediaMounts({ mounts: [validMount] }), [])
assert.equal(assertSingleCompatibleStagingPrivateMediaMount({ mounts: [validMount] }), false)

console.log('dokploy staging media mount tests passed')
