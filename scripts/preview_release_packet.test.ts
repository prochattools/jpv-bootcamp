import assert from 'node:assert/strict'

import { previewMigrationInventoryNames } from '../src/lib/previewMigrationInventory'
import { PREVIEW_SMOKE_CHECKS } from '../src/lib/previewSmokePlan'
import { buildPreviewReleasePacket, validatePreviewReleasePacketInput } from '../src/lib/previewReleasePacket'

const commitSha = '00d874480ef075ca8a853f9fa127e251d7b6a7ce'
const approvals = Object.fromEntries(
  (['push','imagePublication','migrationExecution','deployment','providerDryRun','providerApply','billingVerification','communityVerification','partnerVerification','rollbackRehearsal','finalCutover'] as const).map((category) => [
    category,
    {
      category,
      authorized: false,
      targetEnvironment: 'preview' as const,
      commitSha,
      operator: 'operator-1',
      approvalReference: `${category}-ref`,
      approvedAt: '2026-07-03T00:00:00.000Z',
      evidenceReference: `${category}-evidence`,
      stopConditions: ['stop'],
    },
  ]),
)

const packet = buildPreviewReleasePacket({
  repository: 'prochattools/jpv-bootcamp',
  branch: 'feature/course-branding-and-preview',
  commitSha,
  imageReference: `ghcr.io/prochattools/jpv-bootcamp:${commitSha}`,
  targetEnvironment: 'preview',
  nodeVersion: '20',
  pnpmVersion: '10.33.0',
  startupMode: 'application-only',
  deploymentRuntime: 'docker',
  requiredConfigurationNames: ['DATABASE_URL', 'SYSTEM_DATABASE_URL'],
  migrationOrder: previewMigrationInventoryNames(),
  approvals: approvals as any,
  rehearsalChecks: PREVIEW_SMOKE_CHECKS.map((check) => ({
    key: check.key,
    authorizationCategory: check.authorizationCategory,
    automated: check.automated,
    riskSummary: 'offline',
    requiredEvidenceFields: check.requiredEvidenceFields,
    prerequisites: check.prerequisites,
    stopConditions: check.stopConditions,
  })),
  rollbackImageReference: `ghcr.io/prochattools/jpv-bootcamp:${commitSha}`,
  rollbackImageCommit: commitSha,
  backupReference: 'backup-ticket-1',
  stopConditions: ['stop'],
  currentBranch: 'feature/course-branding-and-preview',
  currentHead: commitSha,
  repositoryIdentifier: 'prochattools/jpv-bootcamp',
  stagedPaths: [],
  intendedDirtyPaths: [],
  protectedDirtyPaths: ['.graphifyignore'],
})

assert.equal(packet.executable, false)
assert.equal(validatePreviewReleasePacketInput(packet).ok, false)

const executablePacket = buildPreviewReleasePacket({
  ...packet,
  approvals: Object.fromEntries(
    (Object.keys(packet.approvals) as Array<keyof typeof packet.approvals>).map((category) => [
      category,
      { ...packet.approvals[category], authorized: true },
    ]),
  ) as any,
  currentBranch: 'feature/course-branding-and-preview',
  currentHead: commitSha,
  stagedPaths: [],
  intendedDirtyPaths: [],
})
assert.equal(executablePacket.executable, true)
assert.equal(validatePreviewReleasePacketInput(executablePacket).ok, true)

const wrongApproval = validatePreviewReleasePacketInput({
  ...packet,
  approvals: Object.fromEntries(
    (Object.keys(packet.approvals) as Array<keyof typeof packet.approvals>).map((category) => [
      category,
      { ...packet.approvals[category], authorized: true },
    ]),
  ) as any,
})
assert.equal(wrongApproval.ok, true)

const badApproval = validatePreviewReleasePacketInput({
  ...packet,
  approvals: {
    ...packet.approvals,
    push: { ...packet.approvals.push, approvalReference: 'placeholder' },
  },
})
assert.equal(badApproval.ok, false)

const wrongBranch = validatePreviewReleasePacketInput({ ...packet, currentBranch: 'main' })
assert.equal(wrongBranch.ok, false)
assert.equal(wrongBranch.errors.includes('branch_mismatch'), true)

const wrongHead = validatePreviewReleasePacketInput({ ...packet, currentHead: '0000000000000000000000000000000000000000' })
assert.equal(wrongHead.ok, false)
assert.equal(wrongHead.errors.includes('head_mismatch'), true)

const staged = validatePreviewReleasePacketInput({ ...packet, stagedPaths: ['src/foo.ts'] })
assert.equal(staged.ok, false)
assert.equal(staged.errors.includes('staged_paths_must_be_empty'), true)

console.log('preview_release_packet.test.ts passed')
