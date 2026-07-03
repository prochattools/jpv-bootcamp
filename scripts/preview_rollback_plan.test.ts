import assert from 'node:assert/strict'

import { previewMigrationInventory, previewMigrationInventoryNames } from '../src/lib/previewMigrationInventory'
import { buildPreviewRollbackPlan, validatePreviewRollbackEvidence, validatePreviewRollbackPlanInput } from '../src/lib/previewRollbackPlan'

const commitSha = '00d874480ef075ca8a853f9fa127e251d7b6a7ce'
const plan = buildPreviewRollbackPlan({
  currentCommitSha: commitSha,
  previousImmutableImageReference: `ghcr.io/prochattools/jpv-bootcamp:${commitSha}`,
  targetEnvironment: 'preview',
  backupReference: 'backup-ticket-1',
  planningMode: 'draft',
  plannedFreezeControls: {
    memberWritesFrozen: false,
    communityPublishingFrozen: false,
    partnerDeliveryFrozen: false,
    providerEmailFrozen: false,
    billingSideChangesFrozen: false,
  },
  migrationBackout: previewMigrationInventory().map((entry) => ({
    name: entry.name,
    rollbackRisk: entry.rollbackRisk,
    backupRequired: true,
    warning: entry.rollbackRisk === 'irreversible'
      ? `${entry.name} is irreversible and requires a verified backup.`
      : `${entry.name} may lose data on rollback.`,
    verificationChecks: [...entry.verificationChecks],
    automaticDownProhibited: entry.rollbackRisk !== 'reversible',
  })),
  prismaDatabaseStartup: {
    startupMode: 'application-only',
    deploymentEnv: 'preview',
    requiresApproval: true,
  },
  webhookPreservation: {
    preserveExistingEvents: true,
    replaySafe: true,
    replayNotes: 'repository-only planning',
  },
  successChecks: ['rollback to immutable image'],
  hardStopConditions: ['backup missing'],
  authorizationStatus: 'missing',
  missingRequirements: ['rollback approval missing'],
  generatedFromCommit: commitSha,
  canonicalMigrationInventoryDigest: `sha256:${previewMigrationInventoryNames().join('|')}`,
  rollbackImageCommit: commitSha,
  backupReferencePresent: true,
  protectedPathsExcluded: true,
  executable: false,
})

assert.equal(plan.executable, false)
assert.equal(validatePreviewRollbackPlanInput(plan).ok, true)

const missingImage = validatePreviewRollbackPlanInput({ ...plan, previousImmutableImageReference: 'placeholder' })
assert.equal(missingImage.ok, false)
assert.equal(missingImage.errors.includes('previous_immutable_image_required'), true)

const missingBackup = validatePreviewRollbackPlanInput({ ...plan, backupReferencePresent: false })
assert.equal(missingBackup.ok, false)
assert.equal(missingBackup.errors.includes('backup_reference_missing'), true)

const reversibleWarning = validatePreviewRollbackPlanInput({
  ...plan,
  migrationBackout: plan.migrationBackout.map((entry) => ({ ...entry, warning: entry.rollbackRisk === 'irreversible' ? 'rollback' : entry.warning })),
})
assert.equal(reversibleWarning.ok, false)

const evidence = validatePreviewRollbackEvidence({
  schemaVersion: 1,
  commitSha,
  imageReference: `ghcr.io/prochattools/jpv-bootcamp:${commitSha}`,
  targetEnvironment: 'preview',
  rollbackPlanId: 'rollback-1',
  startedAt: '2026-07-03T00:00:00.000Z',
  endedAt: '2026-07-03T00:01:00.000Z',
  status: 'passed',
  operator: 'rollback-op',
  approvalReference: 'rollback-approval-1',
  backupReference: 'backup-ticket-1',
  notes: 'repository-only evidence',
})
assert.equal(evidence.ok, true)

assert.equal(validatePreviewRollbackEvidence({ ...evidence, notes: 'password=abc' }).ok, false)

console.log('preview_rollback_plan.test.ts passed')
