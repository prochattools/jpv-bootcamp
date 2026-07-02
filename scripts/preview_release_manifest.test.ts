import assert from 'node:assert/strict'

import {
  buildPreviewReleaseManifest,
  serializePreviewReleaseManifest,
  validatePreviewReleaseManifestInput,
} from '../src/lib/previewReleaseManifest'
import { REQUIRED_PAYLOAD_MIGRATIONS } from '../src/lib/previewReleasePolicy'

const commitSha = '00d874480ef075ca8a853f9fa127e251d7b6a7ce'
const imageReference = `ghcr.io/prochattools/jpv-bootcamp:${commitSha}`

const manifest = buildPreviewReleaseManifest({
  repository: 'prochattools/jpv-bootcamp',
  branch: 'feature/course-branding-and-preview',
  commitSha,
  imageReference,
  targetEnvironment: 'preview',
  startupMode: 'application-only',
  deploymentRuntime: 'docker',
  sourceDate: '2026-07-02T00:00:00Z',
})

assert.equal(manifest.schemaVersion, 1)
assert.equal(manifest.commitSha, commitSha)
assert.equal(manifest.imageReference, imageReference)
assert.equal(manifest.imageTag, commitSha)
assert.deepEqual(manifest.payloadMigrations, [...REQUIRED_PAYLOAD_MIGRATIONS])
assert.equal(manifest.authorizations.payloadMigrations, false)
assert.equal(manifest.authorizations.previewDeployment, false)

const once = serializePreviewReleaseManifest(manifest)
const twice = serializePreviewReleaseManifest(manifest)
assert.equal(once, twice)
for (const forbidden of [
  'postgresql://',
  'DATABASE_URL=',
  'RESEND_API_KEY=',
  'secret-value',
  'sender@example',
  'recipient@example',
  'github_token',
]) {
  assert.equal(once.includes(forbidden), false, forbidden)
}

assert.deepEqual(validatePreviewReleaseManifestInput({ ...manifest, commitSha: 'short' }).errors, [
  'invalid_commit_sha',
])
assert.equal(
  validatePreviewReleaseManifestInput({ ...manifest, imageReference: 'ghcr.io/prochattools/jpv-bootcamp:latest' }).errors.includes('invalid_or_mutable_image_reference'),
  true,
)
assert.equal(
  validatePreviewReleaseManifestInput({ ...manifest, payloadMigrations: [...REQUIRED_PAYLOAD_MIGRATIONS].reverse() }).errors.includes('invalid_payload_migration_order'),
  true,
)
assert.equal(
  validatePreviewReleaseManifestInput({
    ...manifest,
    startupMode: 'database-deploy',
    deploymentEnv: undefined,
  }).errors.includes('database_deploy_requires_deployment_env'),
  true,
)
assert.equal(
  validatePreviewReleaseManifestInput({
    ...manifest,
    authorizations: { providerApply: true },
  }).errors.includes('provider_apply_requires_sender_identity'),
  true,
)
assert.equal(
  validatePreviewReleaseManifestInput({
    ...manifest,
    imageReference: undefined,
    authorizations: { previewDeployment: true },
  }).errors.includes('deployment_requires_image_reference'),
  true,
)

console.log('preview_release_manifest.test.ts passed')
