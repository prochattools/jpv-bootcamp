import assert from 'node:assert/strict'

import {
  assertCompatibleStagingMediaMount,
  assertSingleCompatibleStagingMediaMount,
  buildStagingMediaMountPayload,
  findStagingMediaMounts,
  STAGING_MEDIA_MOUNT_PATH,
  STAGING_MEDIA_VOLUME_NAME,
} from './dokployMediaMount'
import { STAGING_APP_ID } from './stagingPolicy'

const validMount = {
  type: 'volume',
  volumeName: STAGING_MEDIA_VOLUME_NAME,
  mountPath: STAGING_MEDIA_MOUNT_PATH,
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

assert.deepEqual(buildStagingMediaMountPayload(STAGING_APP_ID), {
  type: 'volume',
  volumeName: STAGING_MEDIA_VOLUME_NAME,
  mountPath: STAGING_MEDIA_MOUNT_PATH,
  serviceType: 'application',
  serviceId: STAGING_APP_ID,
})
assert.throws(
  () => buildStagingMediaMountPayload('web-public-jpv-bootcamp-l66egq'),
  /DEPLOY-DENIED/,
)
assert.throws(
  () => buildStagingMediaMountPayload('other-app'),
  /DEPLOY-DENIED/,
)

console.log('dokploy staging media mount tests passed')
