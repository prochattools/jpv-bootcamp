import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { previewMigrationInventoryNames } from '../src/lib/previewMigrationInventory'
import {
  buildPreviewRollbackPlan,
  serializePreviewRollbackPlan,
  validatePreviewRollbackPlanInput,
} from '../src/lib/previewRollbackPlan'

const commitSha = '00d874480ef075ca8a853f9fa127e251d7b6a7ce'
const imageReference = `ghcr.io/prochattools/jpv-bootcamp:${commitSha}`
const plan = buildPreviewRollbackPlan({
  currentCommitSha: commitSha,
  previousImmutableImageReference: imageReference,
  targetEnvironment: 'preview',
  stopControls: {
    memberWritesFrozen: true,
    communityPublishingFrozen: true,
    partnerDeliveryFrozen: true,
    providerEmailFrozen: true,
    billingSideChangesFrozen: true,
  },
  migrationBackout: previewMigrationInventoryNames().map((name, index) => ({
    name,
    reversibility: index === 0 ? 'irreversible' : 'data_loss',
    warning: `Rollback of ${name} may lose data.`,
    backupRequired: true,
  })),
  prismaDatabaseStartup: {
    startupMode: 'database-deploy',
    deploymentEnv: 'preview',
    requiresApproval: true,
  },
  webhookPreservation: {
    preserveExistingEvents: true,
    replaySafe: true,
    replayNotes: 'webhooks remain immutable and replay-safe',
  },
  successChecks: ['previous image restored', 'writes frozen'],
  hardStopConditions: ['backup missing', 'rollback approval missing'],
})

assert.equal(plan.schemaVersion, 1)
assert.deepEqual(plan.migrationOrder, previewMigrationInventoryNames())
assert.equal(serializePreviewRollbackPlan(plan), serializePreviewRollbackPlan(plan))

assert.equal(
  validatePreviewRollbackPlanInput({
    ...plan,
    previousImmutableImageReference: 'ghcr.io/prochattools/jpv-bootcamp:latest',
  }).ok,
  false,
)
assert.equal(
  validatePreviewRollbackPlanInput({
    ...plan,
    stopControls: { ...plan.stopControls, memberWritesFrozen: false },
  }).ok,
  false,
)
assert.equal(
  validatePreviewRollbackPlanInput({
    ...plan,
    migrationBackout: plan.migrationBackout.slice(1),
  }).ok,
  false,
)

const serialized = serializePreviewRollbackPlan(plan)
assert.doesNotMatch(serialized, /password|token|cookie|session|database_url|postgres:\/\//i)
assert.doesNotMatch(readFileSync('src/lib/previewRollbackPlan.ts', 'utf8'), /\bfetch\(|axios|prisma\./i)

console.log('preview_rollback_plan.test.ts passed')
