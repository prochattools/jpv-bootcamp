import { readFileSync } from 'node:fs'

import { previewMigrationInventory } from '../../src/lib/previewMigrationInventory'
import {
  buildPreviewRollbackPlan,
  serializePreviewRollbackPlan,
  validatePreviewRollbackEvidence,
  validatePreviewRollbackPlanInput,
} from '../../src/lib/previewRollbackPlan'

function arg(name: string): string | undefined {
  const prefix = `--${name}=`
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length)
}

function readJson(path?: string): unknown {
  if (!path) return undefined
  return JSON.parse(readFileSync(path, 'utf8'))
}

function draft() {
  const input = readJson(arg('input-file')) as any | undefined
  const plan = buildPreviewRollbackPlan({
    currentCommitSha: input?.currentCommitSha ?? arg('current-commit-sha') ?? '',
    previousImmutableImageReference: input?.previousImmutableImageReference ?? arg('previous-image-reference') ?? '',
    targetEnvironment: input?.targetEnvironment ?? (arg('target-environment') as 'preview' | 'staging') ?? 'preview',
    backupReference: input?.backupReference ?? arg('backup-reference') ?? '',
    planningMode: 'draft',
    plannedFreezeControls: input?.plannedFreezeControls ?? {
      memberWritesFrozen: false,
      communityPublishingFrozen: false,
      partnerDeliveryFrozen: false,
      providerEmailFrozen: false,
      billingSideChangesFrozen: false,
    },
    confirmedFreezeEvidence: input?.confirmedFreezeEvidence,
    migrationBackout:
      input?.migrationBackout ??
      previewMigrationInventory().map((entry) => ({
        name: entry.name,
        rollbackRisk: entry.rollbackRisk,
        backupRequired: entry.rollbackRisk !== 'reversible',
        warning:
          entry.rollbackRisk === 'irreversible'
            ? `Rollback of ${entry.name} is irreversible and requires a verified backup.`
            : `Rollback of ${entry.name} may lose data.`,
        verificationChecks: [...entry.verificationChecks],
        automaticDownProhibited: entry.rollbackRisk !== 'reversible',
      })),
    prismaDatabaseStartup: input?.prismaDatabaseStartup ?? {
      startupMode: 'application-only',
      deploymentEnv: 'preview',
      requiresApproval: false,
    },
    webhookPreservation: input?.webhookPreservation ?? {
      preserveExistingEvents: true,
      replaySafe: true,
      replayNotes: 'repository-only planning mode',
    },
    successChecks: input?.successChecks ?? ['application rollback'],
    hardStopConditions: input?.hardStopConditions ?? ['rollback approval missing'],
    authorizationStatus: input?.authorizationStatus ?? 'missing',
    missingRequirements: input?.missingRequirements ?? ['rollback approval missing'],
    generatedFromCommit: input?.generatedFromCommit ?? (arg('current-commit-sha') ?? ''),
    canonicalMigrationInventoryDigest: input?.canonicalMigrationInventoryDigest ?? `sha256:${previewMigrationInventory().map((entry) => entry.name).join('|')}`,
    rollbackImageCommit: input?.rollbackImageCommit,
    backupReferencePresent: Boolean(input?.backupReference ?? arg('backup-reference')),
    protectedPathsExcluded: true,
    executable: false,
  })
  process.stdout.write(serializePreviewRollbackPlan(plan))
}

function validatePlan() {
  const plan = readJson(arg('plan-file')) as Parameters<typeof validatePreviewRollbackPlanInput>[0]
  const result = validatePreviewRollbackPlanInput(plan)
  console.log(JSON.stringify(result, null, 2))
  process.exitCode = result.ok ? 0 : 1
}

function validateEvidence() {
  const evidence = readJson(arg('evidence-file')) as Parameters<typeof validatePreviewRollbackEvidence>[0]
  const result = validatePreviewRollbackEvidence(evidence)
  console.log(JSON.stringify(result, null, 2))
  process.exitCode = result.ok ? 0 : 1
}

switch (arg('mode') ?? 'draft') {
  case 'draft':
    draft()
    break
  case 'validate-plan':
    validatePlan()
    break
  case 'validate-evidence':
    validateEvidence()
    break
  default:
    throw new Error('invalid_mode')
}
