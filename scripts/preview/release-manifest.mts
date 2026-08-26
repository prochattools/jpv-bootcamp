import { buildPreviewReleaseManifest, serializePreviewReleaseManifest } from '../../src/lib/previewReleaseManifest'

function arg(name: string): string | undefined {
  const prefix = `--${name}=`
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length)
}

try {
  const manifest = buildPreviewReleaseManifest({
    repository: arg('repository') ?? 'prochattools/jpv-bootcamp',
    branch: arg('branch'),
    commitSha: arg('commit-sha') ?? '',
    imageReference: arg('image-reference'),
    targetEnvironment: arg('target-environment') ?? 'preview',
    startupMode: arg('startup-mode') === 'database-deploy' ? 'database-deploy' : 'application-only',
    deploymentRuntime: arg('deployment-runtime') === 'nixpacks' ? 'nixpacks' : 'docker',
    deploymentEnv: arg('deployment-env'),
    sourceDate: arg('source-date') ?? 'unspecified',
    releaseLabel: arg('release-label'),
    artifactDigest: arg('artifact-digest'),
    rollbackImageReference: arg('rollback-image-reference'),
  })
  process.stdout.write(serializePreviewReleaseManifest(manifest))
} catch (error) {
  console.error((error as Error).message)
  process.exit(1)
}
