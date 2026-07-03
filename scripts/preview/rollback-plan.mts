import { readFileSync } from 'node:fs'

import {
  buildPreviewRollbackPlan,
  serializePreviewRollbackPlan,
  validatePreviewRollbackEvidence,
} from '../../src/lib/previewRollbackPlan'

const mode = process.argv.find((value) => value.startsWith('--mode='))?.split('=')[1] ?? 'generate'

try {
  if (mode === 'validate-evidence') {
    const evidenceFile = process.argv.find((value) => value.startsWith('--evidence-file='))?.split('=')[1]
    if (!evidenceFile) throw new Error('evidence_file_required')
    const evidence = JSON.parse(readFileSync(evidenceFile, 'utf8')) as Parameters<typeof validatePreviewRollbackEvidence>[0]
    const result = validatePreviewRollbackEvidence(evidence)
    console.log(JSON.stringify(result, null, 2))
    process.exitCode = result.ok ? 0 : 1
  } else {
    const plan = buildPreviewRollbackPlan({
    currentCommitSha: process.argv.find((value) => value.startsWith('--current-commit-sha='))?.split('=')[1] ?? '',
    previousImmutableImageReference: process.argv.find((value) => value.startsWith('--previous-image-reference='))?.split('=')[1] ?? '',
    targetEnvironment: (process.argv.find((value) => value.startsWith('--target-environment='))?.split('=')[1] as 'preview' | 'staging') ?? 'preview',
    stopControls: {
      memberWritesFrozen: true,
      communityPublishingFrozen: true,
      partnerDeliveryFrozen: true,
      providerEmailFrozen: true,
      billingSideChangesFrozen: true,
    },
    migrationBackout: [],
    prismaDatabaseStartup: {
      startupMode: 'application-only',
      deploymentEnv: 'preview',
      requiresApproval: true,
    },
    webhookPreservation: {
      preserveExistingEvents: true,
      replaySafe: true,
      replayNotes: 'repository-only',
    },
    successChecks: ['application rollback'],
    hardStopConditions: ['rollback approval missing'],
  })
    process.stdout.write(serializePreviewRollbackPlan(plan))
  }
} catch (error) {
  console.error((error as Error).message)
  process.exit(1)
}
