import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { previewMigrationInventoryNames } from '../src/lib/previewMigrationInventory'
import {
  buildPreviewReleasePacket,
  serializePreviewReleasePacket,
  validatePreviewReleasePacketInput,
} from '../src/lib/previewReleasePacket'

const commitSha = '00d874480ef075ca8a853f9fa127e251d7b6a7ce'
const imageReference = `ghcr.io/prochattools/jpv-bootcamp:${commitSha}`
const packet = buildPreviewReleasePacket({
  commitSha,
  imageReference,
  targetEnvironment: 'preview',
  nodeVersion: '20',
  pnpmVersion: '10.33.0',
  startupMode: 'application-only',
  deploymentRuntime: 'docker',
  requiredConfigurationNames: ['DATABASE_URL', 'SYSTEM_DATABASE_URL'],
  migrationOrder: previewMigrationInventoryNames(),
  approvals: {
    push: 'push-approval',
    imagePublication: 'image-approval',
    migrationExecution: 'migration-approval',
    deployment: 'deployment-approval',
    providerDryRun: 'provider-dry-run-approval',
    providerApply: 'provider-apply-approval',
    billingVerification: 'billing-approval',
    communityVerification: 'community-approval',
    partnerVerification: 'partner-approval',
    rollbackRehearsal: 'rollback-approval',
    finalCutover: 'cutover-approval',
  },
  rehearsalChecks: previewMigrationInventoryNames().map((key) => ({ key, evidenceFields: ['checkKey', 'status'] })),
  rollbackImageReference: imageReference,
  backupReference: 'backup-ticket',
  stopConditions: ['approval missing'],
})

assert.equal(packet.schemaVersion, 1)
assert.equal(packet.repository, 'prochattools/jpv-bootcamp')
assert.deepEqual(packet.migrationOrder, previewMigrationInventoryNames())
assert.equal(serializePreviewReleasePacket(packet), serializePreviewReleasePacket(packet))

assert.equal(
  validatePreviewReleasePacketInput({
    ...packet,
    imageReference: 'ghcr.io/prochattools/jpv-bootcamp:latest',
  }).ok,
  false,
)
assert.equal(
  validatePreviewReleasePacketInput({
    ...packet,
    approvals: { ...packet.approvals, rollbackRehearsal: 'push-approval' },
  }).ok,
  false,
)
assert.equal(
  validatePreviewReleasePacketInput({
    ...packet,
    migrationOrder: [...previewMigrationInventoryNames()].reverse(),
  }).ok,
  false,
)
assert.equal(
  validatePreviewReleasePacketInput({
    ...packet,
    backupReference: '',
  }).ok,
  false,
)

const serialized = serializePreviewReleasePacket(packet)
assert.ok(packet.requiredConfigurationNames.every((name) => /^[A-Z0-9_]+$/.test(name)))
assert.doesNotMatch(serialized, /password|token|cookie|session|postgres:\/\//i)
assert.doesNotMatch(readFileSync('src/lib/previewReleasePacket.ts', 'utf8'), /\bfetch\(|axios|prisma\./i)

console.log('preview_release_packet.test.ts passed')
