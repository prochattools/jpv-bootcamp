import { buildStagingSmokePlan } from './stagingSmokePlan'

function arg(name: string): string | undefined {
  const prefix = `--${name}=`
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length)
}

const result = buildStagingSmokePlan({
  environment: arg('environment') ?? 'repository-plan',
  execute: process.argv.includes('--execute'),
})

process.stdout.write(result.output)

if (!result.ok) {
  console.error(JSON.stringify({ ok: false, errors: result.errors }, null, 2))
  process.exitCode = 1
}
