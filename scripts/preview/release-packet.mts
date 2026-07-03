import { readFileSync } from 'node:fs'

import { buildPreviewReleasePacket, serializePreviewReleasePacket, validatePreviewReleasePacketInput } from '../../src/lib/previewReleasePacket'
import { previewMigrationInventoryNames } from '../../src/lib/previewMigrationInventory'

try {
  const mode = process.argv.find((value) => value.startsWith('--mode='))?.split('=')[1] ?? 'generate'
  if (mode === 'validate') {
    const file = process.argv.find((value) => value.startsWith('--packet-file='))?.split('=')[1]
    if (!file) throw new Error('packet_file_required')
    const packet = JSON.parse(readFileSync(file, 'utf8')) as Parameters<typeof validatePreviewReleasePacketInput>[0]
    const result = validatePreviewReleasePacketInput(packet)
    console.log(JSON.stringify(result, null, 2))
    process.exitCode = result.ok ? 0 : 1
  } else {
    const packet = buildPreviewReleasePacket({
    commitSha: process.argv.find((value) => value.startsWith('--commit-sha='))?.split('=')[1] ?? '',
    imageReference: process.argv.find((value) => value.startsWith('--image-reference='))?.split('=')[1] ?? '',
    targetEnvironment: (process.argv.find((value) => value.startsWith('--target-environment='))?.split('=')[1] as 'preview' | 'staging') ?? 'preview',
    nodeVersion: '20',
    pnpmVersion: '10.33.0',
    startupMode: 'application-only',
    deploymentRuntime: 'docker',
    requiredConfigurationNames: ['DATABASE_URL'],
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
    rehearsalChecks: previewMigrationInventoryNames().map((key) => ({ key, evidenceFields: ['checkKey'] })),
    rollbackImageReference: process.argv.find((value) => value.startsWith('--rollback-image-reference='))?.split('=')[1] ?? '',
    backupReference: 'backup-reference',
    stopConditions: ['approval missing'],
  })
    process.stdout.write(serializePreviewReleasePacket(packet))
  }
} catch (error) {
  console.error((error as Error).message)
  process.exit(1)
}
