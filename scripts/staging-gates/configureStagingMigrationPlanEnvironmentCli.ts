/**
 * CLI wrapper for configureStagingMigrationPlanEnvironment.
 *
 * Invoked via: pnpm staging:configure-environment
 */

import { configureStagingMigrationPlanEnvironment } from './configureStagingMigrationPlanEnvironment'

const APPLY_CONFIRMATION = 'configure_staging_migration_plan_environment'

function parseArgs(argv: string[]) {
  let confirmation: string | undefined
  let reviewerLogin: string | undefined
  let expectedCommit: string | undefined
  let dryRun = true

  for (const arg of argv) {
    if (arg.startsWith('--confirmation=')) {
      confirmation = arg.slice('--confirmation='.length)
      if (confirmation === APPLY_CONFIRMATION) dryRun = false
    } else if (arg.startsWith('--reviewer-login=')) {
      reviewerLogin = arg.slice('--reviewer-login='.length)
    } else if (arg.startsWith('--expected-commit=')) {
      expectedCommit = arg.slice('--expected-commit='.length)
    }
  }
  return { confirmation, reviewerLogin, expectedCommit, dryRun }
}

async function main(): Promise<void> {
  const input = parseArgs(process.argv.slice(2))
  const result = await configureStagingMigrationPlanEnvironment(input)

  console.log('\n=== Staging Migration Plan Environment Configurator ===\n')
  console.log(`Mode: ${result.dryRun ? 'DRY-RUN (no mutations)' : 'APPLY'}`)
  console.log()

  for (const line of result.actions) {
    console.log(`  ACTION   ${line}`)
  }
  if (result.verifiedState.length > 0) {
    console.log()
    for (const line of result.verifiedState) {
      console.log(`  VERIFIED ${line}`)
    }
  }
  if (result.blockers.length > 0) {
    console.log()
    for (const line of result.blockers) {
      console.log(`  BLOCKED  ${line}`)
    }
  }

  console.log()
  if (result.ok) {
    if (result.dryRun) {
      console.log(
        `RESULT: DRY-RUN COMPLETE — ${result.actions.length} planned action(s).\n` +
          `To apply, re-run with: --confirmation=${APPLY_CONFIRMATION} --reviewer-login=<login> --expected-commit=<SHA>`,
      )
    } else {
      console.log('RESULT: ENVIRONMENT CONFIGURED AND VERIFIED')
    }
    process.exit(0)
  } else {
    console.log(`RESULT: CONFIGURATION FAILED — ${result.blockers.length} blocker(s)`)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
