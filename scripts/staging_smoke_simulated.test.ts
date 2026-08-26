import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  runSimulatedStagingSmoke,
  SIMULATED_STAGING_SMOKE_STEPS,
  validateSimulatedSmokeSteps,
} from './release/simulatedStagingSmoke'

function main(): void {
  validateSimulatedSmokeSteps()
  const commands = SIMULATED_STAGING_SMOKE_STEPS.map((step) => [step.executable, ...step.args].join(' '))
  for (const command of commands) {
    assert.doesNotMatch(command, /\b(?:prisma migrate|payload:staging:migrate|deploy|payload:email:send|stripe:check-products|webhook_live_test|curl|wget)\b/i)
  }

  assert.throws(
    () =>
      runSimulatedStagingSmoke({
        environment: {
          NODE_ENV: 'test',
          E2E_BASE_URL: 'https://preview.example.test',
        },
        executor() {
          return { status: 0 }
        },
        log() {},
      }),
    /simulated_smoke_requires_localhost_only|simulated_smoke_requires_http_local_url/,
  )

  const logs: string[] = []
  const summary = runSimulatedStagingSmoke({
    executor() {
      return { status: 0 }
    },
    log(message) {
      logs.push(message)
    },
  })
  assert.equal(
    summary,
    `LOCAL SIMULATED STAGING SMOKE PASSED: ${SIMULATED_STAGING_SMOKE_STEPS.length}/${SIMULATED_STAGING_SMOKE_STEPS.length}`,
  )
  assert.match(logs.join('\n'), /LOCAL SIMULATED STAGING SMOKE/)
  assert.match(logs.join('\n'), /repository-only simulated evidence/)
  assert.doesNotMatch(logs.join('\n'), /\bSTAGING PASSED\b/)

  const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts?: Record<string, string> }
  assert.equal(
    packageJson.scripts?.['staging:smoke-simulated'],
    'tsx scripts/release/simulatedStagingSmoke.ts',
  )

  console.log('staging_smoke_simulated.test.ts passed')
}

main()
