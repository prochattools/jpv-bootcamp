import assert from 'node:assert/strict'

import {
  expectedPayloadMigrationOrder,
  knownProviderFlowList,
  validatePreviewReleasePreflight,
  type PreviewReleasePreflightInput,
} from '../src/lib/previewReleasePreflight'

const commitSha = '00d874480ef075ca8a853f9fa127e251d7b6a7ce'
const image = `ghcr.io/prochattools/jpv-bootcamp:${commitSha}`
const stops = ['stop on mismatch']
const flows = knownProviderFlowList()

const empty = validatePreviewReleasePreflight({})
assert.equal(empty.gitPush.authorized, false)
assert.equal(empty.gitPush.ok, true)
assert.equal(empty.payloadMigration.authorized, false)
assert.equal(empty.providerApply.authorized, false)
assert.equal(empty.previewDeployment.authorized, false)

const full: PreviewReleasePreflightInput = {
  gitPush: {
    authorized: true,
    branch: 'feature/course-branding-and-preview',
    commitSha,
    remote: 'origin',
    operator: 'release-operator',
    stopConditions: stops,
  },
  imagePublication: {
    authorized: true,
    commitSha,
    imageReference: image,
    targetEnvironment: 'preview',
    operator: 'release-operator',
    stopConditions: stops,
  },
  payloadMigration: {
    authorized: true,
    environment: 'preview',
    databaseIdentifier: 'preview-db',
    schema: 'jpvbootcamp_staging',
    migrations: expectedPayloadMigrationOrder(),
    backupEvidence: 'backup-ticket',
    maintenanceWindow: 'window',
    operator: 'migration-operator',
    rollbackOwner: 'rollback-owner',
    stopConditions: stops,
  },
  prismaDatabaseDeploy: {
    authorized: true,
    environment: 'preview',
    startupMode: 'database-deploy',
    deploymentEnv: 'preview',
    deployProdApproval: true,
    backupEvidence: 'backup-ticket',
    operator: 'db-operator',
    rollbackOwner: 'rollback-owner',
    stopConditions: stops,
  },
  providerDryRun: {
    authorized: true,
    environment: 'preview',
    mode: 'dry-run-only',
    flows,
    operator: 'email-operator',
    stopConditions: stops,
  },
  providerApply: {
    authorized: true,
    environment: 'preview',
    mode: 'apply',
    senderIdentity: 'approved-sender-id',
    recipientScope: 'approved-internal-recipients',
    flows,
    retryPolicy: 'bounded',
    operator: 'email-operator',
    stopConditions: stops,
  },
  previewDeployment: {
    authorized: true,
    imageReference: image,
    target: 'preview-app',
    migrationPrerequisiteStatus: 'complete',
    startupMode: 'application-only',
    rollbackImage: image,
    rollbackOwner: 'rollback-owner',
    operator: 'deploy-operator',
    stopConditions: stops,
  },
  smokeVerification: {
    authorized: true,
    target: 'https://preview.example.test',
    checks: ['root-page'],
    databaseAccessAllowed: false,
    providerEmailAllowed: false,
    operator: 'smoke-operator',
    stopConditions: stops,
  },
}

const ok = validatePreviewReleasePreflight(full)
for (const category of Object.values(ok)) {
  assert.equal(category.ok, true)
  assert.equal(category.authorized, true)
}

assert.equal(validatePreviewReleasePreflight({ gitPush: full.gitPush }).imagePublication.authorized, false)
assert.equal(validatePreviewReleasePreflight({ imagePublication: full.imagePublication }).previewDeployment.authorized, false)
assert.equal(validatePreviewReleasePreflight({ payloadMigration: full.payloadMigration }).prismaDatabaseDeploy.authorized, false)

assert.equal(
  validatePreviewReleasePreflight({ payloadMigration: { ...full.payloadMigration, migrations: expectedPayloadMigrationOrder().reverse() } }).payloadMigration.errors.includes('migration_order_required'),
  true,
)
assert.equal(
  validatePreviewReleasePreflight({ providerApply: { ...full.providerApply, senderIdentity: '' } }).providerApply.errors.includes('sender_identity_required'),
  true,
)
assert.equal(
  validatePreviewReleasePreflight({ providerDryRun: { ...full.providerDryRun, mode: 'apply' } }).providerDryRun.errors.includes('dry_run_mode_required'),
  true,
)
assert.equal(
  validatePreviewReleasePreflight({ previewDeployment: { ...full.previewDeployment, imageReference: 'ghcr.io/prochattools/jpv-bootcamp:latest' } }).previewDeployment.errors.includes('immutable_image_required'),
  true,
)
assert.equal(
  validatePreviewReleasePreflight({ providerApply: { ...full.providerApply, flows: ['unknown-flow'] } }).providerApply.errors.includes('known_flows_required'),
  true,
)

console.log('preview_release_preflight.test.ts passed')
