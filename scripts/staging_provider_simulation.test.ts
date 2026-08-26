import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  PROVIDER_SIMULATION_STEPS,
  runProviderSimulation,
  validateProviderSimulationSteps,
} from './release/providerSimulation'

function main(): void {
  validateProviderSimulationSteps()
  const commands = PROVIDER_SIMULATION_STEPS.map((step) => [step.executable, ...step.args].join(' '))
  assert.equal(PROVIDER_SIMULATION_STEPS.some((step) => step.category === 'EMAIL'), true)
  assert.equal(PROVIDER_SIMULATION_STEPS.some((step) => step.category === 'STRIPE'), true)
  assert.equal(PROVIDER_SIMULATION_STEPS.some((step) => step.category === 'PAYLOAD'), true)
  for (const command of commands) {
    assert.doesNotMatch(command, /\b(?:curl|wget|payload:email:send|stripe:check-products|webhook_live_test|https?:\/\/)\b/i)
  }

  const logs: string[] = []
  const summary = runProviderSimulation({
    executor() {
      return { status: 0 }
    },
    log(message) {
      logs.push(message)
    },
  })
  assert.equal(summary, `STAGING PROVIDER SIMULATION PASSED: ${PROVIDER_SIMULATION_STEPS.length}/${PROVIDER_SIMULATION_STEPS.length}`)
  assert.match(logs.join('\n'), /\[EMAIL\]/)
  assert.match(logs.join('\n'), /\[STRIPE\]/)
  assert.match(logs.join('\n'), /\[PAYLOAD\]/)
  assert.match(logs.join('\n'), /Categories: EMAIL=/)

  assert.throws(
    () =>
      runProviderSimulation({
        executor(_executable, _args) {
          return { status: 1, stderr: 'forced failure' }
        },
        log() {},
      }),
    /STAGING PROVIDER SIMULATION FAILED/,
  )

  const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts?: Record<string, string> }
  assert.equal(
    packageJson.scripts?.['staging:provider-simulation'],
    'tsx scripts/release/providerSimulation.ts',
  )

  console.log('staging_provider_simulation.test.ts passed')
}

main()
