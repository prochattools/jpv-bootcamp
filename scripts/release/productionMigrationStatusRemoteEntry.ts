import { runProductionMigrationStatusCli } from './verifyProductionMigrationStatus'

export const PRODUCTION_MIGRATION_STATUS_RESULT_MARKER =
  'JPV_PRODUCTION_MIGRATION_STATUS_RESULT_B64='
export const PRODUCTION_MIGRATION_STATUS_EXIT_MARKER =
  'JPV_PRODUCTION_MIGRATION_STATUS_CLI_EXIT_'

async function main(): Promise<void> {
  const exitCode = await runProductionMigrationStatusCli(
    process.argv.slice(2),
    process.env,
    (value) => {
      const encoded = Buffer.from(value, 'utf8').toString('base64')
      process.stdout.write(`${PRODUCTION_MIGRATION_STATUS_RESULT_MARKER}${encoded}\n`)
    },
  )

  process.stdout.write(`${PRODUCTION_MIGRATION_STATUS_EXIT_MARKER}${exitCode}\n`)
  process.exitCode = exitCode
}

main().catch(() => {
  process.stderr.write('production_migration_status_remote_entry_failed\n')
  process.exitCode = 1
})
